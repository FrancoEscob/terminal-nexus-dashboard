import { spawn } from 'node-pty';
import { promises as fs } from 'fs';
import path from 'path';

const TMUX_SOCKET_DIR = '/tmp/terminal-nexus';

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

  private static async ensureSocketDir(): Promise<void> {
    try {
      await fs.access(TMUX_SOCKET_DIR);
    } catch {
      await fs.mkdir(TMUX_SOCKET_DIR, { recursive: true });
    }
  }

  static async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.ensureSocketDir();
    this.initialized = true;
  }

  static async createSession(config: TmuxSessionConfig): Promise<string> {
    await this.initialize();

    const { name, workdir, command, socketPath, cols = 80, rows = 24 } = config;

    // Spawn tmux session via node-pty
    const pty = spawn('tmux', [
      '-S', socketPath,
      'new-session',
      '-d', // detached
      '-s', name,
      '-c', workdir,
      command
    ], {
      name: 'xterm-color',
      cols,
      rows,
      cwd: workdir,
      env: { ...process.env, TMUX: '', TMUX_PANE: '' }
    });

    // Wait a bit for session to be created
    await new Promise(resolve => setTimeout(resolve, 100));

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

    const pty = spawn('tmux', [
      '-S', socketPath,
      'list-sessions',
      '-F', '#{session_id}:#{session_name}:#{session_created}:#{session_attached}:#{session_width}x#{session_height}'
    ], {
      env: { ...process.env, TMUX: '', TMUX_PANE: '' }
    });

    let output = '';

    return new Promise((resolve) => {
      pty.onData((data) => {
        output += data;
      });

      pty.onExit(() => {
        const lines = output.trim().split('\n').filter(line => line);
        const sessions: TmuxSessionInfo[] = [];

        for (const line of lines) {
          const [id, name, created, attached, size] = line.split(':');
          sessions.push({
            id,
            name,
            created,
            attached,
            size
          });
        }

        resolve(sessions);
      });
    });
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
