const MACHINE_PREFIX_RE = /^([^/\\\s]+)\/(.+)$/;
const TREEHOUSE_PATH_RE = /(?:^|[\\/])\.treehouse(?:[\\/]|$)/i;
const WORKER_BRANCH_RE = /^fm[/-]/i;
const WORKER_ID_RE = /^(?:fm-|[a-z0-9][a-z0-9_-]*-fm-)/i;
const WORKER_TITLE_RE = /^(?:\[\s*[.!]\s*\]\s*|[^\p{L}\p{N}/]+\s*)?fm[/-]/iu;
const WORKER_APP_RE = /^firstmate[-_]/i;

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
  return typeof text === "string" && WORKER_TITLE_RE.test(text.trim());
}

export function isWorkerApp(app) {
  return typeof app === "string" && WORKER_APP_RE.test(app.trim());
}

function isWorkerLabels(labels) {
  if (!labels || typeof labels !== "object") return false;
  if (isWorkerId(labels["herdr.tab"]) || isWorkerId(labels["herdr.space"])) return true;
  for (const [key, rawVal] of Object.entries(labels)) {
    const k = String(key).toLowerCase();
    const v = rawVal == null ? "" : String(rawVal).trim();
    if (!v) continue;
    if ((k === "fm.role" || k === "firstmate.role") && /^worker$/i.test(v)) return true;
    if ((k === "fm.worker" || k === "firstmate.worker" || k === "fm.task") && !/^(?:0|false|no)$/i.test(v)) return true;
    if (isWorkerId(v) || isTreehousePath(v)) return true;
  }
  return false;
}

export function extractWorkerTaskName({ branch, tabId, herdrTabLabel, title, name } = {}) {
  if (isWorkerBranch(branch)) {
    return branch.trim().replace(/^fm[/-]/i, "");
  }
  for (const candidate of [herdrTabLabel, tabId]) {
    const bare = stripMachinePrefix(candidate);
    if (!bare) continue;
    if (/^fm-/i.test(bare)) return bare.slice(3);
    const marker = bare.toLowerCase().indexOf("-fm-");
    if (marker >= 0) return bare.slice(marker + 4);
  }
  for (const text of [name, title]) {
    if (!isWorkerTitleOrName(text)) continue;
    const cleaned = text.trim().replace(/^(?:\[\s*[.!]\s*\]\s*|[^\p{L}\p{N}/]+\s*)?/u, "");
    return cleaned.replace(/^fm[/-]/i, "");
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
  if (isWorkerBranch(space?.branch)) reasons.push("space.branch");

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
        branch: pane?.branch || space?.branch,
        tabId: tab?.id || pane?.tab || agent?.tab,
        herdrTabLabel: terminal?.labels?.["herdr.tab"],
        name: pane?.name || agent?.pane_name || terminal?.name || tab?.name,
        title: pane?.title || agent?.title || terminal?.title,
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
  const space = (focused?.space ? spaces.find((s) => s.id === focused.space) : null)
    ?? spaces.find((s) => s.active)
    ?? null;
  const spaceTabs = space?.tabs ?? [];
  const tab = (focused?.tab ? spaceTabs.find((t) => t.id === focused.tab) : null)
    ?? spaceTabs.find((t) => t.active)
    ?? null;
  const pane = (focused?.pane ? panes.find((p) => p.pane === focused.pane) : null)
    ?? panes.find((p) => p.focused)
    ?? (tab ? panes.find((p) => p.tab === tab.id) : null)
    ?? null;
  const addr = focused?.shown ?? focused?.terminal ?? focused?.agent ?? pane?.terminal ?? null;
  const terminal = addr ? (terminals.find((t) => t.address === addr) ?? null) : null;
  const agent = (addr ? agents.find((a) => a.address === addr) : null)
    ?? (pane ? agents.find((a) => a.pane === pane.pane) : null)
    ?? agents.find((a) => a.focused)
    ?? null;

  return { space, tab, pane, agent, terminal, focused };
}

/**
 * Count unique active Firstmate worker sessions across agents and terminal panes.
 */
export function countActiveWorkers({ spaces = [], panes = [], agents = [], terminals = [] } = {}) {
  const spaceById = new Map(spaces.map((s) => [s.id, s]));
  const tabInfoById = new Map();
  for (const s of spaces) {
    for (const t of s.tabs ?? []) {
      tabInfoById.set(t.id, { tab: t, space: s });
    }
  }
  const paneById = new Map(panes.map((p) => [p.pane, p]));
  const terminalByAddr = new Map(terminals.map((t) => [t.address, t]));

  const seenAddrs = new Set();
  const seenAgentTabs = new Set();
  let count = 0;

  for (const agent of agents) {
    const tabInfo = tabInfoById.get(agent.tab);
    const space = spaceById.get(agent.space) ?? tabInfo?.space ?? null;
    const pane = paneById.get(agent.pane) ?? null;
    const terminal = terminalByAddr.get(agent.address) ?? null;
    const result = detectWorkerContext({
      space,
      tab: tabInfo?.tab ?? null,
      pane,
      agent,
      terminal,
    });
    if (!result.isWorker) continue;
    const key = agent.address || agent.pane;
    if (seenAddrs.has(key)) continue;
    seenAddrs.add(key);
    if (agent.tab) seenAgentTabs.add(agent.tab);
    count++;
  }

  for (const pane of panes) {
    if (!pane.terminal) continue;
    if (seenAddrs.has(pane.terminal)) continue;
    if (pane.tab && seenAgentTabs.has(pane.tab)) continue;
    const tabInfo = tabInfoById.get(pane.tab);
    const terminal = terminalByAddr.get(pane.terminal) ?? null;
    const result = detectWorkerContext({
      space: tabInfo?.space ?? null,
      tab: tabInfo?.tab ?? null,
      pane,
      terminal,
    });
    if (!result.isWorker) continue;
    seenAddrs.add(pane.terminal);
    if (pane.tab) seenAgentTabs.add(pane.tab);
    count++;
  }

  return count;
}
