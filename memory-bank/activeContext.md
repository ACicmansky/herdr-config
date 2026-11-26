# Active Context

## Current Focus
- Added a Firstmate Worker Pane Indicator in [`mods/agy-status/`](file:///C:/Users/Andrej/.config/herdr-app/mods/agy-status/main.js):
  - Extracted pure, unit-tested worker detection helpers in `mods/agy-status/worker.js` (`resolveActiveContext`, `detectWorkerContext`, `countActiveWorkers`) matching Firstmate's verified Herdr signals (`fm-*` / `*-fm-*` space and tab IDs, `fm/*` branches, `herdr.tab`/`herdr.space` labels, `firstmate-*` app names, and `.treehouse/` worktree paths) while keeping primary Firstmate sessions (`Firstmate` / `Captain quarters` / `antigravity`) and ordinary terminals unflagged.
  - Updated `mods/agy-status/main.js` to show a prominent amber/warning `WORKER · reply in Firstmate` badge pill (with worker task tooltip) when the active pane/tab/space is a Firstmate worker, plus an active worker count summary (`· N worker(s)`) next to the agent count, while preserving all Antigravity quota bars, popup, refresh, and theme styling. Guarded `init()` startup refresh with `checking()` for clean `herdr-app check` runs.
  - Kept the indicator cleanly in `mods/agy-status/` rather than editing shipped `tabs` or `pane` mods (which Herdr overwrites on startup).
  - Added `mods/agy-status/test.cjs` covering primary Firstmate sessions, worker sessions, `.treehouse/` paths, label/title signals, worker counts, and `AgyStatus.render()` integration.
- Added concise root `AGENTS.md` (documenting `memory-bank/` as canonical context, repo invariants, and local validation workflow; removed `AGENTS.md` from `.gitignore`) and `.agents/skills/herdr-mod-dev/SKILL.md` encoding mod structure, `gpui-kit`/`gpui-base`/`herdr` API discipline, verification checklist, and memory-bank update rules.
- Added a Windows per-app sound volume slider to the left of the mute/unmute speaker button in [`mods/personal-chrome/main.js`](file:///C:/Users/Andrej/.config/herdr-app/mods/personal-chrome/main.js):
  - Uses `gpui-base` `Slider` / `SliderState` (`0..100`) in the `personal-chrome` footer (hidden when the sidebar is collapsed to the narrow rail). Always initializes `SliderState` in `init()` (with deferred `syncVolume` timers) so cold app restarts keep the slider visible even if `props()` / `window()` aren't populated yet during `init()`.
  - Reads and writes `herdr-app.exe`'s Windows Volume Mixer (`ISimpleAudioVolume`) via [`mods/personal-chrome/volume.ps1`](file:///C:/Users/Andrej/.config/herdr-app/mods/personal-chrome/volume.ps1).
  - Initializes an inactive Windows audio session silently on startup via [`sounds/silence.mp3`](file:///C:/Users/Andrej/.config/herdr-app/sounds/silence.mp3) when sounds are enabled and no session exists yet, preserving Windows' persisted mixer level.
- Fixed [`setup-ssh.ps1`](file:///C:/Users/Andrej/.config/herdr-app/setup-ssh.ps1) to remove any stale `C:\Windows\System32\hc.exe` instead of copying `hc.exe` there, since `System32\hc.exe` shadowed `AppData\Local\Programs\herdr-core\hc.exe` on `PATH` and blocked `herdr-app` self-updates with `Access is denied (os error 5)`.
- Previously fixed URI path resolution bug in [`LeafLauncher.cs`](file:///C:/Users/Andrej/.config/herdr-app/tools/leaf-launcher/LeafLauncher.cs):
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
