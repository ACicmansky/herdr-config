import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex, Slider, SliderTrack, SliderIndicator, SliderThumb, SliderState } from "gpui-base";
import { theme, run, props, window, shared, setShared, updates, layout, settings, appHome, readTextFile, writeTextFile, notify, exec, playSound } from "herdr";

const clampVolume = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 100;
  return Math.max(0, Math.min(100, Math.round(n)));
};

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// To the rail (on macOS wide enough for the traffic lights), or back to the width it had.
function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  // Mods edited before the rail went by width still read the flag.
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? 268) : window()?.platform === "macos" ? 76 : 44 });
}

export default class WorkspaceChrome extends View {
  init(_props, cx) {
    const initial = clampVolume(shared("sounds.volume") ?? 100);
    this.volume = initial;
    this.applyingVolume = false;
    this.pendingVolume = null;
    this.syncedVolume = false;
    this.volumeState = SliderState.new({ min: 0, max: 100, step: 1, value: initial });
    this.volumeState.on("change", (value, cx) => {
      this.volume = clampVolume(value);
      cx.notify();
    });
    this.volumeState.on("release", (value, cx) => {
      const level = clampVolume(value);
      this.volume = level;
      setShared("sounds.volume", level);
      this.applyVolume(level, cx);
    });
    if (props()?.footer && window()?.platform === "windows") {
      this.syncVolume(cx);
    } else {
      for (const waitMs of [250, 1200]) {
        cx.timer.after(waitMs, (cx) => {
          if (props()?.footer && window()?.platform === "windows" && !this.syncedVolume) {
            this.syncVolume(cx);
          }
        });
      }
    }
  }

  delay(cx, ms) {
    return new Promise((resolve) => cx.timer.after(ms, () => resolve()));
  }

  async runVolumeScript(action, level = 100) {
    const args = [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
      `${appHome()}\\mods\\personal-chrome\\volume.ps1`,
      "-Action", action,
    ];
    if (action === "set") args.push("-Level", String(clampVolume(level)));
    const result = await exec("powershell.exe", args, { timeout: 15000 });
    if (result.code !== 0) throw new Error(result.stderr.trim() || "Audio volume command failed.");
    const raw = (result.stdout || "").replace(/^\uFEFF/, "").trim();
    return raw ? JSON.parse(raw) : { found: false, volume: null, muted: null };
  }

  async ensureAudioSession(cx) {
    if (settings().sounds?.enabled === false) return false;
    playSound("sounds/silence.mp3");
    await this.delay(cx, 350);
    return true;
  }

  syncVolume(cx) {
    if (window()?.platform !== "windows" || this.syncedVolume) return;
    this.syncedVolume = true;
    cx.spawn(async (cx) => {
      try {
        let state = await this.runVolumeScript("get");
        if (!state.found && await this.ensureAudioSession(cx)) {
          state = await this.runVolumeScript("get");
        }
        if (state.found && state.volume !== null) {
          const vol = clampVolume(state.volume);
          this.volume = vol;
          this.volumeState?.set_value(vol);
          setShared("sounds.volume", vol);
          cx.notify();
        }
      } catch {
        // Keep fallback shared volume if Windows audio endpoint is unavailable.
      }
    });
  }

  applyVolume(level, cx) {
    if (window()?.platform !== "windows") return;
    this.pendingVolume = clampVolume(level);
    if (this.applyingVolume) return;
    this.applyingVolume = true;
    cx.spawn(async (cx) => {
      try {
        while (this.pendingVolume !== null) {
          const next = this.pendingVolume;
          this.pendingVolume = null;
          let state = await this.runVolumeScript("set", next);
          if (!state.found && await this.ensureAudioSession(cx)) {
            state = await this.runVolumeScript("set", next);
          }
        }
      } catch (error) {
        notify({ title: "Could not change volume", body: String(error), level: "error" });
      } finally {
        this.applyingVolume = false;
        cx.notify();
      }
    });
  }

  toggleMute(cx) {
    if (this.muting) return;
    this.muting = true;
    cx.notify();
    cx.spawn(async (cx) => {
      let enabledNow = false;
      try {
        const path = `${appHome()}\\settings.json`;
        const previous = await readTextFile(path);
        const config = previous === null ? {} : JSON.parse(previous);
        enabledNow = config.sounds?.enabled === false;
        config.sounds = { ...config.sounds, enabled: enabledNow };
        await writeTextFile(path, JSON.stringify(config, null, 2) + "\n", previous);
      } catch (error) {
        notify({ title: "Could not change mute", body: String(error), level: "error" });
        enabledNow = false;
      } finally { this.muting = false; cx.notify(); }
      if (enabledNow && typeof this.volume === "number") {
        this.applyVolume(this.volume, cx);
      }
    });
  }

  button(id, label, action) {
    const t = theme();
    return div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action).child(label);
  }
  render() {
    const t = theme();
    const collapsed = narrow();
    if (props()?.footer) {
      const muted = settings().sounds?.enabled === false;
      const showVolume = !collapsed && window()?.platform === "windows" && Boolean(this.volumeState);
      const vol = this.volume ?? 100;
      const row = (id, icon, label, dim, action) => h_flex().id(id).h(28).px(8).gap(9).items_center().rounded(8)
        .when(collapsed, el => el.relative().w(32).px(0).justify_center().tooltip(label))
        .text_color(dim ? t.dim : t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
        .on_click(action).child(svg(`mods/personal-chrome/${icon}.svg`).size(14))
        .when(!collapsed, el => el.child(label));
      const ready = div().size(6).rounded_full().bg(t.accent);
      const volumeSlider = showVolume
        ? div().id("sound-volume").w(76).flex_none().flex().items_center()
            .tooltip(`Alert volume: ${vol}%`)
            .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
            .child(
              Slider.new(this.volumeState).w_full().child(
                SliderTrack.new(this.volumeState)
                  .flex().items_center().h(26).w_full().px(6).cursor_pointer()
                  .child(
                    SliderIndicator.new(this.volumeState)
                      .relative().w_full().h(4).rounded(2).bg(t.border)
                      .range_style((fill) => fill.rounded(2).bg(muted ? t.dim : t.accent))
                      .child(
                        SliderThumb.new(this.volumeState)
                          .id("sound-volume-thumb")
                          .size(12).rounded(6)
                          .bg(muted ? t.muted : t.foreground)
                          .ml(-6).mt(-4)
                      )
                  )
              )
            )
        : null;
      return v_flex().size_full().bg(t.chrome).border_t(1).border_color(t.border).px(8).pt(4).pb(8).text_size(13)
        .when(collapsed, el => el.px(0).items_center())
        .child(h_flex().w_full().items_center().when(collapsed, el => el.flex_col(), el => el.gap(4))
          .child(row("settings", "settings", "Settings", false, () => run("mod.open", { name: "sound-library" }))
            .when(!collapsed, el => el.flex_1().min_w(0))
            .when(Boolean(updates().app.ready), el => el.child(collapsed ? ready.absolute().top(5).right(6) : ready)))
          .when(Boolean(volumeSlider), el => el.child(volumeSlider))
          .child(this.button("mute-sounds", svg(`mods/personal-chrome/${muted ? "speaker-off" : "speaker-on"}.svg`).size(16),
            (_e, cx) => this.toggleMute(cx))
            .tooltip(muted ? "Unmute Herdr alerts" : "Mute Herdr alerts")
            .text_color(muted ? t.blocked : t.muted)
            .opacity(this.muting ? 0.5 : 1)))
        .child(row("machine", "plus", "Add machine", true, () => run("mod.open", { name: "machine-add" })));
    }
    return h_flex().size_full().bg(t.chrome).pl(collapsed ? 6 : 14).pr(10).gap(4).items_center().text_size(13.5)
      .when(window()?.platform === "macos" && !window()?.fullscreen && !collapsed, el => el.pl(76))
      .when(!collapsed, el => el.child(h_flex().flex_1().gap(8).items_center().child(image("frame/welcome/herdr.png").size(20).rounded(5)).child(div().font_semibold().text_color(t.foreground).child("Herdr"))))
      .when(!collapsed, el => el.child(this.button("search", svg("mods/personal-chrome/search.svg").size(15), () => run("mod.open", { name: "picker" }))))
      // On the macOS rail the traffic lights fill the row; the agents list's » unfolds it.
      .when(!(collapsed && window()?.platform === "macos"), el => el.child(this.button("sidebar-toggle", svg("mods/personal-chrome/sidebar.svg").size(15), toggleSidebar)));
  }
}
