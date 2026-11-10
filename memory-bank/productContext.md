# Product Context

## Why This Exists
Herdr exposes its entire desktop interface as files inside `~/.config/herdr-app`. Every visual block, panel, keybinding, theme, and layout updates live within a second when modified.

## How It Works
- **Two Programs**: `herdr-app` renders the GPU-accelerated window (spaces, tabs, layouts, panels) and `herdr-core` (`hc`) runs persistent terminals and coding agents across local and remote machines.
- **Data Model**: Spaces (per machine/repo) -> Tabs (splits of terminals and mod panes) -> Panes (terminals or mods) & Agents (terminals reporting OSC 7501 status: `working`, `blocked`, `done`, `idle`).
- **Customization Surface**:
  - `settings.json`: User-level preferences (zoom, fonts, ligatures, themes, sounds, contrast, scrollbars).
  - `keys.json`: Global, terminal, per-layout, and per-mod keyboard shortcuts.
  - `themes/<name>.json`: Custom color schemes.
  - `layouts/<name>.json`: Window node trees, pane frames, floating drawers, and cascading look settings.
  - `programs.json`: Custom agent launchers, icons, and process matching rules.
  - `mods/<name>/`: Custom UI panels, pane headers, menus, dialogs, and floating widgets written in JavaScript using `gpui-kit`, `gpui-base`, and `herdr`.
