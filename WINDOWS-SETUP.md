# Windows Setup Instructions

## Requirements

This application requires **tmux** to be installed and available. On Windows, you have two options:

### Option 1: WSL (Recommended)

1. **Install WSL:**
   ```powershell
   wsl --install
   ```

2. **Install tmux in WSL:**
   ```bash
   # Inside WSL (Ubuntu/Debian)
   sudo apt update
   sudo apt install tmux
   ```

3. **Configure tmux to be available from Windows:**
   - Create a wrapper script or add WSL tmux to your Windows PATH
   - Example wrapper script (`tmux.bat`):
     ```batch
     @echo off
     wsl tmux %*
     ```

### Option 2: Git Bash (Alternative)

1. **Install Git for Windows** which includes Git Bash
2. **tmux is not typically available in Git Bash**, so WSL is still recommended

### Option 3: Windows Terminal + WSL

1. Install Windows Terminal from Microsoft Store
2. Configure it to use WSL as default
3. Ensure tmux is installed in your WSL distribution

## Verification

Run the following to verify tmux is available:
```bash
tmux -V
```

You should see version information like: `tmux 3.2a`

## Troubleshooting

- **"tmux not found"**: Ensure tmux is installed and accessible from your current shell
- **Permission issues**: Make sure the temporary directory is writable
- **Socket issues**: Check that the temp directory allows socket creation

## Development Notes

The application uses `node-pty` to create terminal sessions and tmux for session management. The socket directory is automatically created in the system temp directory (`%TEMP%` on Windows, `/tmp` on Unix-like systems).
