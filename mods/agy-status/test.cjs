// Run with: node mods/agy-status/test.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

function createElementStub(tag) {
  const node = { tag, props: {}, children: [], text: [] };
  const proxy = new Proxy(node, {
    get(target, prop) {
      if (prop === "when") {
        return (cond, fn) => {
          if (cond) fn(proxy);
          return proxy;
        };
      }
      if (prop === "child") {
        return (item) => {
          if (typeof item === "string") target.text.push(item);
          else if (item) target.children.push(item);
          return proxy;
        };
      }
      if (prop === "children") {
        return (items) => {
          for (const item of items) {
            if (typeof item === "string") target.text.push(item);
            else if (item) target.children.push(item);
          }
          return proxy;
        };
      }
      if (prop === "id") {
        return (val) => {
          target.elementId = val;
          return proxy;
        };
      }
      if (prop === "tag" || prop === "props" || prop === "text" || prop === "elementId" || prop === "_children") {
        return prop === "_children" ? target.children : target[prop];
      }
      return (...args) => {
        target.props[prop] = args.length <= 1 ? args[0] : args;
        return proxy;
      };
    },
  });
  return proxy;
}

function collectNodes(node, out = []) {
  if (!node || typeof node !== "object") return out;
  out.push(node);
  for (const child of node._children ?? []) collectNodes(child, out);
  return out;
}

async function main() {
  const worker = await import(pathToFileURL(path.join(__dirname, "worker.js")).href);

  // 1. Primary Firstmate session must NOT be flagged as a worker.
  const primarySpace = {
    id: "wsl/sp657084453db4e9666f5138f3bb1317d2",
    name: "Firstmate",
    folder: "/home/andrej/src/firstmate",
    machine: "wsl",
    branch: "main",
    active: true,
    tabs: [
      { id: "wsl/tb7228dfd6c888c505258786d3b83e2a38", name: "Captain quarters", active: true },
      { id: "wsl/tbf1b4aae07e88065ca7218978e46b27d9", name: "Deck", active: false },
    ],
  };
  const primaryPane = {
    pane: "wsl/p7bcf688c2c8c34cce9fd94a27d150035",
    terminal: "wsl/t4",
    tab: "wsl/tb7228dfd6c888c505258786d3b83e2a38",
    title: "Antigravity",
    name: null,
    cwd: "/home/andrej/src/firstmate",
    branch: "main",
    status: "working",
    app: "antigravity",
    focused: true,
  };
  const primaryAgent = {
    address: "wsl/t4",
    pane: primaryPane.pane,
    space: primarySpace.id,
    space_name: "Firstmate",
    tab: primaryPane.tab,
    tab_name: "Captain quarters",
    status: "working",
    app: "antigravity",
    title: "Antigravity",
    pane_name: null,
    focused: true,
  };
  const primaryRes = worker.detectWorkerContext({
    space: primarySpace,
    tab: primarySpace.tabs[0],
    pane: primaryPane,
    agent: primaryAgent,
    terminal: { address: "wsl/t4", labels: { "herdr.space": "sp657084453db4e9666f5138f3bb1317d2", "herdr.tab": "tb7228dfd6c888c505258786d3b83e2a38" }, cwd: "/home/andrej/src/firstmate" },
    focused: { space: primarySpace.id, tab: primaryPane.tab, pane: primaryPane.pane, terminal: "wsl/t4", cwd: "/home/andrej/src/firstmate" },
  });
  assert.equal(primaryRes.isWorker, false);
  assert.deepEqual(primaryRes.reasons, []);

  // 2. Ordinary terminal in a normal repo must NOT be flagged as a worker,
  //    including when space.branch is fm/* (Tab 1) while Tab 2 is on main,
  //    or when unrelated labels / Windows paths / bracketed titles are present.
  const ordinaryRes = worker.detectWorkerContext({
    space: { id: "spb39fa5e5a359c4149ca730b5a27d8acb", name: "herdr-app", folder: "C:\\Users\\Andrej\\.config\\herdr-app", branch: "fm/herdr-worker-badge-and-docs", active: true },
    tab: { id: "tb0cf18c29a0932be398411778be6dc75d", name: "1", active: true },
    pane: { pane: "p1", terminal: "t7", tab: "tb0cf18c29a0932be398411778be6dc75d", title: "pwsh", name: null, cwd: "C:\\Users\\Andrej\\.config\\herdr-app", branch: "main", app: null, focused: true },
    terminal: { address: "t7", labels: { repo: "acme/fm-radio", project: "last-fm-api" } },
    focused: { space: "spb39fa5e5a359c4149ca730b5a27d8acb", tab: "tb0cf18c29a0932be398411778be6dc75d", pane: "p1", terminal: "t7", cwd: "C:\\Users\\Andrej\\.config\\herdr-app" },
  });
  assert.equal(ordinaryRes.isWorker, false);

  for (const nonWorkerTitle of [".\\fm-project", "..\\fm-project", "\\fm-project", "/fm-project", "[fm-config]", "(fm/docs)"]) {
    assert.equal(worker.isWorkerTitleOrName(nonWorkerTitle), false, `Expected ${nonWorkerTitle} not to match worker title`);
  }
  assert.equal(worker.isWorkerBranch("fm-radio"), false);
  assert.equal(worker.isWorkerApp("firstmate_custom"), false);

  // 3. Firstmate worker via space/tab fm-* IDs, fm/* branch, and .treehouse/ path.
  const workerSpace = {
    id: "wsl/fm-firstmate-b123951d",
    name: "herdr-config",
    folder: "/home/andrej/src/firstmate/projects/herdr-config",
    machine: "wsl",
    branch: "fm/herdr-worker-badge-and-docs",
    active: false,
    tabs: [
      { id: "wsl/firstmate-b123951d-fm-herdr-worker-badge-and-docs", name: "1", active: true },
      { id: "wsl/firstmate-b123951d-fm-wow-agents-and-skills", name: "2", active: false },
    ],
  };
  const workerPane = {
    pane: "wsl/p540ecc0c4357e2e63f8b356e7fca7952",
    terminal: "wsl/t4g",
    tab: "wsl/firstmate-b123951d-fm-herdr-worker-badge-and-docs",
    title: "✦ Working",
    name: null,
    cwd: "/home/andrej/.treehouse/herdr-config-4b83f9/1/herdr-config",
    branch: "fm/herdr-worker-badge-and-docs",
    status: "working",
    app: "firstmate-agy",
    focused: true,
  };
  const workerRes = worker.detectWorkerContext({
    space: workerSpace,
    tab: workerSpace.tabs[0],
    pane: workerPane,
    terminal: { address: "wsl/t4g", labels: { "herdr.space": "fm-firstmate-b123951d", "herdr.tab": "firstmate-b123951d-fm-herdr-worker-badge-and-docs" } },
  });
  assert.equal(workerRes.isWorker, true);
  assert.equal(workerRes.taskName, "herdr-worker-badge-and-docs");
  assert.ok(workerRes.reasons.includes("pane.cwd"));
  assert.ok(workerRes.reasons.includes("pane.branch"));
  assert.ok(workerRes.reasons.includes("tab.id"));
  assert.ok(workerRes.reasons.includes("space.id"));
  assert.ok(workerRes.reasons.includes("terminal.labels"));

  // 4. Detection via .treehouse/ path alone (even Windows UNC backslash path & unnamed tab).
  const treehouseOnly = worker.detectWorkerContext({
    space: { id: "sp123", name: "work", folder: "C:\\src" },
    tab: { id: "tb123", name: "1" },
    pane: { pane: "p9", terminal: "t9", tab: "tb123", cwd: "\\\\wsl.localhost\\Ubuntu\\home\\andrej\\.treehouse\\repo-1\\1\\repo", title: "bash", branch: "main" },
  });
  assert.equal(treehouseOnly.isWorker, true);
  assert.deepEqual(treehouseOnly.reasons, ["pane.cwd"]);

  // 5. Detection via fm-* title/name with status glyph prefix or herdr.tab label,
  //    and non-shadowing taskName extraction when earlier candidates are generic/bare.
  const titleWorker = worker.detectWorkerContext({
    pane: { pane: "p10", terminal: "t10", title: "✦ Working", cwd: "/tmp" },
    terminal: { address: "t10", name: "t10", title: "✦ fm-fix-tests" },
    tab: { id: "tb10", name: "fm-tab-task" },
  });
  assert.equal(titleWorker.isWorker, true);
  assert.equal(titleWorker.taskName, "tab-task");

  const barePrefixFallback = worker.detectWorkerContext({
    pane: { pane: "p10b", branch: "fm/", title: "fm-" },
    tab: { id: "tb10b", name: "fm-real-task" },
  });
  assert.equal(barePrefixFallback.taskName, "real-task");

  const labelWorker = worker.detectWorkerContext({
    terminal: { address: "t11", labels: { "herdr.tab": "fm-audit-logs" } },
  });
  assert.equal(labelWorker.isWorker, true);
  assert.equal(labelWorker.taskName, "audit-logs");

  // 6. Focus resolution: standalone peek / shown replacement / non-agent pane must not cross-contaminate.
  const peekNonWorker = worker.resolveActiveContext({
    spaces: [workerSpace],
    panes: [workerPane],
    agents: [{ address: "wsl/t4g", pane: workerPane.pane, space: workerSpace.id, tab: workerPane.tab, app: "firstmate-agy", focused: true }],
    terminals: [{ address: "wsl/t-plain", cwd: "/tmp", labels: {} }],
    focused: { space: workerSpace.id, tab: workerPane.tab, pane: null, terminal: "wsl/t-plain", shown: null, agent: null, cwd: "/tmp" },
  });
  assert.equal(worker.detectWorkerContext(peekNonWorker).isWorker, false);

  const peekWorker = worker.resolveActiveContext({
    spaces: [primarySpace],
    panes: [primaryPane],
    agents: [primaryAgent, { address: "wsl/t4g", pane: workerPane.pane, space: workerSpace.id, tab: workerPane.tab, app: "firstmate-agy", focused: false }],
    terminals: [{ address: "wsl/t4g", cwd: workerPane.cwd, labels: { "herdr.tab": "firstmate-b123951d-fm-peeked" } }],
    focused: { space: primarySpace.id, tab: primaryPane.tab, pane: null, terminal: "wsl/t4g", shown: null, agent: "wsl/t4g", cwd: workerPane.cwd },
  });
  assert.equal(worker.detectWorkerContext(peekWorker).isWorker, true);
  assert.equal(worker.detectWorkerContext(peekWorker).taskName, "peeked");

  const shownPlainOnWorkerPane = worker.resolveActiveContext({
    spaces: [workerSpace],
    panes: [workerPane],
    agents: [{ address: "wsl/t4g", pane: workerPane.pane, space: workerSpace.id, tab: workerPane.tab, app: "firstmate-agy", focused: true }],
    terminals: [{ address: "wsl/t-shown", cwd: "/tmp", labels: {} }],
    focused: { space: workerSpace.id, tab: workerPane.tab, pane: workerPane.pane, terminal: "wsl/t4g", shown: "wsl/t-shown", agent: null, cwd: "/tmp" },
  });
  assert.equal(worker.detectWorkerContext(shownPlainOnWorkerPane).isWorker, false);

  const modPaneWithFocusedAgentElsewhere = worker.resolveActiveContext({
    spaces: [primarySpace],
    panes: [{ pane: "p-mod", terminal: null, mod: "files", tab: primaryPane.tab, title: "Files", focused: true }],
    agents: [{ address: "wsl/t4g", pane: workerPane.pane, space: workerSpace.id, tab: workerPane.tab, app: "firstmate-agy", focused: true }],
    terminals: [],
    focused: { space: primarySpace.id, tab: primaryPane.tab, pane: "p-mod", terminal: null, shown: null, agent: null, cwd: null },
  });
  assert.equal(worker.detectWorkerContext(modPaneWithFocusedAgentElsewhere).isWorker, false);

  // 7. Integration test of AgyStatus render() via vm (matching sound-library/test.cjs style).
  let mockSpaces = [primarySpace, workerSpace];
  let mockAgents = [
    primaryAgent,
    { address: "wsl/t4g", pane: workerPane.pane, space: workerSpace.id, tab: workerPane.tab, status: "working", app: "firstmate-agy" },
  ];
  let mockPanes = [primaryPane, workerPane];
  let mockTerminals = [];
  let mockFocused = { space: primarySpace.id, tab: primaryPane.tab, pane: primaryPane.pane, terminal: "wsl/t4", cwd: "/home/andrej/src/firstmate" };

  const sharedStore = {
    "agy.usage": {
      updated_at: Date.now(),
      groups: [{ name: "Gemini", buckets: [{ id: "gemini-5h", name: "5h Remaining", remaining_fraction: 0.85 }] }],
    },
  };
  const context = {
    View: class {},
    div: () => createElementStub("div"),
    svg: () => createElementStub("svg"),
    image: () => createElementStub("image"),
    h_flex: () => createElementStub("h_flex"),
    v_flex: () => createElementStub("v_flex"),
    spaces: () => mockSpaces,
    agents: () => mockAgents,
    panes: () => mockPanes,
    terminals: () => mockTerminals,
    focused: () => mockFocused,
    theme: () => ({
      chrome: "#18181b",
      border: "#27272a",
      foreground: "#fafafa",
      muted: "#a1a1aa",
      dim: "#71717a",
      hover: "#27272a",
      working: "#e5c07b",
      blocked: "#e06c75",
      accent: "#61afef",
      popover: "#18181b",
      surface: "#27272a",
    }),
    run: () => null,
    window: () => ({ platform: "windows" }),
    keys: () => [{ section: "global", action: "app.palette", keys: "ctrl-shift-p" }],
    exec: async () => ({ code: 0, stdout: "", stderr: "" }),
    shared: (k) => sharedStore[k],
    setShared: (k, v) => { sharedStore[k] = v; },
    openOverlay: () => "ov1",
    props: () => ({}),
    appHome: () => __dirname,
    checking: () => false,
    fs: { mkdir: async () => {}, writeFile: async () => {} },
    ...worker,
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "main.js"), "utf8")
      .replace(/^import .*;\r?$/gm, "")
      .replace("export default class AgyStatus", "globalThis.AgyStatus = class AgyStatus"),
    context
  );

  const statusBar = new context.AgyStatus();
  statusBar.loading = false;

  // Primary Firstmate focused: worker badge must NOT render, while AGY quota must render.
  const primaryTree = collectNodes(statusBar.render({}));
  assert.equal(primaryTree.some((n) => n.elementId === "fm-worker-badge"), false);
  assert.ok(primaryTree.some((n) => n.elementId === "agy-limits"));
  assert.ok(primaryTree.some((n) => (n.text ?? []).includes("85%")));

  // Switch focus to worker pane: badge MUST render prominently.
  mockSpaces = [{ ...primarySpace, active: false }, { ...workerSpace, active: true }];
  mockFocused = { space: workerSpace.id, tab: workerPane.tab, pane: workerPane.pane, terminal: "wsl/t4g", cwd: workerPane.cwd };
  const workerTree = collectNodes(statusBar.render({}));
  const badge = workerTree.find((n) => n.elementId === "fm-worker-badge");
  assert.ok(badge, "Expected fm-worker-badge to render for worker pane");
  const badgeNodes = collectNodes(badge);
  assert.ok(badgeNodes.some((n) => (n.text ?? []).includes("WORKER · reply in Firstmate")));
  assert.match(badge.props.tooltip, /herdr-worker-badge-and-docs/);
  assert.ok(workerTree.some((n) => n.elementId === "agy-limits"));

  console.log("agy-status worker indicator checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
