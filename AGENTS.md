# herdr-config

Windows/WSL configuration, custom layouts, themes, GPUI mods, sounds, and launch helpers for Herdr (`C:\Users\Andrej\.config\herdr-app`).

## Canonical Project Context
- Read `memory-bank/` for full project context before making structural changes:
  - `memory-bank/projectbrief.md`, `memory-bank/productContext.md`
  - `memory-bank/systemPatterns.md`, `memory-bank/techContext.md`
  - `memory-bank/activeContext.md`, `memory-bank/progress.md`
- Project skill: `.agents/skills/herdr-mod-dev/SKILL.md`.

## Architecture & Sync Notes
- **Shipped vs. custom assets:** Shipped layouts (`main`, `terminals`, `win98`) and shipped mods (`spaces`, `agents`, `tabs`, `pane`, `files`, `changes`, `menu`, `toast`, etc.) are overwritten by `herdr-app.exe` on startup (edits are moved to `<name>-edited`). Always clone first (`herdr-app do layout.clone` / `herdr-app do mod.clone`) or keep custom UI in user-owned mods (`mods/agy-status/`, `mods/personal-chrome/`, `mods/sound-library/`).
- **Live-folder `AGENTS.md` overwrite:** On startup, `herdr-app.exe` overwrites `C:\Users\Andrej\.config\herdr-app\AGENTS.md` with its built-in manual and leaves `AGENTS.local.md` untouched. Keep this repo's `AGENTS.md` in `herdr-config` as project guidance and use `AGENTS.local.md` for machine-local live-folder notes.

## Verified Invariants
- **`gpui-base` `SliderState` initialization:** Initialize `SliderState.new(...)` unconditionally inside `init()` before `props()` or `window()` may be populated on cold app restarts, and pair with deferred `cx.timer.after` sync timers (see `mods/personal-chrome/main.js`).
- **Async `cx` safety:** Never store `cx` across async boundaries; always use the `cx` passed to each callback (`cx.spawn`, `cx.timer.*`, event handlers). Guard startup `exec`/`hc`/write side effects with `checking()` from `"herdr"`.
- **Windows `System32\hc.exe` shadowing trap:** Never place `hc.exe` in `C:\Windows\System32`. It shadows `C:\Users\Andrej\AppData\Local\Programs\herdr-core\hc.exe` on `PATH` and breaks `herdr-app` self-updates with `Access is denied (os error 5)`. `setup-ssh.ps1` removes stale `System32\hc.exe` and adds `herdr-core` to Machine `PATH`.
- **`LeafLauncher.cs` URI normalization:** `ToLinuxPath` must strip all leading slashes (`//wsl.localhost/...` -> `wsl.localhost/...`) and match `wsl.localhost/<distro>/...` and `wsl$/<distro>/...` generically so clicking `file://wsl.localhost/<distro>/...` links opens `leaf` inside WSL split panes cleanly.
- **PowerShell helpers:** Invoke `powershell.exe` with `-NoProfile -ExecutionPolicy Bypass -File ...` (add `-STA` when using Windows file dialogs) and strip any leading UTF-8 BOM (`stdout.replace(/^\uFEFF/, "").trim()`) before `JSON.parse(...)`.
- **Relative sound library paths:** Store alert paths in `settings.json` relative to `appHome()` (e.g., `sounds\library\...`) and keep `.mp3` assets under `sounds/` rather than `mods/` so audio changes never trigger mod hot-reload and configs stay portable across machines.

## Local Validation Before Syncing to `C:\Users\Andrej\.config\herdr-app`
1. Syntax-check modified JS: `node --check mods/<name>/main.js` (and helper modules).
2. Run mod unit tests: `node mods/agy-status/test.cjs` and `node mods/sound-library/test.cjs` (note: PowerShell sections in `sound-library/test.cjs` require Windows `powershell.exe`).
3. Validate mods in Herdr (from WSL, UNC paths work):
   `"/mnt/c/Users/Andrej/AppData/Local/Programs/herdr-app/herdr-app.exe" check "\\wsl.localhost\Ubuntu\<worktree>\mods\<name>"`
4. After syncing to `C:\Users\Andrej\.config\herdr-app`, verify no `*.error` files (`layout.error`, `keys.error`, `settings.error`, `programs.error`) appear and `herdr-app status` reports no mod errors.
