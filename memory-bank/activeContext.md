# Active Context

## Current Focus
- Simplified customization model: following the "only one way to turn something off" principle.
- Layout switching (`herdr-agy` vs default `main`) is the single source of truth for whether `agy-status` is active.
- Removed redundant `Settings/Improvements` toggle and extra checks; kept Settings clean and native.
- Ready to sync repository across machines.

## Recent Changes
- Removed redundant `improvements.antigravity_limits` toggle from Settings and `agy-status`.
- Reverted `frame/settings/main.js` to clean native state and removed `mods/improvements`.
- Verified `layouts/herdr-agy.json` is the sole declarative place where `agy-status` is used.
- Git repository staged and ready.

## Next Steps
- Explain the single-switch model to user and how to use `layout.switch` / `Settings > Look` across machines.
