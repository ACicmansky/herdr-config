# Active Context

## Current Focus
- Fixed URI path resolution bug in [`LeafLauncher.cs`](file:///C:/Users/Andrej/.config/herdr-app/tools/leaf-launcher/LeafLauncher.cs):
  - When clicking `file://wsl.localhost/Ubuntu/...` links from a WSL space, UNC path slashes (`//wsl.localhost/...`) prevented `ToLinuxPath` from matching the distro prefix, which resulted in passing `//wsl.localhost/Ubuntu/...` into Linux `leaf`. Linux `leaf` failed with `Error: Not a valid file, directory or keyword` and instantly closed the split pane.
  - Stripped leading slashes in `ToLinuxPath` and generalized distro matching (`wsl.localhost/<distro>/...`).
  - Tested clicking `file://wsl.localhost/Ubuntu/home/andrej/.gemini/antigravity-cli/brain/cf24165a-ed9a-4c88-8146-8b9ae756674a/wow_forever_sota_plan.md` in both WSL and Windows spaces; verified split pane renders in Herdr under 100ms.
  - Committed `tools/leaf-launcher/` (`LeafLauncher.cs` and `setup-leaf.ps1`) to git for instant deployment across machines.

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
