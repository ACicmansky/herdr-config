# Active Context

## Current Focus
- Resolved sound mod integration from `updates.bundle` transferred from the work notebook:
  1. Identified why it appeared unapplied:
     - Herdr's active layout remained on `"main"` (Herdr does not auto-switch layouts when new layout files are added).
     - `settings.json` contained hardcoded absolute paths pointing to work laptop user profile (`C:\Users\acicmansky001\...`), which did not exist on this machine (`Andrej`).
  2. Fixed cross-machine portability:
     - Converted sound paths in `settings.json` to portable relative paths (`sounds\library\...`).
     - Enhanced `mods/sound-library/sounds.js` so `choose()` automatically normalizes local paths relative to `appHome()`, ensuring future sound selections sync seamlessly across both work and home laptops.
  3. Integrated layout:
     - Upgraded `layouts/herdr-agy.json` to feature `personal-chrome` (with sound library launcher and mute toggle button) while retaining `agy-status` (live Antigravity quota and reset countdowns).
     - Switched Herdr's active layout to `herdr-agy`.
  4. Verified all tests pass: `node mods\sound-library\test.cjs` passes with 0 errors; `herdr-app check` passes for all custom mods.

## Recent Changes
- Configured `.md` files to open directly as an in-app split panel in Herdr running `leaf` (terminal markdown viewer) via [`LeafLauncher.exe`](file:///C:/Users/Andrej/bin/LeafLauncher.exe).
- Set up Windows OpenSSH Server automation (`setup-ssh.ps1`, `Install-OpenSSH.bat`) for Android Tailscale companion app.
- Registered `.md` handler in registry to open in `leaf` via `LeafLauncher.exe`.
- Created filesystem symlinks for WSL path resolution (`C:\home`, `C:\mnt\c`).
- Installed `leaf` in WSL at `/usr/local/bin/leaf` and on Windows at `C:\Users\Andrej\bin\leaf.exe`.

## Next Steps
- Execute `setup-ssh.ps1` with Administrator privileges.
- Add machine in Herdr Android app targeting `100.98.21.12` / user `Andrej`.
- Verify Herdr Android connects and displays live agents/spaces.
