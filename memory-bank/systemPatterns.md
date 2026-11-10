# System Patterns

## Architecture & Rules
1. **Read-Only Shipped Assets**: Shipped layouts (`main`, `terminals`, `win98`) and shipped mods (`spaces`, `agents`, `tabs`, `files`, `changes`, `pane`, `menu`, etc.) are overwritten on app start. Always clone before editing structure or code (`herdr-app do layout.clone` / `herdr-app do mod.clone`).
2. **Look Precedence**: Theme picker override > Layout root look (`layouts/<name>.json`) > User settings (`settings.json`) > Default (Graphite/Paper, JetBrains Mono 14, Geist).
3. **Mod Development (`gpui-kit` + `herdr`)**:
   - Export default class extending `View` in `mods/<name>/main.js` with `mod.json`.
   - Never store `cx` across async boundaries; always use the `cx` passed to callbacks (`cx.spawn`, `cx.timer.every`, event handlers).
   - No DOM, HTML/CSS, or `setTimeout`/`setInterval`.
   - Use native animations (`.frames()`, `.spin()`, `.loop()`, `.transition()`) instead of high-frequency timers.
   - Always validate mods with `herdr-app check <mod-folder>` and check for `*.error` files after editing JSON configs.
