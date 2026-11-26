---
name: herdr-mod-dev
description: Create, edit, and verify Herdr desktop mods, layouts, themes, Windows PowerShell helpers, and LeafLauncher in herdr-config. Use when modifying mods/*, layouts/*, themes/*, tools/leaf-launcher/*, or setup scripts.
---

# Herdr Mod & Config Development

Use this skill when building or updating custom mods, layouts, themes, Windows PowerShell helpers, or `LeafLauncher` in `herdr-config`.

## 1. Repository & Mod Layout

Each mod lives in `mods/<name>/`:
- `mod.json`: Placement and overlay defaults (`{ "place": "none" | "left" | "right" | "top" | "bottom", "size"?: number, "title"?: string, "overlay"?: { "width": number, "height": number }, "focusable"?: true, "palette"?: [...] }`).
- `jsconfig.json`: ES2022 + `bundler` resolution + `checkJs: true` + `strictNullChecks: false` (do not turn on `strictNullChecks` or add browser `lib`s; they collide with `gpui-kit.d.ts`).
- `main.js`: Default-exports a class extending `View`.
- Optional modules & assets: `*.js` (imported via `./helper.js`), `link.js` (`export function handleLink(click)`), `*.svg` (referenced from `appHome()`, e.g., `mods/<name>/icon.svg`), and `test.cjs` for Node unit tests.

### Shipped vs. Custom Assets
- Shipped layouts (`main`, `terminals`, `win98`) and shipped mods (`spaces`, `agents`, `tabs`, `pane`, `files`, `changes`, `menu`, `toast`, `workspace-chrome`, `workspace-status`, etc.) are overwritten by `herdr-app.exe` at startup (edits get moved to `<name>-edited`).
- Always clone before modifying shipped assets (`herdr-app do layout.clone` / `herdr-app do mod.clone`) or keep changes inside custom mods (`mods/agy-status/`, `mods/personal-chrome/`, `mods/sound-library/`).

## 2. `gpui-kit` / `gpui-base` / `herdr` API Discipline

- **Verify APIs against the generated `.d.ts` files** (`C:\Users\Andrej\.config\herdr-app\herdr.d.ts` and `gpui-kit.d.ts`) before calling any function or reading any field. Never guess exports (for example, tabs live on `spaces()[i].tabs`; there is no `tabs()` export).
- **Initialize state in `init(_props, cx)`:**
  - Initialize `gpui-base` state objects (`SliderState.new(...)`, `InputState.new(...)`, `ScrollHandle.new()`) unconditionally in `init()` before `props()` or `window()` may be populated on cold starts.
  - Pair deferred startup reads with `cx.timer.after(...)` when `props()` arrives late.
  - Guard startup `exec`, `hc`, or file-write side effects with `if (checking()) return;` (`checking` from `"herdr"`).
- **Never store `cx` across async boundaries:** Always pass and use the `cx` argument provided to each callback (`on_click((_e, cx) => ...)`, `cx.spawn(async (cx) => ...)`, `cx.timer.every(ms, (cx) => ...)`).
- **Runtime constraints:**
  - No HTML, CSS, DOM, Node `setTimeout`/`setInterval` (use `cx.timer`), or top-level `await`.
  - Do not poll `spaces()`, `agents()`, `panes()`, `terminals()`, `focused()`, `theme()`, or `shared()`; Herdr automatically re-renders mods when live data changes.
  - Use native animations (`.frames()`, `.spin()`, `.loop()`, `.transition()`) instead of fast `cx.notify()` timers.
  - Use `theme()` color tokens (`background`, `surface`, `chrome`, `border`, `foreground`, `muted`, `dim`, `accent`, `working`, `blocked`, `done`, etc.) so UI works in both light and dark themes.

## 3. Windows PowerShell & `LeafLauncher` Conventions

- **PowerShell invocations from JS mods:**
  - Use `exec("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ...])` (use `-STA` when opening native Windows pickers).
  - Strip any leading UTF-8 BOM before JSON parsing: `stdout.replace(/^\uFEFF/, "").trim()`.
- **Sound assets:** Store `.mp3` files under `sounds/` (never `mods/`) and write `appHome()`-relative paths (`sounds\library\...`) into `settings.json` using optimistic concurrency (`writeTextFile(path, next, previous)`).
- **`hc.exe` PATH invariant:** Never copy `hc.exe` to `C:\Windows\System32`; it shadows `AppData\Local\Programs\herdr-core\hc.exe` and breaks `herdr-app` self-updates.
- **`LeafLauncher.cs`:** Keep leading-slash normalization in `ToLinuxPath` (`//wsl.localhost/...` -> `wsl.localhost/...`) and generic `wsl.localhost/<distro>/...` / `wsl$/<distro>/...` handling.

## 4. Verification Checklist

Run before finishing any mod/layout/config change:
1. Syntax-check every modified JS file:
   ```sh
   node --check mods/<name>/main.js
   ```
2. Run Node unit tests:
   ```sh
   node mods/agy-status/test.cjs
   node mods/sound-library/test.cjs
   ```
3. Validate the mod with Herdr (UNC paths work from WSL):
   ```sh
   /mnt/c/Users/Andrej/AppData/Local/Programs/herdr-app/herdr-app.exe check '\\wsl.localhost\Ubuntu\<repo>\mods\<name>'
   ```
4. After syncing to `C:\Users\Andrej\.config\herdr-app`:
   - Confirm no `*.error` files exist (`layout.error`, `keys.error`, `settings.error`, `programs.error`).
   - Run `herdr-app status` to confirm zero runtime/mod errors.

## 5. Documentation Rule

After completing any feature or fix, concisely update `memory-bank/activeContext.md` and `memory-bank/progress.md` to reflect the current state and verified checks.
