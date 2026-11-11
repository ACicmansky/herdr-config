# Progress

## What Works
- **GitHub MCP Server**: Configured and active via `agy mcp` (`@modelcontextprotocol/server-github` over stdio with authentication).
- **Private Repository Created**: `https://github.com/ACicmansky/herdr-config` (private).
- **Code Pushed**: All configurations, custom layouts (`herdr-agy.json`), user mods (`agy-status`), themes, keybindings, and `.gitignore` pushed to `main`.
- **Tailscale Mesh**: Verified active between host Windows laptop `nb-andrej` (`100.98.21.12`) and Android `pixel-10-pro` (`100.119.97.66`). Ping succeeds bi-directionally.
- **Herdr Remote Automation**: `setup-ssh.ps1` and `Install-OpenSSH.bat` created to enable Windows OpenSSH Server and wire `hc` into system path for incoming mobile sessions.
- **Clickable Terminal File Links**: Fixed and verified!
  - Installed `leaf` terminal markdown viewer in both Windows and WSL.
  - Built `LeafLauncher.exe` to integrate directly with Herdr's window manager (`pane.split`).
  - Clicking any `.md` link in Herdr now splits a new panel to the right inside Herdr running `leaf` with the target file.
  - Exiting `leaf` (<kbd>q</kbd> or <kbd>Esc</kbd>) automatically closes the split panel.
  - Gracefully falls back to Windows Terminal if Herdr is not currently open.
  - Created directory symlinks `C:\home` -> `\\wsl.localhost\Ubuntu\home` and `C:\mnt\c` -> `C:\`.
  - Configured global Antigravity rules in `~/.gemini/GEMINI.md` across Windows and WSL for Windows-compatible URI output (`file://wsl.localhost/Ubuntu/...` or `file:///C:/home/...`).

- **Sound Mod & Library Integration**:
  - Imported and activated `mods/sound-library` and `mods/personal-chrome` from `updates.bundle`.
  - Normalized all sound paths to relative paths (`sounds\library\...`), enabling seamless git sharing across home and work notebooks.
  - Upgraded `layouts/herdr-agy.json` to include `personal-chrome` (with sound settings launcher and mute toggle button) alongside `agy-status` (live Antigravity quota counters).
  - Verified <kbd>Ctrl</kbd>+<kbd>,</kbd> triggers the Sound Library overlay.
  - All unit checks (`node mods\sound-library\test.cjs`) and layout validation pass with 0 errors.

## What's Left to Build
- Run elevated SSH installation on Windows (`setup-ssh.ps1`).
- Connect Herdr Android app to `100.98.21.12:22` as `Andrej`.
- Verify mobile inbox shows all local Windows & WSL spaces and active agents.
