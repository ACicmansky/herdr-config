import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, agents, theme, run, window, keys, exec, shared, setShared, openOverlay, props, appHome } from "herdr";
import * as fs from "fs/promises";

function fmtCountdown(iso) {
  if (!iso) return "";
  const sec = Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
  if (sec <= 0) return "now";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtLocalReset(iso) {
  if (!iso) return "";
  const dt = new Date(iso);
  const diffH = (dt.getTime() - Date.now()) / 3600000;
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  if (diffH < 24) return `${hh}:${mm}`;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[dt.getDay()]} ${hh}:${mm}`;
}

function pctColor(t, pct) {
  if (pct <= 15) return t.blocked;
  if (pct <= 30) return t.working;
  return t.foreground;
}

export default class AgyStatus extends View {
  init(_p, cx) {
    this.loading = false;
    if (props()?.popup) return;
    this.refresh(cx);
    cx.timer.every(120000, (cx) => this.refresh(cx));
    cx.timer.every(30000, (cx) => cx.notify());
  }

  refresh(cx) {
    if (this.loading) return;
    this.loading = true;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const r = await exec("agy", ["-p", "/usage", "--output-format", "json"], { timeout: 25000 });
        if (r.code === 0 && r.stdout) {
          const line = r.stdout.trim().split("\n").find((l) => l.startsWith("{"));
          const parsed = JSON.parse(line || r.stdout);
          const groups = parsed?.command?.data?.groups;
          if (Array.isArray(groups)) {
            const payload = { updated_at: Date.now(), groups };
            setShared("agy.usage", payload);
            try {
              await fs.mkdir(`${appHome()}/data`, { recursive: true });
              await fs.writeFile(`${appHome()}/data/agy-quota.json`, JSON.stringify(payload, null, 2));
            } catch {}
          }
        }
      } catch {}
      this.loading = false;
      cx.notify();
    });
  }

  hint() {
    const mac = window()?.platform === "macos";
    const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+", option: mac ? "⌥" : "Alt+" };
    const b = keys().find((k) => k.section === "global" && k.action === "app.palette");
    const parts = b && b.keys.endsWith("--") ? [...b.keys.slice(0, -2).split("-"), "-"] : b?.keys.split("-");
    const key = parts && parts.map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("");
    return key ? `${key}  commands` : "commands";
  }

  renderPopup(t, cx) {
    const data = shared("agy.usage");
    const groups = data?.groups ?? [];
    return v_flex().size_full().p(12).gap(10).bg(t.popover).text_size(12).text_color(t.foreground)
      .child(
        h_flex().items_center().justify_between()
          .child(
            h_flex().gap(7).items_center()
              .child(image("icons/antigravity.svg").w(14).h(14))
              .child(div().font_semibold().text_size(12.5).child("Antigravity Limits & Resets"))
          )
          .child(
            div().id("agy-refresh").px(7).py(2).rounded(5).bg(t.surface).border(1).border_color(t.border)
              .text_size(11).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
              .on_click((_e, cx) => this.refresh(cx))
              .child(this.loading ? "Refreshing…" : "Refresh")
          )
      )
      .when(groups.length === 0, (el) =>
        el.child(div().py(16).text_color(t.dim).child(this.loading ? "Fetching live quota from agy…" : "No quota data yet. Click Refresh."))
      )
      .children(
        groups.map((g) =>
          v_flex().gap(6).p(8).rounded(7).bg(t.surface).border(1).border_color(t.border)
            .child(div().font_semibold().text_size(11.5).text_color(t.muted).child(g.name))
            .children(
              (g.buckets ?? []).map((b) => {
                const pct = Math.round((b.remaining_fraction ?? 0) * 100);
                const col = pctColor(t, pct);
                const cd = fmtCountdown(b.reset_time);
                const at = fmtLocalReset(b.reset_time);
                const barW = Math.max(4, Math.round((pct / 100) * 290));
                return v_flex().gap(3)
                  .child(
                    h_flex().items_center().justify_between().text_size(11.5)
                      .child(div().text_color(t.foreground).child(b.name.replace(" Remaining", "")))
                      .child(
                        h_flex().gap(6).items_center()
                          .child(div().font_semibold().text_color(col).child(`${pct}%`))
                          .when(Boolean(cd), (el) => el.child(div().text_size(10.8).text_color(t.dim).child(`resets in ${cd} (${at})`)))
                      )
                  )
                  .child(
                    div().w(290).h(5).rounded(3).bg(t.border)
                      .child(div().w(barW).h(5).rounded(3).bg(pct <= 15 ? t.blocked : pct <= 30 ? t.working : t.accent))
                  );
              })
            )
        )
      );
  }

  render(cx) {
    const t = theme();
    if (props()?.popup) return this.renderPopup(t, cx);
    const space = spaces().find((s) => s.active);
    const list = agents();
    const needs = list.filter((a) => a.status === "blocked").length;
    const label = (icon, text) => h_flex().gap(6).items_center().child(svg(`mods/workspace-chrome/${icon}.svg`).size(13)).child(text);

    const data = shared("agy.usage");
    const buckets = (data?.groups ?? []).flatMap((g) => g.buckets ?? []);
    const b5h = buckets.find((b) => b.id === "gemini-5h");
    const bWk = buckets.find((b) => b.id === "gemini-weekly");
    const bArgon = buckets.find((b) => b.id?.includes("argon"));
    const summary = [
      b5h && { label: "5h", b: b5h },
      bWk && { label: "Wk", b: bWk },
      bArgon && { label: "Argon", b: bArgon },
    ].filter(Boolean);

    return h_flex().size_full().px(14).gap(16).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
      .child(label(space?.machine ? "server" : "monitor", space?.machine ?? "This computer"))
      .when(Boolean(space?.branch), (el) => el.child(label("branch", space.branch)))
      .child(
        h_flex().gap(6).items_center().child(div().size(6).rounded(3).bg(t.dim)).child(`${list.length} agents`)
          .when(needs > 0, (el) => el.child(div().text_color(t.blocked).child(`· ${needs} needs you`)))
      )
      .child(div().flex_1())
      .child(
        h_flex().id("agy-limits").gap(8).px(8).h(22).rounded(5).items_center().cursor_pointer()
          .hover((s) => s.bg(t.hover))
          .tooltip("Click for Antigravity limits & reset times")
          .on_click(() => openOverlay({ mod: "agy-status", kind: "popup", width: 340, height: 310, props: { popup: true } }))
          .child(image("icons/antigravity.svg").w(13).h(13))
          .when(summary.length === 0, (el) => el.child(div().text_color(t.dim).child(this.loading ? "AGY…" : "AGY limits")))
          .children(
            summary.map(({ label: lbl, b }, i) => {
              const pct = Math.round((b.remaining_fraction ?? 0) * 100);
              const cd = fmtCountdown(b.reset_time);
              return h_flex().gap(4).items_center()
                .when(i > 0, (el) => el.child(div().text_color(t.dim).child("·")))
                .child(div().text_color(t.muted).child(`${lbl}:`))
                .child(div().font_medium().text_color(pctColor(t, pct)).child(`${pct}%`))
                .when(Boolean(cd), (el) => el.child(div().text_size(10.8).text_color(t.dim).child(`(${cd})`)));
            })
          )
      )
      .child(div().id("palette").text_color(t.dim).cursor_pointer().on_click(() => run("app.palette")).child(this.hint()));
  }
}
