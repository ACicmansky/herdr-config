# Project Brief: Herdr App Customization (`~/.config/herdr-app`)

## Overview
This directory (`C:\Users\Andrej\.config\herdr-app`) represents the entire live user interface and configuration for the **Herdr** desktop application, which manages terminals, spaces, tabs, and coding agents via `herdr-app` (window UI) and `herdr-core` (`hc`).

## Core Scope & Goals
- Customize the Herdr interface, themes, fonts, keybindings, program definitions, layouts, and custom GPUI mods (`mods/<name>/`).
- Maintain live, error-free configurations (verifying absence of `*.error` files and passing `herdr-app check` for custom mods).
- Follow safe customization rules: never directly edit shipped layouts or mods without cloning them first (`layout.clone` / `mod.clone`).
