import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { readdir, unlink } from "fs/promises";
import { appHome, exec, readTextFile, writeTextFile, playSound, theme, settings } from "herdr";

export default class SoundLibrary extends View {
  init(_props, cx) {
    this.items = [];
    this.busy = false;
    this.importing = false;
    this.error = "";
    this.removing = null;
    this.loading = true;
    cx.spawn(async (cx) => {
      try { await this.library("list"); }
      catch (error) { this.error = error.message ?? String(error); }
      finally { this.loading = false; cx.notify(); }
    });
  }

  folder() { return `${appHome()}\\sounds\\library`; }

  async library(action, paths = []) {
    if (action === "list") {
      const names = await readdir(this.folder());
      this.items = names.filter(name => /\.mp3$/i.test(name)).map(name => ({
        name: name.replace(/^[a-f0-9]{32}--/, "").replace(/\.mp3$/i, ""),
        path: `${this.folder()}\\${name}`
      })).sort((a, b) => a.name.localeCompare(b.name));
      return;
    }
    if (action === "remove") {
      for (const path of paths) {
        if (!this.items.some(item => item.path === path)) throw new Error("This file is not in the sound library.");
        await unlink(path);
        this.items = this.items.filter(item => item.path !== path);
      }
      return;
    }
    const result = await exec("powershell.exe", [
      "-NoProfile", "-STA", "-File", `${appHome()}\\mods\\sound-library\\library.ps1`,
      "-Action", action, "-PathsJson", JSON.stringify(paths)
    ], { timeout: 600000 });
    if (result.code !== 0) throw new Error(result.stderr.trim() || "Sound library operation failed.");
    this.items = JSON.parse(result.stdout.replace(/^\uFEFF/, "").trim()).sort((a, b) => a.name.localeCompare(b.name));
  }

  perform(cx, action) {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    cx.notify();
    cx.spawn(async (cx) => {
      try { await action(); }
      catch (error) { this.error = error.message ?? String(error); }
      finally { this.busy = false; cx.notify(); }
    });
  }

  add(cx, paths = []) {
    if (this.importing || this.busy) return;
    this.importing = true;
    this.error = "";
    cx.notify();
    cx.spawn(async (cx) => {
      try { await this.library("import", paths); }
      catch (error) { this.error = error.message ?? String(error); }
      finally { this.importing = false; cx.notify(); }
    });
  }

  async update(change) {
    const path = `${appHome()}\\settings.json`;
    const previous = await readTextFile(path);
    const config = previous === null ? {} : JSON.parse(previous);
    config.sounds = { ...config.sounds };
    change(config.sounds);
    await writeTextFile(path, JSON.stringify(config, null, 2) + "\n", previous);
  }

  soundKey(path) {
    if (!path) return "";
    return (/^(?:[a-z]:[\\/]|\\\\)/i.test(path) ? path : `${appHome()}\\${path}`)
      .replace(/\//g, "\\").toLowerCase();
  }

  choose(cx, event, path) {
    this.perform(cx, () => this.update(sounds => {
      if (path === null) delete sounds[event];
      else {
        const home = appHome().replace(/\//g, "\\").toLowerCase();
        const norm = path.replace(/\//g, "\\");
        sounds[event] = norm.toLowerCase().startsWith(home + "\\")
          ? norm.slice(home.length + 1)
          : path;
      }
    }));
  }

  remove(cx, item) {
    if (this.importing) return;
    if (this.removing !== item.path) { this.removing = item.path; cx.notify(); return; }
    this.perform(cx, async () => {
      await this.update(sounds => {
        for (const event of ["done", "blocked"]) {
          if (this.soundKey(sounds[event]) === this.soundKey(item.path)) delete sounds[event];
        }
      });
      await this.library("remove", [item.path]);
      this.removing = null;
    });
  }

  render(cx) {
    const t = theme();
    const sounds = settings().sounds ?? {};
    const icon = name => svg(`mods/sound-library/${name}.svg`).size(14);
    const button = (id, label, action, selected = false, disabled = this.busy) => h_flex().id(id)
      .h(30).px(10).gap(6).items_center().justify_center().rounded(7)
      .border_1().border_color(selected ? t.accent : t.border)
      .bg(selected ? t.selected : t.raised).text_color(selected ? t.accent : t.foreground).cursor_pointer()
      .opacity(disabled ? 0.5 : 1).hover(s => s.bg(t.hover))
      .on_click((_e, cx) => { if (!disabled) action(cx); }).child(label);
    const nameFor = event => this.items.find(item => this.soundKey(item.path) === this.soundKey(sounds[event]))?.name
      ?? (sounds[event] ? sounds[event].split(/[\\/]/).pop() : "Herdr default");
    const assignment = (event, label, color) => v_flex().flex_1().min_w(0).p(14).gap(10)
      .rounded(10).border_1().border_color(t.border).bg(t.background)
      .child(h_flex().gap(7).items_center()
        .child(div().size(6).rounded_full().bg(color))
        .child(div().text_size(11).font_semibold().text_color(t.muted).child(label)))
      .child(div().text_size(15).font_medium().truncate().tooltip(sounds[event] ?? "Herdr's bundled alert").child(nameFor(event)))
      .child(h_flex().gap(8).items_center()
        .child(button(`current-${event}`, "Preview", () => playSound(event)).child(icon("play")))
        .when(Boolean(sounds[event]), el => el.child(div().id(`reset-${event}`).px(6).py(7)
          .text_color(t.muted).cursor_pointer().hover(s => s.text_color(t.foreground))
          .on_click((_e, cx) => { if (!this.busy) this.choose(cx, event, null); }).child("Use default"))));
    const descriptions = {
      "Soft Chime": "Gentle two-note chime",
      "Arcade Win": "A little victory fanfare",
      "Radar Ping": "Two clear, short pings",
      "Tiny Alarm": "A more insistent nudge"
    };
    const cell = (width, child) => div().w(width).flex_none().child(child);
    const row = item => h_flex().id(`sound-row-${item.path}`).gap(8).items_center().py(10)
      .border_b(1).border_color(t.border)
      .child(button(`preview-${item.path}`, icon("play"), () => playSound(item.path)).w(30).px(0).tooltip(`Preview ${item.name}`))
      .child(v_flex().flex_1().min_w(0).gap(3)
        .child(div().text_size(13).font_medium().truncate().tooltip(item.path).child(item.name))
        .child(div().text_size(11).text_color(t.dim).child(descriptions[item.name] ?? "Imported MP3")))
      .child(cell(66, button(`done-${item.path}`, "Done", cx => this.choose(cx, "done", item.path),
        this.soundKey(sounds.done) === this.soundKey(item.path)).w_full()))
      .child(cell(88, button(`blocked-${item.path}`, "Attention", cx => this.choose(cx, "blocked", item.path),
        this.soundKey(sounds.blocked) === this.soundKey(item.path)).w_full()))
      .child(cell(60, button(`remove-${item.path}`, this.removing === item.path ? "Delete?" : icon("trash"),
        cx => this.remove(cx, item), false, this.busy || this.importing).w_full().text_color(this.removing === item.path ? t.blocked : t.dim)
        .tooltip(this.removing === item.path ? "Click again to delete the library copy" : "Remove from library")));
    return v_flex().id("sound-library").size_full().min_h(0).gap(14)
      .text_color(t.foreground).text_size(12)
      .on_drop((event, cx) => this.add(cx, event.paths))
      .child(h_flex().gap(8).items_center()
        .child(v_flex().flex_1().gap(6)
          .child(div().text_size(22).font_semibold().child("Alert sounds"))
          .child(div().text_color(t.muted).child("A little signal when your agents finish or need you.")))
        .child(button("sound-enabled", sounds.enabled === false ? "Muted - enable" : "Sounds on",
          cx => this.perform(cx, () => this.update(s => { s.enabled = s.enabled === false; })), sounds.enabled !== false)))
      .child(h_flex().gap(12)
        .child(assignment("done", "AGENT FINISHED", t.done))
        .child(assignment("blocked", "NEEDS ATTENTION", t.blocked)))
      .child(h_flex().gap(8).items_center()
        .child(div().text_size(14).font_semibold().child("Sound library"))
        .child(div().px(7).py(2).rounded(5).bg(t.raised).text_color(t.muted).child(String(this.items.length)))
        .child(div().flex_1())
        .child(button("sound-import", this.importing ? "Adding sounds..." : "Add sounds",
          cx => this.add(cx), true, this.busy || this.importing).child(icon("upload"))))
      .when(sounds.enabled === false, el => el.child(div().text_color(t.blocked).child("Alerts and previews are muted. Enable sounds above to listen.")))
      .when(Boolean(this.error), el => el.child(h_flex().p(10).gap(8).rounded(8).border_1().border_color(t.blocked)
        .child(div().flex_1().min_w(0).text_color(t.blocked).truncate().tooltip(this.error).child(this.error))
        .child(div().id("dismiss-sound-error").px(4).text_color(t.muted).cursor_pointer()
          .on_click((_e, cx) => { this.error = ""; cx.notify(); }).child("Dismiss"))))
      .child(v_flex().id("sound-list").flex_1().min_h(0).overflow_y_scrollbar()
        .when(this.loading && !this.items.length, el => el.child(div().py(24).text_color(t.dim).child("Reading sound library...")))
        .when(!this.items.length && !this.busy && !this.loading, el => el.child(div().py(24).text_color(t.muted).child("Your library is empty. Add a sound to get started.")))
        .children(this.items.map(row)))
      .child(v_flex().gap(4)
        .child(div().text_color(t.muted).child("Drop MP3 files here, or choose Add sounds. Up to 20 MB per file."))
        .child(div().text_size(11).text_color(t.dim).child("Saved locally. Removing a library copy resets its alerts to default.")));
  }
}
