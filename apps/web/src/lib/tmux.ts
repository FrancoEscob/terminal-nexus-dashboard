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
  private static tmuxBinary = 'tmux';

  private static getTmuxEnv() {
    return {
      ...process.env,
      PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      TMUX: '',
      TMUX_PANE: '',
    };
  }

  private static async resolveTmuxBinary(): Promise<void> {
    try {
      const probe = spawnProcess('which', ['tmux'], {
        env: this.getTmuxEnv(),
      });

      let stdout = '';
      await new Promise<void>((resolve, reject) => {
        probe.stdout?.on('data', (chunk: Buffer | string) => {
          stdout += chunk.toString();
        });

        probe.on('error', reject);
        probe.on('close', (code) => {
          if (code === 0) {
            const value = stdout.trim();
            if (value) {
              this.tmuxBinary = value;
            }
            resolve();
            return;
          }

          reject(new Error('tmux not found in PATH'));
        });
      });
    } catch {
      // Keep default binary name and let real execution return detailed errors.
      this.tmuxBinary = 'tmux';
    }
  }

  private static runTmux(args: string[], options?: { cwd?: string }): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawnProcess(this.tmuxBinary, args, {
        cwd: options?.cwd,
        env: this.getTmuxEnv(),
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

    await this.resolveTmuxBinary();
    
    // Check if tmux is available
    try {
      await this.runTmux(['-V']);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      throw new Error(
        `tmux is not installed or not available (${details}). On Windows, run the app inside WSL with tmux installed, or use Linux/macOS.`
      );
    }
    
    await this.ensureSocketDir();
    this.initialized = true;
  }

  static getTmuxBinary(): string {
    return this.tmuxBinary;
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

    // Verify session was created (tmux server may need a brief moment to become queryable)
    let sessionExists = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const sessions = await this.listSessions(socketPath);
      sessionExists = sessions.some((session) => session.name === name);
      if (sessionExists) break;
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    if (!sessionExists) {
      throw new Error(`Failed to create tmux session: ${name} (not visible after creation)`);
    }

    return name;
  }

  static async killSession(sessionName: string, socketPath: string): Promise<void> {
    await this.initialize();

    try {
      await this.runTmux([
        '-S', socketPath,
        'kill-session',
        '-t', sessionName,
      ]);
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
      const alreadyStopped = (
        message.includes("can't find session")
        || message.includes('no server running')
        || message.includes('failed to connect to server')
        || message.includes('no such file or directory')
      );

      if (alreadyStopped) {
        return;
      }

      throw new Error(`Failed to kill session ${sessionName}: ${error instanceof Error ? error.message : String(error)}`);
    }
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
      if (
        message.includes('no server running')
        || message.includes('failed to connect to server')
        || message.includes('no such file or directory')
      ) {
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

    const pty = spawn(this.tmuxBinary, args, {
      env: this.getTmuxEnv()
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

    const pty = spawn(this.tmuxBinary, [
      '-S', socketPath,
      'send-keys',
      '-t', sessionName,
      keys,
      'C-m' // Enter
    ], {
      env: this.getTmuxEnv()
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

    const pty = spawn(this.tmuxBinary, [
      '-S', socketPath,
      'resize-window',
      '-t', sessionName,
      '-x', cols.toString(),
      '-y', rows.toString()
    ], {
      env: this.getTmuxEnv()
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
