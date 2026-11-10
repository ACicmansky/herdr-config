// Run with: node mods\sound-library\test.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { execFileSync, spawnSync } = require("node:child_process");
const path = require("node:path");

async function main() {
  let text = JSON.stringify({ zoom: 1.2, sounds: { enabled: false, blocked: "keep.mp3" } });
  let stale = false;
  const context = {
    View: class {},
    appHome: () => __dirname,
    readTextFile: async () => text,
    writeTextFile: async (_path, next, expected) => {
      if (stale || text !== expected) throw Error("stale snapshot");
      text = next;
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "sounds.js"), "utf8")
    .replace(/^import .*;\r?$/gm, "")
    .replace("export default class SoundLibrary", "globalThis.SoundLibrary = class SoundLibrary"), context);
  const library = new context.SoundLibrary();
  assert.equal(library.soundKey("audio\\test.mp3"), library.soundKey(`${__dirname}\\audio\\TEST.mp3`));
  await library.update(s => { s.done = "new.mp3"; });
  assert.deepEqual(JSON.parse(text), {
    zoom: 1.2, sounds: { enabled: false, blocked: "keep.mp3", done: "new.mp3" }
  });
  await library.update(s => { delete s.done; });
  assert.equal(JSON.parse(text).sounds.done, undefined);
  stale = true;
  await assert.rejects(library.update(s => { s.done = "lost.mp3"; }), /stale/);
  stale = false;
  text = "{invalid";
  await assert.rejects(library.update(() => {}));

  let helperCalls = 0;
  const removed = [];
  context.exec = async () => { helperCalls++; throw new Error("No process should be needed."); };
  context.readdir = async () => ["Beta.mp3", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa--Alpha.mp3", "ignored.txt"];
  context.unlink = async file => removed.push(file);
  const tasks = [];
  const loadContext = { notify() {}, spawn(action) { tasks.push(action(this)); } };
  library.init({}, loadContext);
  assert.equal(library.busy, false);
  await Promise.all(tasks);
  assert.equal(library.loading, false);
  assert.equal(library.items.map(item => item.name).join(","), "Alpha,Beta");
  assert.equal(helperCalls, 0);
  const first = library.items[0].path;
  await library.library("remove", [first]);
  assert.deepEqual(removed, [first]);
  assert.equal(library.items.length, 1);
  await assert.rejects(library.library("remove", ["outside.mp3"]), /not in the sound library/);
  assert.equal(helperCalls, 0);

  let finishImport;
  context.exec = () => new Promise(resolve => { finishImport = resolve; });
  const existingItems = library.items;
  const importTasks = [];
  library.add({ notify() {}, spawn(action) { importTasks.push(action(this)); } });
  assert.equal(library.importing, true);
  assert.equal(library.busy, false);
  assert.equal(library.items, existingItems, "Import must keep the existing list visible.");
  finishImport({ code: 0, stdout: JSON.stringify([{ name: "Added", path: "added.mp3" }]) });
  await Promise.all(importTasks);
  assert.equal(library.importing, false);
  assert.equal(library.items[0].name, "Added");

  context.InputState = { new: () => ({ on() {} }) };
  context.window = () => ({ platform: "windows" });
  context.props = () => ({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "main.js"), "utf8")
    .replace(/^import .*;\r?$/gm, "")
    .replace("export default class Settings", "globalThis.Settings = class Settings"), context);
  const personalSettings = new context.Settings();
  const retained = {};
  personalSettings.init({}, {
    new: view => { assert.equal(view, context.SoundLibrary); return retained; },
    focus_handle: () => ({ focus() {} }),
    timer: { every() {} },
    spawn() {}
  });
  assert.equal(personalSettings.section, "alerts");
  assert.equal(personalSettings.soundLibrary, retained);

  const errors = [];
  context.notify = error => errors.push(error);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "personal-chrome", "main.js"), "utf8")
    .replace(/^import .*;\r?$/gm, "")
    .replace("export default class WorkspaceChrome", "globalThis.WorkspaceChrome = class WorkspaceChrome"), context);
  const chrome = new context.WorkspaceChrome();
  let pending;
  const cx = { notify() {}, spawn: action => { pending = action(cx); } };
  text = JSON.stringify({ zoom: 1.2, sounds: { done: "keep.mp3", blocked: "also-keep.mp3" } });
  chrome.toggleMute(cx);
  chrome.toggleMute(cx);
  await pending;
  assert.deepEqual(JSON.parse(text), {
    zoom: 1.2, sounds: { done: "keep.mp3", blocked: "also-keep.mp3", enabled: false }
  });
  chrome.toggleMute(cx);
  await pending;
  assert.equal(JSON.parse(text).sounds.enabled, true);
  stale = true;
  chrome.toggleMute(cx);
  await pending;
  assert.equal(JSON.parse(text).sounds.enabled, true);
  assert.equal(errors.length, 1);
  assert.equal(chrome.muting, false);

  const script = path.join(__dirname, "library.ps1");
  const args = ["-NoProfile", "-File", script];
  const items = JSON.parse(execFileSync("powershell.exe", args, { encoding: "utf8" }).replace(/^\uFEFF/, ""));
  const unchanged = JSON.parse(execFileSync("powershell.exe", [...args, "-Action", "remove", "-PathsJson", "[]"],
    { encoding: "utf8" }).replace(/^\uFEFF/, ""));
  assert.deepEqual(unchanged, items);
  assert.ok(items.length >= 4);
  for (const item of items) {
    assert.ok(!item.path.includes("\\mods\\"), "Audio data must not trigger mod hot reload.");
    assert.ok(fs.statSync(item.path).size > 100);
    const bytes = fs.readFileSync(item.path);
    assert.ok(bytes.subarray(0, 3).toString() === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224));
  }
  const invalid = spawnSync("powershell.exe", [...args, "-Action", "import", "-PathsJson", JSON.stringify([__filename])]);
  assert.notEqual(invalid.status, 0);
  const outside = spawnSync("powershell.exe", [...args, "-Action", "remove", "-PathsJson", JSON.stringify([__filename])]);
  assert.notEqual(outside.status, 0);
  assert.ok(fs.existsSync(__filename));
  const copied = JSON.parse(execFileSync("powershell.exe", [...args, "-Action", "import", "-PathsJson", JSON.stringify([items[0].path, items[1].path])],
    { encoding: "utf8" }).replace(/^\uFEFF/, ""));
  const added = copied.filter(item => !items.some(original => original.path === item.path));
  assert.equal(added.length, 2);
  for (const item of added) {
    assert.deepEqual(fs.readFileSync(item.path), fs.readFileSync(items.find(original => original.name === item.name).path));
  }
  execFileSync("powershell.exe", [...args, "-Action", "remove", "-PathsJson", JSON.stringify(added.map(item => item.path))]);
  assert.ok(added.every(item => !fs.existsSync(item.path)));

  const fixtureDirectory = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "herdr-sound-test-"));
  const fixture = path.join(fixtureDirectory, "ID3v4 test's \u017e.mp3");
  const preset = fs.readFileSync(items.find(item => item.name === "Arcade Win").path);
  const tag = Buffer.from([73, 68, 51, 4, 0, 16, 0, 0, 0, 4]);
  const source = Buffer.concat([tag, Buffer.alloc(4), Buffer.alloc(10), preset]);
  let imported;
  try {
    fs.writeFileSync(fixture, source);
    const result = JSON.parse(execFileSync("powershell.exe", [...args, "-Action", "import", "-PathsJson", JSON.stringify([fixture])],
      { encoding: "utf8" }).replace(/^\uFEFF/, ""));
    imported = result.find(item => item.name === path.basename(fixture, ".mp3"));
    assert.ok(imported);
    assert.deepEqual(fs.readFileSync(imported.path), preset, "Only ID3v2.4 metadata should be removed.");
    assert.deepEqual(fs.readFileSync(fixture), source, "The original file must remain untouched.");
    fs.writeFileSync(fixture, tag);
    const incomplete = spawnSync("powershell.exe", [...args, "-Action", "import", "-PathsJson", JSON.stringify([fixture])]);
    assert.notEqual(incomplete.status, 0);
    assert.match(incomplete.stderr.toString(), /metadata is incomplete/);
  } finally {
    if (imported) execFileSync("powershell.exe", [...args, "-Action", "remove", "-PathsJson", JSON.stringify([imported.path])]);
    fs.unlinkSync(fixture);
    fs.rmdirSync(fixtureDirectory);
  }
  console.log("Sound library checks passed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
