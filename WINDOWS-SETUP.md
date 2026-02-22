# Windows Setup Instructions

## 🔄 Windows Setup V2 (Refactor)

El refactor V2 prioriza **Direct PTY Runtime** para evitar cierres prematuros de sesiones Claude.

### Recomendación de ejecución en Windows
- Ejecutar el backend dentro de **WSL2 Ubuntu**.
- Mantener Windows solo como host/editor/browser.
- Usar workdirs WSL válidos para sesiones (`/home/<user>/projects/...`).

### Variables recomendadas en entorno de desarrollo
```bash
TERMINAL_RUNTIME=direct
TERMINAL_ALLOWED_DIRS=/home/fran/projects,/tmp/experiments
```

### Cuándo usar tmux
- Solo en modo fallback/compat (`TERMINAL_RUNTIME=tmux`) o debugging.
- No usar como camino principal durante el fix de `CLAUDE EXITED`.

### Nota sobre VibeTunnel
- Se usará como referencia/PoC de runtime.
- VibeTunnel todavía no soporta Windows nativo oficialmente; usar Linux/WSL para pruebas.

---

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
