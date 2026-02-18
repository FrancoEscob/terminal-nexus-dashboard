import { spawn } from 'node-pty';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn as spawnProcess } from 'child_process';

const TMUX_SOCKET_DIR = path.join(os.tmpdir(), 'terminal-nexus');

export interface TmuxSessionConfig {
  name: string;
  workdir: string;
  command: string;
  socketPath: string;
  cols?: number;
  rows?: number;
}

export interface TmuxSessionInfo {
  id: string;
  name: string;
  created: string;
  attached: string;
  size: string;
}

export class TmuxWrapper {
  private static initialized = false;

  private static runTmux(args: string[], options?: { cwd?: string }): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawnProcess('tmux', args, {
        cwd: options?.cwd,
        env: { ...process.env, TMUX: '', TMUX_PANE: '' },
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }

        const details = stderr.trim() || stdout.trim() || `exit code ${code}`;
        reject(new Error(details));
      });
    });
  }

  private static async ensureSocketDir(): Promise<void> {
    try {
      await fs.access(TMUX_SOCKET_DIR);
    } catch {
      await fs.mkdir(TMUX_SOCKET_DIR, { recursive: true });
    }
  }

  static async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Check if tmux is available
    try {
      await new Promise<void>((resolve, reject) => {
        const testProcess = spawnProcess('tmux', ['-V'], { stdio: 'ignore' });
        testProcess.on('exit', (code) => {
          if (code === 0) resolve();
          else reject(new Error('tmux not found'));
        });
        testProcess.on('error', reject);
      });
    } catch (error) {
      throw new Error(
        'tmux is not installed or not available. On Windows, please install WSL (Windows Subsystem for Linux) and tmux, or use a Linux/macOS environment.'
      );
    }
    
    await this.ensureSocketDir();
    this.initialized = true;
  }

  static async createSession(config: TmuxSessionConfig): Promise<string> {
    await this.initialize();

    const { name, workdir, command, socketPath, cols = 80, rows = 24 } = config;

    await this.runTmux(
      [
        '-S', socketPath,
        'new-session',
        '-d',
        '-s', name,
        '-c', workdir,
        '-x', cols.toString(),
        '-y', rows.toString(),
        command,
      ],
      { cwd: workdir },
    );

    // Verify session was created
    const sessions = await this.listSessions(socketPath);
    const sessionExists = sessions.some(s => s.name === name);
    
    if (!sessionExists) {
      throw new Error(`Failed to create tmux session: ${name}`);
    }

    return name;
  }

  static async killSession(sessionName: string, socketPath: string): Promise<void> {
    await this.initialize();

    const pty = spawn('tmux', [
      '-S', socketPath,
      'kill-session',
      '-t', sessionName
    ], {
      env: { ...process.env, TMUX: '', TMUX_PANE: '' }
    });

    return new Promise((resolve, reject) => {
      pty.onData(() => {});
      pty.onExit(({ exitCode }) => {
        if (exitCode === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to kill session ${sessionName}: exit code ${exitCode}`));
        }
      });
    });
  }

  static async listSessions(socketPath: string): Promise<TmuxSessionInfo[]> {
    await this.initialize();

    try {
      const { stdout } = await this.runTmux([
        '-S', socketPath,
        'list-sessions',
        '-F', '#{session_id}:#{session_name}:#{session_created}:#{session_attached}:#{session_width}x#{session_height}',
      ]);

      const lines = stdout.trim().split('\n').filter(line => line);
      const sessions: TmuxSessionInfo[] = [];

      for (const line of lines) {
        const [id, name, created, attached, size] = line.split(':');
        sessions.push({
          id,
          name,
          created,
          attached,
          size,
        });
      }

      return sessions;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('no server running')) {
        return [];
      }

      throw error;
    }
  }

  static async capturePane(sessionName: string, socketPath: string, lines?: number): Promise<string> {
    await this.initialize();

    const args = [
      '-S', socketPath,
      'capture-pane',
      '-p', // plain text
      '-t', sessionName
    ];

    if (lines) {
      args.push(`-${lines}`);
    }

    const pty = spawn('tmux', args, {
      env: { ...process.env, TMUX: '', TMUX_PANE: '' }
    });

    let output = '';

    return new Promise((resolve, reject) => {
      pty.onData((data) => {
        output += data;
      });

      pty.onExit(({ exitCode }) => {
        if (exitCode === 0) {
          resolve(output);
        } else {
          reject(new Error(`Failed to capture pane: exit code ${exitCode}`));
        }
      });
    });
  }

  static async sendKeys(sessionName: string, keys: string, socketPath: string): Promise<void> {
    await this.initialize();

    const pty = spawn('tmux', [
      '-S', socketPath,
      'send-keys',
      '-t', sessionName,
      keys,
      'C-m' // Enter
    ], {
      env: { ...process.env, TMUX: '', TMUX_PANE: '' }
    });

    return new Promise((resolve, reject) => {
      pty.onData(() => {});
      pty.onExit(({ exitCode }) => {
        if (exitCode === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to send keys: exit code ${exitCode}`));
        }
      });
    });
  }

  static async resizeSession(sessionName: string, cols: number, rows: number, socketPath: string): Promise<void> {
    await this.initialize();

    const pty = spawn('tmux', [
      '-S', socketPath,
      'resize-window',
      '-t', sessionName,
      '-x', cols.toString(),
      '-y', rows.toString()
    ], {
      env: { ...process.env, TMUX: '', TMUX_PANE: '' }
    });

    return new Promise((resolve, reject) => {
      pty.onData(() => {});
      pty.onExit(({ exitCode }) => {
        if (exitCode === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to resize session: exit code ${exitCode}`));
        }
      });
    });
  }

  static generateSocketPath(sessionId: string): string {
    return path.join(TMUX_SOCKET_DIR, `${sessionId}.sock`);
  }
}
