const MACHINE_PREFIX_RE = /^([^/\\\s]+)\/(.+)$/;
const TREEHOUSE_PATH_RE = /(?:^|[\\/])\.treehouse(?:[\\/]|$)/i;
const WORKER_BRANCH_RE = /^fm\//i;
const WORKER_ID_RE = /^(?:fm-|[a-z0-9][a-z0-9_-]*-fm-)/i;
const STATUS_PREFIX_RE = /^(?:\[\s*[.!]\s*\]\s*|[✋⏳]\uFE0F?\s+|(?!(?:\p{Emoji}\uFE0F|[#*]\u20E3))[^\p{L}\p{N}\p{Ps}\p{Pi}\p{Emoji_Presentation}/\\.]+\s*)*/u;
const WORKER_TITLE_PREFIX_RE = /^fm[/-]/i;
const WORKER_APP_RE = /^firstmate-/i;

/**
 * Strip an optional `<machine>/` prefix from a Herdr space/tab/terminal ID.
 * Leaves filesystem paths starting with `/` or drive letters intact.
 */
export function stripMachinePrefix(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || /^[\\/]/.test(trimmed) || /^[a-zA-Z]:[\\/]/.test(trimmed)) return trimmed;
  const match = MACHINE_PREFIX_RE.exec(trimmed);
  return match ? match[2] : trimmed;
}

export function stripStatusPrefix(text) {
  return typeof text === "string" ? text.trim().replace(STATUS_PREFIX_RE, "") : "";
}

export function isTreehousePath(value) {
  return typeof value === "string" && TREEHOUSE_PATH_RE.test(value.trim());
}

export function isWorkerBranch(branch) {
  return typeof branch === "string" && WORKER_BRANCH_RE.test(branch.trim());
}

export function isWorkerId(id) {
  const bare = stripMachinePrefix(id);
  return Boolean(bare) && WORKER_ID_RE.test(bare);
}

export function isWorkerTitleOrName(text) {
  const cleaned = stripStatusPrefix(text);
  return Boolean(cleaned) && WORKER_TITLE_PREFIX_RE.test(cleaned);
}

export function isWorkerApp(app) {
  return typeof app === "string" && WORKER_APP_RE.test(app.trim());
}

function isWorkerLabels(labels) {
  if (!labels || typeof labels !== "object") return false;
  return isWorkerId(labels["herdr.tab"]) || isWorkerId(labels["herdr.space"]);
}

export function extractWorkerTaskName({ branches = [], tabIds = [], names = [], titles = [] } = {}) {
  for (const branch of branches) {
    if (!isWorkerBranch(branch)) continue;
    const task = branch.trim().replace(WORKER_BRANCH_RE, "").trim();
    if (task) return task;
  }
  for (const candidate of tabIds) {
    const bare = stripMachinePrefix(candidate);
    if (!bare) continue;
    if (/^fm-/i.test(bare)) {
      const task = bare.slice(3).trim();
      if (task) return task;
    }
    const marker = bare.toLowerCase().indexOf("-fm-");
    if (marker >= 0) {
      const task = bare.slice(marker + 4).trim();
      if (task) return task;
    }
  }
  for (const text of [...names, ...titles]) {
    if (!isWorkerTitleOrName(text)) continue;
    const task = stripStatusPrefix(text).replace(WORKER_TITLE_PREFIX_RE, "").trim();
    if (task) return task;
  }
  return null;
}

/**
 * Inspect the active space/tab/pane/agent/terminal/focused snapshot and determine
 * whether the focused target belongs to a spawned Firstmate worker.
 */
export function detectWorkerContext(ctx = {}) {
  const { space, tab, pane, agent, terminal, focused } = ctx;
  const reasons = [];

  const pathCandidates = [
    ["pane.cwd", pane?.cwd],
    ["terminal.cwd", terminal?.cwd],
    ["focused.cwd", focused?.cwd],
    ["space.folder", space?.folder],
  ];
  for (const [source, value] of pathCandidates) {
    if (isTreehousePath(value)) reasons.push(source);
  }

  if (isWorkerBranch(pane?.branch)) reasons.push("pane.branch");

  if (isWorkerLabels(terminal?.labels)) reasons.push("terminal.labels");

  const idCandidates = [
    ["tab.id", tab?.id],
    ["space.id", space?.id],
    ["pane.tab", pane?.tab],
    ["agent.tab", agent?.tab],
    ["agent.space", agent?.space],
  ];
  for (const [source, value] of idCandidates) {
    if (isWorkerId(value)) reasons.push(source);
  }

  const nameCandidates = [
    ["pane.name", pane?.name],
    ["pane.title", pane?.title],
    ["agent.pane_name", agent?.pane_name],
    ["agent.title", agent?.title],
    ["terminal.name", terminal?.name],
    ["terminal.title", terminal?.title],
    ["tab.name", tab?.name],
  ];
  for (const [source, value] of nameCandidates) {
    if (isWorkerTitleOrName(value)) reasons.push(source);
  }

  if (isWorkerApp(pane?.app)) reasons.push("pane.app");
  if (isWorkerApp(agent?.app)) reasons.push("agent.app");
  if (isWorkerApp(terminal?.report?.app)) reasons.push("terminal.report.app");

  const taskName = reasons.length > 0
    ? extractWorkerTaskName({
        branches: [pane?.branch],
        tabIds: [terminal?.labels?.["herdr.tab"], tab?.id, pane?.tab, agent?.tab],
        names: [pane?.name, agent?.pane_name, terminal?.name, tab?.name],
        titles: [pane?.title, agent?.title, terminal?.title],
      })
    : null;

  return {
    isWorker: reasons.length > 0,
    reasons,
    taskName: taskName || null,
  };
}

/**
 * Resolve the currently focused space, tab, pane, agent, and terminal from Herdr live state.
 */
export function resolveActiveContext({ spaces = [], panes = [], agents = [], terminals = [], focused = null } = {}) {
  const isStandalone = Boolean(focused && !focused.pane && (focused.terminal || focused.agent));
  const isShownReplacement = Boolean(focused?.shown && focused.shown !== focused.terminal);
  if (isStandalone || isShownReplacement) {
    const addr = focused?.shown || focused?.terminal || focused?.agent || null;
    const terminal = addr ? (terminals.find((t) => t.address === addr) ?? null) : null;
    const agent = addr ? (agents.find((a) => a.address === addr) ?? null) : null;
    return { space: null, tab: null, pane: null, agent, terminal, focused };
  }

  const space = (focused?.space ? spaces.find((s) => s.id === focused.space) : null)
    ?? spaces.find((s) => s.active)
    ?? null;
  const spaceTabs = space?.tabs ?? [];
  const tab = (focused?.tab ? spaceTabs.find((t) => t.id === focused.tab) : null)
    ?? spaceTabs.find((t) => t.active)
    ?? null;
  const pane = focused?.pane
    ? (panes.find((p) => p.pane === focused.pane) ?? null)
    : (tab ? (panes.find((p) => p.tab === tab.id && p.focused) ?? panes.find((p) => p.tab === tab.id)) : null) ?? null;
  const addr = focused?.terminal ?? pane?.terminal ?? focused?.agent ?? null;
  const terminal = addr ? (terminals.find((t) => t.address === addr) ?? null) : null;
  let agent = null;
  if (addr) {
    agent = agents.find((a) => a.address === addr) ?? null;
  } else if (pane) {
    agent = agents.find((a) => a.pane === pane.pane) ?? null;
  } else {
    agent = agents.find((a) => a.focused) ?? null;
  }

  return { space, tab, pane, agent, terminal, focused };
}
