// js/src/data/protoBoard.ts
var factories = [
  {
    id: "fa",
    name: "flutter_agent_harness",
    accent: "#22d3ee",
    stateUrl: "https://raw.githubusercontent.com/IstiN/flutter_agent_harness/factory-data/data/fa-state.json",
    tokensAsset: "fa-tokens.json",
    machineAuthors: ["ai-teammate", "vabhzw17eg2qu4m9-bit"]
  },
  {
    id: "dart",
    name: "dmtools-dart",
    accent: "#34d399",
    stateUrl: "https://raw.githubusercontent.com/epam/dmtools-dart/factory-data/data/dart-state.json",
    tokensAsset: "dart-tokens.json",
    machineAuthors: ["ai-teammate", "vabhzw17eg2qu4m9-bit"]
  },
  {
    id: "agents",
    name: "dmtools-agents",
    accent: "#a78bfa",
    stateUrl: "https://raw.githubusercontent.com/IstiN/dmtools-agents/factory-data/data/agents-state.json",
    tokensAsset: "agents-tokens.json",
    machineAuthors: ["ai-teammate", "vabhzw17eg2qu4m9-bit"]
  }
];
var laneOrder = [
  { id: "development", title: "Development" },
  { id: "pr_created", title: "PR created" },
  { id: "pr_validation", title: "PR validation" },
  { id: "review", title: "Review" },
  { id: "approved_queue", title: "Approved queue \xB7 FIFO" },
  { id: "validating", title: "Validating \xB7 mutex" },
  { id: "merged_recent", title: "Merged \xB7 24h" }
];
var backlogColumns = [
  { id: "in_dev", title: "In dev \xB7 assigned" },
  { id: "queued", title: "agent:dev queued" },
  { id: "blocked", title: "Blocked \xB7 owner hold" },
  { id: "inbox", title: "Inbox" }
];
var badgeLabels = [
  "pr_approved",
  "ai_validated",
  "ai_pr_reviewed",
  "ai_validating",
  "dependencies",
  "agent:dev",
  "agent:review",
  "agent:rework",
  "github_actions"
];
var terminals = [
  { side: "left", x: 2.5, y: 16, laneId: "development" },
  { side: "left", x: 2.5, y: 29, laneId: "pr_created" },
  { side: "left", x: 2.5, y: 42, laneId: "pr_validation" },
  { side: "left", x: 2.5, y: 55, laneId: "review" },
  { side: "right", x: 97.5, y: 24, laneId: "approved_queue" },
  { side: "right", x: 97.5, y: 44, laneId: "validating" },
  { side: "right", x: 97.5, y: 64, laneId: "merged_recent" },
  { side: "top", x: 21, y: 7, labelSide: "left", laneId: "blocked" },
  { side: "top", x: 38, y: 10.5, labelSide: "left", laneId: "inbox" },
  { side: "top", x: 45, y: 14, labelSide: "right", laneId: "in_dev" },
  { side: "top", x: 58, y: 17.5, labelSide: "right", laneId: "queued" }
];
var SEA = [0, 246, 255];
var LILAC = [184, 150, 255];
var mixColor = (t) => SEA.map((c, i) => Math.round(c + (LILAC[i] - c) * t));

// js/src/scripts/boardStats.ts
var WAITING_LANES = ["approved_queue", "queued", "blocked", "inbox", "merged_recent"];
var ACTIVE_WINDOW_MS = 30 * 60 * 1e3;
function tokenTotals(cards) {
  return sumTokenRows(cards.flatMap((c) => c.tokens ?? []));
}
function sumTokenRows(rows) {
  const out = { read: 0, write: 0, unsplit: 0, legs: 0 };
  for (const t of rows) {
    out.legs += 1;
    const prompt = typeof t.prompt === "number" ? t.prompt : null;
    const completion = typeof t.completion === "number" ? t.completion : null;
    const cacheRaw = t.cacheRead == null ? t.cache_read : t.cacheRead;
    const cacheRead = typeof cacheRaw === "number" ? cacheRaw : typeof cacheRaw === "string" && cacheRaw !== "" && !Number.isNaN(+cacheRaw) ? +cacheRaw : 0;
    if (prompt == null && completion == null) {
      out.unsplit += typeof t.total === "number" ? t.total : 0;
      continue;
    }
    out.read += (prompt ?? 0) + cacheRead;
    out.write += completion ?? 0;
  }
  return out;
}
function sumTokensMap(map) {
  if (!map || typeof map !== "object") return null;
  const rows = Object.values(map).flatMap((r) => Array.isArray(r) ? r : []);
  return sumTokenRows(rows);
}
function searchCount(json) {
  if (!json || typeof json !== "object") return null;
  const n = json.total_count;
  return typeof n === "number" && n >= 0 ? n : null;
}
function filterFactories(list, q) {
  const query = q.trim().toLowerCase();
  if (!query) return [...list];
  return list.filter((f) => f.id.toLowerCase().includes(query) || f.name.toLowerCase().includes(query));
}
function mergedArchiveFromSearch(json) {
  if (!json || typeof json !== "object") return null;
  const box = json;
  if (!Array.isArray(box.items)) return null;
  const items = [];
  for (const raw of box.items) {
    if (!raw || typeof raw !== "object") continue;
    const it = raw;
    if (typeof it.number !== "number") continue;
    if (items.length >= 50) break;
    const at = typeof it.closed_at === "string" ? it.closed_at : null;
    const created = typeof it.created_at === "string" ? it.created_at : null;
    const leadMs = at && created ? Date.parse(at) - Date.parse(created) : null;
    items.push({
      num: it.number,
      title: typeof it.title === "string" ? it.title : "(untitled)",
      at,
      leadMs: leadMs != null && Number.isFinite(leadMs) && leadMs >= 0 ? leadMs : null
    });
  }
  return { total: searchCount(json), items };
}
function cardLastStamp(c) {
  const h = c.history ?? [];
  const stamps = [c.devStartedAt, c.approvedAt, h.length ? h[h.length - 1].at : void 0, c.prCreated];
  const found = stamps.filter((s) => typeof s === "string" && !Number.isNaN(Date.parse(s)));
  if (!found.length) return null;
  return found.sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}
function enteredRecently(c, nowMs, windowMs) {
  const at = cardLastStamp(c);
  if (!at) return false;
  const age = nowMs - Date.parse(at);
  return age >= 0 && age <= windowMs;
}
function laneActive(laneId, cards, tickAtMs) {
  if (!cards.length) return false;
  if (WAITING_LANES.includes(laneId)) return false;
  if (laneId === "validating") return true;
  return cards.some((c) => enteredRecently(c, tickAtMs, ACTIVE_WINDOW_MS));
}
function queueWait(laneId, cards, tickAtMs) {
  if (!cards.length) return null;
  let head;
  let stamps;
  if (laneId === "approved_queue") {
    head = cards.find((c) => c.queuePos === 1) ?? cards[0];
    stamps = [head.approvedAt, cardLastStamp(head)];
  } else if (laneId === "queued") {
    head = cards[0];
    stamps = [cardLastStamp(head)];
  } else {
    return null;
  }
  const at = stamps.find((s) => typeof s === "string" && !Number.isNaN(Date.parse(s)));
  if (!at) return null;
  const age = tickAtMs - Date.parse(at);
  if (age < 0) return null;
  return { depth: cards.length, headAgeMs: age };
}
function qualifyAll(field, values) {
  return values.map((v) => `${field}:${v}`).join(" ");
}
function histSpans(history, nowMs, endAt) {
  const spans = [];
  let prev = null;
  const end = endAt ? Date.parse(endAt) : nowMs;
  for (const e of history) {
    if (!e.at) continue;
    const atMs = Date.parse(e.at);
    if (Number.isNaN(atMs)) continue;
    if (prev) spans.push({ state: prev.state, startMs: prev.atMs, endMs: atMs, durMs: Math.max(0, atMs - prev.atMs) });
    prev = { state: e.state, atMs };
  }
  if (prev && Number.isFinite(end)) {
    spans.push({ state: prev.state, startMs: prev.atMs, endMs: end, durMs: Math.max(0, end - prev.atMs) });
  }
  return spans;
}
function phaseAggregate(spans) {
  const by = /* @__PURE__ */ new Map();
  for (const s of spans) {
    const cur = by.get(s.state) ?? { visits: 0, totalMs: 0, maxMs: 0 };
    cur.visits += 1;
    cur.totalMs += s.durMs;
    cur.maxMs = Math.max(cur.maxMs, s.durMs);
    by.set(s.state, cur);
  }
  return [...by.entries()].map(([state, v]) => ({ state, ...v, avgMs: v.totalMs / v.visits })).sort((a, b) => b.totalMs - a.totalMs);
}
function medianMs(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function laneDwell(cards, lane, nowMs) {
  const dwells = [];
  const leads = [];
  const leadMax = { ms: 0 };
  for (const c of cards) {
    const spans = histSpans(c.history ?? [], nowMs, c.mergedAt);
    if (!spans.length) continue;
    const inLane = spans.filter((s) => s.state === lane).reduce((acc, s) => acc + s.durMs, 0);
    dwells.push(inLane);
    if (c.mergedAt && spans[0]) {
      const lead = Math.max(0, Date.parse(c.mergedAt) - spans[0].startMs);
      leads.push(lead);
      leadMax.ms = Math.max(leadMax.ms, lead);
    }
  }
  const touched = dwells.filter((d) => d > 0);
  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const out = {
    n: touched.length,
    avgMs: avg(touched),
    medianMs: medianMs(touched),
    maxMs: touched.length ? Math.max(...touched) : 0
  };
  if (leads.length) out.lead = { n: leads.length, avgMs: avg(leads), medianMs: medianMs(leads), maxMs: leadMax.ms };
  return out;
}
function tokensKey(card) {
  if (card.pr != null) return "pr-" + card.pr;
  if (card.issue != null) return "issue-" + card.issue;
  return null;
}
function tokensFor(card, stream) {
  const k = tokensKey(card);
  if (stream && k && stream[k]) return stream[k];
  return card.tokens ?? [];
}
function mergesPerDay(items, days, nowMs) {
  const out = [];
  const counts = /* @__PURE__ */ new Map();
  for (const it of items) {
    if (!it.at) continue;
    const t = Date.parse(it.at);
    if (!Number.isFinite(t)) continue;
    const key = new Date(t).toISOString().slice(5, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(nowMs - i * 864e5).toISOString().slice(5, 10);
    out.push({ date: key, n: counts.get(key) ?? 0 });
  }
  return out;
}
function mergeDayStats(items, days, nowMs) {
  const per = mergesPerDay(items, days, nowMs);
  const total = per.reduce((a, d) => a + d.n, 0);
  const best = per.reduce((b, d) => !b || d.n > b.n ? { date: d.date, n: d.n } : b, null);
  return { total, perDay: total / days, best: best && best.n > 0 ? best : null };
}
function stuckCards(items, nowMs, thresholdMs) {
  const out = [];
  for (const { lane, card } of items) {
    const last = cardLastStamp(card);
    if (!last) continue;
    const t = Date.parse(last);
    if (!Number.isFinite(t)) continue;
    const ageMs = nowMs - t;
    if (ageMs >= thresholdMs) {
      out.push({ lane, pr: card.pr, issue: card.issue, title: card.title ?? "(untitled)", lastAt: last, ageMs });
    }
  }
  return out.sort((a, b) => b.ageMs - a.ageMs);
}
var BAD_VERDICTS = /* @__PURE__ */ new Set(["failure", "timed_out"]);
function errorCards(items) {
  const out = [];
  for (const { lane, card } of items) {
    const verdict = card.checks?.conclusion ?? card.checks?.verdict;
    if (verdict && BAD_VERDICTS.has(verdict)) {
      out.push({ lane, pr: card.pr, issue: card.issue, title: card.title ?? "(untitled)", verdict });
    }
  }
  return out;
}
function deliveredToday(cards, nowMs) {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const out = [];
  for (const card of cards) {
    const mergedAt = card.mergedAt;
    if (!mergedAt || !mergedAt.startsWith(today)) continue;
    const spans = histSpans(card.history ?? [], nowMs, mergedAt);
    const leadMs = spans.length ? Math.max(0, Date.parse(mergedAt) - spans[0].startMs) : null;
    out.push({ pr: card.pr, issue: card.issue, title: card.title ?? "(untitled)", mergedAt, leadMs });
  }
  return out.sort((a, b) => Date.parse(b.mergedAt) - Date.parse(a.mergedAt));
}
function flowAverages(cards, nowMs) {
  const all = [];
  for (const card of cards) {
    all.push(...histSpans(card.history ?? [], nowMs, card.mergedAt));
  }
  return phaseAggregate(all);
}
function workflowRuns(json) {
  const runs = json?.workflow_runs;
  if (!Array.isArray(runs)) return [];
  const out = [];
  for (const raw of runs) {
    const r = raw;
    if (typeof r.id !== "number" || typeof r.run_started_at !== "string") continue;
    const startedMs = Date.parse(r.run_started_at);
    if (!Number.isFinite(startedMs)) continue;
    const endMs = r.conclusion != null && typeof r.updated_at === "string" ? Date.parse(r.updated_at) : NaN;
    out.push({
      id: r.id,
      // run names come from upstream workflows — strip emoji per the no-glyph rule
      name: typeof r.name === "string" ? r.name.replace(/[^\x20-\x7E]/g, "").trim() : "run",
      startedMs,
      endMs: Number.isFinite(endMs) ? endMs : null,
      url: typeof r.html_url === "string" ? r.html_url : "https://github.com/"
    });
  }
  return out;
}
function runsInWindow(runs, startMs, endMs) {
  return runs.filter((r) => {
    if (r.startedMs >= endMs) return false;
    const runEnd = r.endMs ?? Number.MAX_SAFE_INTEGER;
    return runEnd >= startMs;
  });
}

// js/src/scripts/proto-board.ts
var ALL_LANES = [...laneOrder, ...backlogColumns];
var TITLES = Object.fromEntries(ALL_LANES.map((l) => [l.id, l.title]));
var board = document.getElementById("board");
var svg = document.getElementById("wires");
var cube = document.getElementById("cube");
var modal = document.getElementById("phase-modal");
var statusEl = document.getElementById("tick-status");
var loadLine = document.getElementById("load-status");
var tabsBox = document.getElementById("factory-select");
var selectBtn = document.getElementById("factory-btn");
var selectBtnName = document.getElementById("factory-btn-name");
var selectBtnDot = document.getElementById("factory-btn-dot");
var selectMenu = document.getElementById("factory-menu");
var selectSearch = document.getElementById("factory-search");
var selectList = document.getElementById("factory-list");
var selectHighlight = 0;
var mobileLanes = document.getElementById("mobile-lanes");
var STALE_AFTER_MS = 30 * 60 * 1e3;
var compact = window.matchMedia("(max-width: 900px)");
var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var activeIdx = 0;
var st = null;
var cache = {};
var wires = [];
var pulseFrame = 0;
async function loadFactory(i) {
  const f = factories[i];
  if (cache[f.id]) return cache[f.id];
  const res = await fetch(f.stateUrl, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  cache[f.id] = json;
  return json;
}
function cardsIn(laneId) {
  if (!st) return [];
  return st.lanes?.[laneId] ?? st.backlog?.[laneId] ?? [];
}
function allCards() {
  return ALL_LANES.flatMap((l) => cardsIn(l.id));
}
function tickMs() {
  const t = st?.tick?.at ? Date.parse(st.tick.at) : NaN;
  return Number.isNaN(t) ? Date.now() : t;
}
function cardKey(c) {
  return String(c.pr ?? c.issue ?? "\u2014");
}
function cardKind(c) {
  return c.pr != null ? "pull" : "issues";
}
function cardUrl(c) {
  if (typeof c.url === "string" && c.url) return c.url;
  const repo = st?.repo ?? "";
  return c.pr != null ? `https://github.com/${repo}/pull/${c.pr}` : `https://github.com/${repo}/issues/${c.issue}`;
}
function cardLastAt(c) {
  const h = c.history ?? [];
  return (h.length ? h[h.length - 1].at : void 0) ?? c.prCreated ?? c.devStartedAt ?? null;
}
function cardTokens(c) {
  return tokensFor(c, tokensStream()).reduce((n, t) => n + (t.total ?? 0), 0);
}
var tokensStreams = {};
function tokensStream() {
  return st ? tokensStreams[st.factory] ?? null : null;
}
function fmtTokens(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "k";
  return String(n);
}
var tokenTotalsEl = document.getElementById("token-totals");
function renderTokenTotals() {
  if (!st) return;
  const fromFile = ledgerCache[ledgerKey()]?.tokens;
  const t = fromFile ?? tokenTotals(allCards());
  if (!t.legs) {
    tokenTotalsEl.textContent = "TOKENS \u2014";
    tokenTotalsEl.title = "This factory does not publish per-leg token usage yet (read = prompt + cache, write = completion)";
    return;
  }
  const sum = t.read + t.write + t.unsplit;
  tokenTotalsEl.textContent = "TOKENS \xB7 R " + fmtTokens(t.read) + " \xB7 W " + fmtTokens(t.write);
  tokenTotalsEl.title = (fromFile ? "All-time token stream (data/" + factories[activeIdx].tokensAsset + " on the factory-data branch)" : "Token spend across snapshot cards") + " \xB7 read = prompt + cacheRead, write = completion \xB7 " + fmtTokens(sum) + " total across " + t.legs + " legs" + (t.unsplit ? " \xB7 +" + fmtTokens(t.unsplit) + " rows carry no prompt/completion split" : "");
}
var ledgerEl = document.getElementById("factory-ledger");
function ledgerKey() {
  return factories[activeIdx].id;
}
var LEDGER_TTL_MS = 10 * 60 * 1e3;
var ledgerCache = {};
async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}
async function loadLedger() {
  if (!st) return;
  const f = factories[activeIdx];
  const repo = st.repo;
  const cached = ledgerCache[f.id];
  if (cached && Date.now() - cached.at < LEDGER_TTL_MS) {
    renderLedger(f.id);
    return;
  }
  const q = (s) => "https://api.github.com/search/issues?q=" + encodeURIComponent(s);
  const [tokens, merged, issues] = await Promise.all([
    fetchJson(`https://raw.githubusercontent.com/${repo}/factory-data/data/${f.tokensAsset}`).then((d) => {
      const map = d;
      tokensStreams[f.id] = map;
      return sumTokensMap(map);
    }).catch(() => {
      tokensStreams[f.id] = null;
      return null;
    }),
    fetchJson(q(`repo:${repo} is:pr is:merged ${qualifyAll("author", f.machineAuthors)}`)).then(searchCount).catch(() => null),
    fetchJson(q(`repo:${repo} is:issue is:closed ${qualifyAll("assignee", f.machineAuthors)}`)).then(searchCount).catch(() => null)
  ]);
  ledgerCache[f.id] = { tokens, merged, issues, at: Date.now() };
  renderLedger(f.id);
}
function renderLedger(id) {
  const f = factories.find((x) => x.id === id);
  const l = ledgerCache[id];
  if (!f || !l) return;
  const parts = [];
  if (l.merged != null) parts.push("merged " + l.merged + " PRs");
  if (l.issues != null) parts.push(l.issues + " issues done");
  if (l.tokens) {
    parts.push("R " + fmtTokens(l.tokens.read) + " \xB7 W " + fmtTokens(l.tokens.write));
    parts.push(l.tokens.legs + " legs");
  }
  ledgerEl.textContent = "LEDGER \xB7 " + (parts.length ? parts.join(" \xB7 ") + " \xB7 ALL TIME" : "no all-time sources yet");
  ledgerEl.title = "All-time factory ledger (the snapshot above is a live window: open work + 24h merges) \xB7 merged = PRs authored by " + f.machineAuthors.join(" / ") + " \xB7 issues done = closed issues assigned to them \xB7 tokens = every leg in data/" + f.tokensAsset + " on the factory-data branch" + (l.tokens ? "" : " \xB7 this factory does not publish a tokens stream yet (dmtools-agents#1108)");
  updateMergedLabel(l.merged);
  renderTokenTotals();
  updateBottleneckChip();
}
function updateMergedLabel(allTime) {
  if (allTime == null) return;
  const label = svg.querySelector('.board__label[data-lane="merged_recent"]');
  if (!label) return;
  const txt = label.textContent ?? "";
  if (txt.includes("\u03A3")) label.textContent = txt.replace(/ · Σ\d+.*$/, "") + " \xB7 \u03A3" + allTime;
  else label.textContent = txt + " \xB7 \u03A3" + allTime;
}
function humanize(ms) {
  if (ms < 0) ms = 0;
  const m = Math.floor(ms / 6e4);
  if (m < 1) return Math.max(1, Math.round(ms / 1e3)) + "s";
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h " + m % 60 + "m";
  return Math.floor(h / 24) + "d " + h % 24 + "h";
}
function since(iso) {
  return Date.now() - new Date(iso).getTime();
}
var SVG_NS = "http://www.w3.org/2000/svg";
var ICON_PATHS = {
  close: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>',
  caret: '<path d="M4.5 6.5l3.5 3.5 3.5-3.5"/>',
  back: '<path d="M8 3.5L3.5 8 8 12.5M3.5 8H13"/>',
  external: '<path d="M7 3.5H3.5v9h9V9M9.5 3h3.5v3.5M12.5 3.5L7.5 8.5"/>',
  play: '<path d="M5.5 4.5l6 3.5-6 3.5z" fill="currentColor" stroke="none"/>',
  dot: '<circle cx="8" cy="8" r="3.2" fill="currentColor" stroke="none"/>',
  hourglass: '<path d="M4.5 2.5h7M4.5 13.5h7M5.8 2.5v1.2c0 1.7 4.4 2.2 4.4 4.3s-4.4 2.6-4.4 4.3v1.2M10.2 2.5v1.2c0 1.7-4.4 2.2-4.4 4.3s4.4 2.6 4.4 4.3v1.2"/>',
  alert: '<path d="M8 2.8L14.2 13H1.8z"/><path d="M8 6.8v2.7M8 11.4v.1"/>',
  errx: '<circle cx="8" cy="8" r="5.5"/><path d="M6.2 6.2l3.6 3.6M9.8 6.2l-3.6 3.6"/>',
  check: '<circle cx="8" cy="8" r="5.5"/><path d="M5.4 8.2l1.8 1.8 3.4-3.7"/>',
  clock: '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.2l2 1.3"/>'
};
function icon(name, cls) {
  const svg2 = document.createElementNS(SVG_NS, "svg");
  svg2.setAttribute("viewBox", "0 0 16 16");
  svg2.setAttribute("class", "iconIco" + (cls ? " " + cls : ""));
  svg2.setAttribute("aria-hidden", "true");
  svg2.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + (ICON_PATHS[name] ?? "") + "</g>";
  return svg2;
}
function el(name, attrs, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const k in attrs) node.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(node);
  return node;
}
function rgb(c, a) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a ?? 1})`;
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function route(t, padX, padY, tx, ty) {
  if (t.side === "left" || t.side === "right") {
    const dir = t.side === "left" ? -1 : 1;
    const sx = padX + dir * 40;
    let ex = tx - dir * (Math.abs(ty - padY) + 18);
    if (dir > 0 && ex < sx || dir < 0 && ex > sx) ex = sx;
    return `M ${padX} ${padY} L ${sx} ${padY} L ${ex} ${ty} L ${tx} ${ty}`;
  }
  if (Math.abs(tx - padX) < 2) return `M ${padX} ${padY} L ${tx} ${ty}`;
  return `M ${padX} ${padY} L ${tx} ${ty + (t.side === "top" ? 14 : -14)} L ${tx} ${ty}`;
}
function draw() {
  if (pulseFrame) cancelAnimationFrame(pulseFrame);
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  wires = [];
  if (compact.matches || !st) return;
  const b = board.getBoundingClientRect();
  const c = cube.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${b.width} ${b.height}`);
  svg.setAttribute("width", String(b.width));
  svg.setAttribute("height", String(b.height));
  const defs = el("defs", {}, svg);
  const filter = el("filter", { id: "wireGlow", x: "-60%", y: "-60%", width: "220%", height: "220%" }, defs);
  el("feGaussianBlur", { stdDeviation: "3.4", result: "b" }, filter);
  const merge = el("feMerge", {}, filter);
  el("feMergeNode", { in: "b" }, merge);
  el("feMergeNode", { in: "SourceGraphic" }, merge);
  terminals.forEach((t, i) => {
    const cards = cardsIn(t.laneId);
    const tx = t.x / 100 * b.width;
    const ty = t.y / 100 * b.height;
    let padX, padY;
    if (t.side === "left") {
      padX = c.left - b.left;
      padY = c.top - b.top + c.height / 2 + (-66 + i * 30);
    } else if (t.side === "right") {
      padX = c.right - b.left;
      padY = c.top - b.top + c.height / 2 + (-60 + (i - 4) * 30);
    } else {
      const topIdx = terminals.filter((x) => x.side === "top").indexOf(t);
      const topCount = terminals.filter((x) => x.side === "top").length;
      const frac = topCount > 1 ? topIdx / (topCount - 1) : 0.5;
      padX = c.left - b.left + c.width * (0.08 + 0.84 * frac);
      padY = c.top - b.top;
    }
    const color = mixColor(t.x / 100);
    const active = laneActive(t.laneId, cards, tickMs());
    const path = el("path", {
      d: route(t, padX, padY, tx, ty),
      class: "board__wire",
      stroke: rgb(color, cards.length ? 0.45 : 0.2),
      "data-lane": t.laneId
    }, svg);
    el("rect", { x: padX - 4, y: padY - 4, width: 8, height: 8, class: "board__pad", stroke: rgb(color, 0.9) }, svg);
    const g = el("g", {
      class: "board__term",
      "data-lane": t.laneId,
      tabindex: "0",
      role: "button",
      "aria-label": `${TITLES[t.laneId]} \u2014 ${cards.length} tickets`
    }, svg);
    if (cards.length && active) {
      el("circle", { cx: tx, cy: ty, r: 5, fill: rgb(color, 0.35), filter: "url(#wireGlow)" }, g);
      el("circle", { cx: tx, cy: ty, r: 3.2, fill: rgb(color, 1) }, g);
    } else if (cards.length) {
      el("circle", {
        cx: tx,
        cy: ty,
        r: 4.4,
        fill: "#060606",
        stroke: rgb(color, 0.9),
        "stroke-width": 1.4,
        "stroke-dasharray": "2.6 2.2",
        class: "is-waiting"
      }, g);
    } else {
      el("circle", { cx: tx, cy: ty, r: 4, fill: "#060606", stroke: rgb(color, 0.9), "stroke-width": 1.4 }, g);
    }
    el("circle", { cx: tx, cy: ty, r: 14, fill: "transparent", class: "board__hit" }, g);
    const wait = queueWait(t.laneId, cards, tickMs());
    const allTime = t.laneId === "merged_recent" ? ledgerCache[st?.factory ?? ""]?.merged : void 0;
    const baseText = `${pad2(i + 1)} \xB7 ${TITLES[t.laneId]} \xB7 ${cards.length}` + (allTime != null ? " \xB7 \u03A3" + allTime : "");
    const label = el("text", { class: "board__label", fill: rgb(color, cards.length ? 0.85 : 0.4), "data-lane": t.laneId }, g);
    if (t.side === "left") {
      label.setAttribute("x", String(tx + 4));
      label.setAttribute("text-anchor", "start");
      label.setAttribute("y", String(ty + 15));
    } else if (t.side === "right") {
      label.setAttribute("x", String(tx - 4));
      label.setAttribute("text-anchor", "end");
      label.setAttribute("y", String(ty + 15));
    } else if (t.labelSide === "left") {
      label.setAttribute("x", String(tx - 11));
      label.setAttribute("text-anchor", "end");
      label.setAttribute("y", String(ty + 4));
    } else {
      label.setAttribute("x", String(tx + 11));
      label.setAttribute("text-anchor", "start");
      label.setAttribute("y", String(ty + 4));
    }
    if (wait) {
      label.textContent = "";
      const main = document.createElementNS(SVG_NS, "tspan");
      main.textContent = baseText;
      const clock = document.createElementNS(SVG_NS, "tspan");
      clock.setAttribute("class", "board__wait");
      clock.textContent = " \xB7 " + humanize(wait.headAgeMs);
      label.appendChild(main);
      label.appendChild(clock);
      try {
        const lx = parseFloat(label.getAttribute("x") ?? "0");
        const wMain = main.getComputedTextLength();
        const wClock = clock.getComputedTextLength();
        const gx = t.labelSide === "left" ? lx - wMain - wClock - 18 : lx + wMain + wClock + 4;
        const ico = icon("hourglass", "board__waitIco");
        ico.setAttribute("x", String(gx));
        ico.setAttribute("y", String(ty - 8));
        ico.setAttribute("width", "13");
        ico.setAttribute("height", "13");
        g.appendChild(ico);
      } catch {
      }
    } else {
      label.textContent = baseText;
    }
    wires.push({ laneId: t.laneId, path, color });
    g.addEventListener("mouseenter", () => hot(t.laneId, true));
    g.addEventListener("mouseleave", () => hot(t.laneId, false));
    g.addEventListener("click", () => openLane(t.laneId));
    g.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        openLane(t.laneId);
      }
    });
  });
  animateIn();
  renderTokenTotals();
  updateBottleneckChip();
  startPulses();
}
function hot(laneId, on) {
  const w = wires.find((x) => x.laneId === laneId);
  if (!w) return;
  w.path.classList.toggle("is-hot", on);
  const label = svg.querySelector(`.board__label[data-lane="${laneId}"]`);
  if (label) label.classList.toggle("is-hot", on);
}
function animateIn() {
  wires.forEach((w, i) => {
    if (reduceMotion) return;
    const len = w.path.getTotalLength();
    w.path.style.transition = "none";
    w.path.style.strokeDasharray = String(len);
    w.path.style.strokeDashoffset = String(len);
    void w.path.getBoundingClientRect();
    w.path.style.transition = `stroke-dashoffset 850ms cubic-bezier(0.22,0.61,0.36,1) ${150 + i * 50}ms`;
    w.path.style.strokeDashoffset = "0";
  });
}
function startPulses() {
  if (reduceMotion) return;
  const now = tickMs();
  const travelers = wires.filter((w) => laneActive(w.laneId, cardsIn(w.laneId), now)).map((w, i) => {
    const dot = el("circle", { r: 2.4, fill: rgb(w.color, 0.95), filter: "url(#wireGlow)", class: "board__pulse" }, svg);
    return { dot, path: w.path, offset: i * 0.29, speed: 2400 + i % 5 * 380 };
  });
  const t0 = performance.now();
  const tick = (now2) => {
    travelers.forEach((t) => {
      const len = t.path.getTotalLength();
      const pos = ((now2 - t0) / t.speed + t.offset) % 1 * len;
      const pt = t.path.getPointAtLength(pos);
      t.dot.setAttribute("cx", String(pt.x));
      t.dot.setAttribute("cy", String(pt.y));
    });
    pulseFrame = requestAnimationFrame(tick);
  };
  pulseFrame = requestAnimationFrame(tick);
}
function updateStatus() {
  if (!st) {
    statusEl.textContent = "\u2014";
    return;
  }
  const age = since(st.tick.at);
  const stale = age > STALE_AFTER_MS;
  statusEl.textContent = (stale ? "STALE \xB7 " : "LIVE \xB7 ") + humanize(age) + " ago";
  statusEl.classList.toggle("is-stale", stale);
}
function snapshotCards() {
  if (!st) return [];
  const out = [];
  for (const lane of ALL_LANES) out.push(...st.lanes[lane.id] ?? []);
  return out;
}
function renderLaneAvg(laneId) {
  const strip = document.getElementById("lane-avg");
  strip.innerHTML = "";
  if (!st) return;
  const now = Date.now();
  const d = laneDwell(snapshotCards(), laneId, now);
  if (laneId === "merged_recent") {
    if (!d.lead || !d.lead.n) {
      strip.hidden = true;
      return;
    }
    strip.hidden = false;
    strip.title = "Across the merged PRs in the snapshot (24h window). Lead = first seen \u2192 merged.";
    var chips = [
      ["merged (24h)", d.lead.n + " PR" + (d.lead.n === 1 ? "" : "s")],
      ["avg lead", humanize(d.lead.avgMs)],
      ["median lead", humanize(d.lead.medianMs)],
      ["max lead", humanize(d.lead.maxMs)]
    ];
  } else {
    if (!d.n) {
      strip.hidden = true;
      return;
    }
    strip.hidden = false;
    strip.title = "Across every snapshot card that passed this lane (open work + 24h merged). Dwell = total time a card spent in this lane.";
    var chips = [
      ["through lane", d.n + " card" + (d.n === 1 ? "" : "s")],
      ["avg dwell", humanize(d.avgMs)],
      ["median dwell", humanize(d.medianMs)],
      ["max dwell", humanize(d.maxMs)]
    ];
    if (d.lead) {
      chips.push(["avg lead \u2192 merge", humanize(d.lead.avgMs)]);
      chips.push(["median lead", humanize(d.lead.medianMs)]);
    }
  }
  chips.forEach(([k, v]) => {
    const chip = document.createElement("div");
    chip.className = "laneAvg__chip";
    const kk = document.createElement("span");
    kk.className = "laneAvg__k";
    kk.textContent = k;
    const vv = document.createElement("span");
    vv.className = "laneAvg__v";
    vv.textContent = v;
    chip.appendChild(kk);
    chip.appendChild(vv);
    strip.appendChild(chip);
  });
}
function openLane(laneId) {
  if (!st) return;
  showLaneView();
  const cards = cardsIn(laneId);
  document.getElementById("lane-eyebrow").textContent = "LANE \xB7 " + st.factory.toUpperCase();
  document.getElementById("lane-title").textContent = TITLES[laneId] ?? laneId;
  const allTime = ledgerCache[ledgerKey()]?.merged;
  document.getElementById("lane-summary").textContent = cards.length + " ticket" + (cards.length === 1 ? "" : "s") + " \xB7 snapshot " + humanize(since(st.tick.at)) + " ago" + (laneId === "merged_recent" && allTime != null ? " \xB7 " + allTime + " merged all-time" : "");
  renderLaneAvg(laneId);
  const box = document.getElementById("lane-tickets");
  box.innerHTML = "";
  if (!cards.length) {
    const p = document.createElement("p");
    p.className = "phaseModal__empty";
    p.textContent = "Empty lane \u2014 nothing in flight here right now.";
    box.appendChild(p);
  }
  cards.forEach((c) => box.appendChild(ticketCard(c, laneId)));
  if (laneId === "merged_recent") appendMergedArchive(box);
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  modal.querySelector(".phaseModal__close")?.focus();
}
var archiveCache = {};
var ARCHIVE_TTL_MS = 10 * 60 * 1e3;
var archiveSeq = 0;
async function fetchMergedArchive() {
  const f = factories[activeIdx];
  const repo = st?.repo ?? "";
  const cached = archiveCache[f.id];
  if (cached && Date.now() - cached.at < ARCHIVE_TTL_MS) return cached;
  const since2 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString().slice(0, 10);
  const q = "https://api.github.com/search/issues?q=" + encodeURIComponent(
    `repo:${repo} is:pr is:merged ${qualifyAll("author", f.machineAuthors)} merged:>${since2}`
  ) + "&per_page=100";
  let parsed = null;
  try {
    parsed = mergedArchiveFromSearch(await fetchJson(q));
  } catch {
    parsed = null;
  }
  const next = parsed ? { total: parsed.total, items: parsed.items, at: Date.now() } : { total: null, items: null, at: Date.now() };
  archiveCache[f.id] = next;
  return next;
}
async function appendMergedArchive(box) {
  const seq = ++archiveSeq;
  const section = document.createElement("div");
  section.className = "arcBox";
  const head = document.createElement("div");
  head.className = "arcBox__head";
  head.textContent = "ARCHIVE \xB7 BEYOND 24H";
  const body = document.createElement("div");
  body.className = "arcBox__body";
  body.textContent = "Loading merged history\u2026";
  section.appendChild(head);
  section.appendChild(body);
  box.appendChild(section);
  const a = await fetchMergedArchive();
  if (seq !== archiveSeq || modal.hidden) return;
  body.innerHTML = "";
  if (!a.items) {
    body.textContent = "Merged history unavailable right now (GitHub rate limit).";
    return;
  }
  if (!a.items.length) {
    body.textContent = "No merges by the machine in the last 30 days.";
    return;
  }
  const allTime = ledgerCache[factories[activeIdx].id]?.merged;
  head.textContent = "ARCHIVE \xB7 BEYOND 24H \u2014 " + a.items.length + " merges in 30d" + (allTime != null ? " \xB7 " + allTime + " all-time" : "");
  const list = document.createElement("div");
  list.className = "arcList";
  const nowMs = Date.now();
  const perDay = mergesPerDay(a.items, 30, nowMs);
  const dayStats = mergeDayStats(a.items, 30, nowMs);
  const leads = a.items.map((r) => r.leadMs).filter((v) => typeof v === "number" && v > 0);
  const maxN = Math.max(1, ...perDay.map((d) => d.n));
  const dash = document.createElement("div");
  dash.className = "arcDash";
  const sparkWrap = document.createElement("div");
  const spark = document.createElement("div");
  spark.className = "arcSpark";
  perDay.forEach((d) => {
    const bar = document.createElement("span");
    bar.className = "arcSpark__bar" + (dayStats.best && d.date === dayStats.best.date ? " is-best" : "");
    bar.style.height = d.n ? Math.max(8, Math.round(d.n / maxN * 100)) + "%" : "2px";
    bar.title = d.date + " \xB7 " + d.n + " merge" + (d.n === 1 ? "" : "s");
    spark.appendChild(bar);
  });
  const axis = document.createElement("div");
  axis.className = "arcSpark__axis";
  axis.innerHTML = "<span>" + perDay[0].date + "</span><span>merges / day \xB7 30d</span><span>" + perDay[29].date + "</span>";
  sparkWrap.appendChild(spark);
  sparkWrap.appendChild(axis);
  const chips = document.createElement("div");
  chips.className = "arcChips";
  const chipPairs = [
    ["merges 30d", String(dayStats.total), ""],
    ["avg / day", dayStats.perDay.toFixed(1), ""],
    ["best day", dayStats.best ? dayStats.best.date + " \xB7 " + dayStats.best.n : "\u2014", dayStats.best ? dayStats.best.n + " merges on " + dayStats.best.date : ""],
    ["median lead", leads.length ? humanize(medianMs(leads)) : "\u2014", "created \u2192 merged, across archived PRs that report both stamps"],
    ["avg lead", leads.length ? humanize(leads.reduce((x, y) => x + y, 0) / leads.length) : "\u2014", "created \u2192 merged, 30d archive"]
  ];
  chipPairs.forEach(([k, v, tip]) => {
    const chip = document.createElement("div");
    chip.className = "arcChip";
    if (tip) chip.title = tip;
    const kk = document.createElement("span");
    kk.className = "arcChip__k";
    kk.textContent = k;
    const vv = document.createElement("span");
    vv.className = "arcChip__v";
    vv.textContent = v;
    chip.appendChild(kk);
    chip.appendChild(vv);
    chips.appendChild(chip);
  });
  dash.appendChild(sparkWrap);
  dash.appendChild(chips);
  body.appendChild(dash);
  a.items.forEach((r) => {
    const row = document.createElement("a");
    row.className = "arcRow";
    row.href = cardUrl({ pr: r.num });
    row.target = "_blank";
    row.rel = "noopener";
    const id = document.createElement("span");
    id.className = "arcRow__id";
    id.textContent = "#" + r.num;
    const title = document.createElement("span");
    title.className = "arcRow__title";
    title.textContent = r.title;
    const when = document.createElement("span");
    when.className = "arcRow__when";
    when.textContent = r.at ? new Date(r.at).toISOString().slice(5, 10) : "\u2014";
    row.appendChild(id);
    row.appendChild(title);
    row.appendChild(when);
    list.appendChild(row);
  });
  body.appendChild(list);
}
function showLaneView() {
  document.getElementById("lane-view").hidden = false;
  document.getElementById("ticket-view").hidden = true;
  document.getElementById("bottleneck-view").hidden = true;
}
function badgeChip(label) {
  const chip = document.createElement("span");
  chip.className = "phaseModal__chip" + (badgeLabels.includes(label) ? " phaseModal__chip--route" : "");
  chip.textContent = label;
  return chip;
}
function ticketCard(c, laneId) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "tkCard";
  const head = document.createElement("div");
  head.className = "tkCard__head";
  const id = document.createElement("span");
  id.className = "tkCard__id";
  id.textContent = "#" + cardKey(c);
  head.appendChild(id);
  (c.labels ?? []).slice(0, 3).forEach((l) => head.appendChild(badgeChip(l)));
  const dur = document.createElement("span");
  dur.className = "tkCard__dur";
  const lastAt = cardLastAt(c);
  dur.textContent = lastAt ? humanize(since(lastAt)) : "\u2014";
  head.appendChild(dur);
  const title = document.createElement("p");
  title.className = "tkCard__title";
  title.textContent = c.title ?? "(untitled)";
  const foot = document.createElement("div");
  foot.className = "tkCard__foot";
  const status = document.createElement("span");
  status.className = "tkCard__status";
  const tok = cardTokens(c);
  status.appendChild(icon("play"));
  const statusTxt = document.createElement("span");
  statusTxt.className = "tkCard__statusTxt";
  statusTxt.textContent = (c.assignee ?? c.author ?? "\u2014") + (tok ? " \xB7 " + fmtTokens(tok) + " tok" : "");
  status.appendChild(statusTxt);
  foot.appendChild(status);
  foot.appendChild(historyRail(c));
  card.appendChild(head);
  card.appendChild(title);
  card.appendChild(foot);
  card.addEventListener("click", () => {
    ticketFrom = "lane";
    openTicket(c, laneId);
  });
  return card;
}
function historyRail(c) {
  const wrap = document.createElement("div");
  wrap.className = "tkRail";
  const h = c.history ?? [];
  h.forEach((_entry, i) => {
    if (i > 0) {
      const line = document.createElement("span");
      line.className = "tkRail__line";
      wrap.appendChild(line);
    }
    const dot = document.createElement("span");
    const isLast = i === h.length - 1;
    dot.className = "tkRail__dot" + (isLast ? " is-here" : "");
    dot.title = h[i].state + (h[i].at ? " \xB7 " + h[i].at.slice(0, 16).replace("T", " ") : "");
    wrap.appendChild(dot);
  });
  return wrap;
}
var runsCache = /* @__PURE__ */ new Map();
var RUNS_TTL_MS = 5 * 60 * 1e3;
async function fetchRuns(sha) {
  const hit = runsCache.get(sha);
  if (hit && Date.now() - hit.at < RUNS_TTL_MS) return hit.failed ? null : hit.runs;
  try {
    const res = await fetch("https://api.github.com/repos/" + st?.repo + "/actions/runs?head_sha=" + sha + "&per_page=100", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const runs = workflowRuns(await res.json());
    runsCache.set(sha, { runs, at: Date.now(), failed: false });
    return runs;
  } catch {
    runsCache.set(sha, { runs: [], at: Date.now(), failed: true });
    return null;
  }
}
function runLink(r) {
  const a = document.createElement("a");
  a.className = "tkRuns__link";
  a.href = r.url;
  a.target = "_blank";
  a.rel = "noopener";
  a.title = r.name + (r.endMs ? " \xB7 " + humanize(r.endMs - r.startedMs) : " \xB7 running") + " \xB7 started " + new Date(r.startedMs).toISOString().slice(11, 19) + " UTC \u2014 opens the run on GitHub";
  a.appendChild(icon("external"));
  const txt = document.createElement("span");
  txt.textContent = r.name || "run";
  a.appendChild(txt);
  return a;
}
function decorateRunWithLinks(row, runs, startMs, endMs, branchFallback) {
  const slot = document.createElement("span");
  slot.className = "tkRuns";
  const inWindow = runs ? runsInWindow(runs, startMs, endMs) : [];
  if (inWindow.length) {
    const shown = inWindow.slice(0, 3);
    shown.forEach((r) => slot.appendChild(runLink(r)));
    if (inWindow.length > shown.length) {
      const more = document.createElement("span");
      more.className = "tkRuns__more";
      more.textContent = "+" + (inWindow.length - shown.length);
      more.title = inWindow.slice(3).map((r) => r.name).join(", ");
      slot.appendChild(more);
    }
  } else if (runs) {
    return;
  } else if (branchFallback) {
    const a = document.createElement("a");
    a.className = "tkRuns__link";
    a.href = branchFallback;
    a.target = "_blank";
    a.rel = "noopener";
    a.title = "Workflow runs for this branch on GitHub";
    a.appendChild(icon("external"));
    const txt = document.createElement("span");
    txt.textContent = "runs";
    a.appendChild(txt);
    slot.appendChild(a);
  } else {
    return;
  }
  row.appendChild(slot);
}
function timelineHue(state) {
  if (["development", "pr_created", "assigned", "agent:dev queued"].includes(state)) return "hue--dev";
  if (["pr_validation", "validating"].includes(state)) return "hue--validate";
  if (state === "review" || state.includes("review")) return "hue--review";
  if (["merged_recent", "merged"].includes(state)) return "hue--merged";
  if (["approved_queue", "queued"].includes(state)) return "hue--queue";
  return "hue--hold";
}
function openTicket(c, laneId) {
  document.getElementById("lane-view").hidden = true;
  document.getElementById("ticket-view").hidden = false;
  document.getElementById("ticket-eyebrow").textContent = "TICKET \xB7 " + (st?.factory ?? "").toUpperCase() + " \xB7 " + cardKind(c).toUpperCase() + " #" + cardKey(c);
  document.getElementById("ticket-title").textContent = "#" + cardKey(c) + " \u2014 " + (c.title ?? "");
  document.getElementById("ticket-gh").setAttribute("href", cardUrl(c));
  const chips = document.getElementById("ticket-chips");
  chips.innerHTML = "";
  (c.labels ?? []).forEach((l) => chips.appendChild(badgeChip(l)));
  if (c.author) chips.appendChild(badgeChip("author: " + c.author));
  if (c.assignee) chips.appendChild(badgeChip("assignee: " + c.assignee));
  if (c.branch) chips.appendChild(badgeChip(c.branch));
  const history = document.getElementById("ticket-history");
  history.innerHTML = "";
  const h = c.history ?? [];
  const nowMs = Date.now();
  const spans = histSpans(h, nowMs, c.mergedAt ?? null);
  const phases = phaseAggregate(spans);
  const maxPhase = Math.max(1, ...phases.map((p) => p.totalMs));
  const flow = document.getElementById("ticket-flow");
  flow.innerHTML = "";
  if (!phases.length) {
    const p = document.createElement("p");
    p.className = "phaseModal__empty";
    p.textContent = "No phase history recorded yet.";
    flow.appendChild(p);
  }
  phases.forEach((p) => {
    const row = document.createElement("div");
    row.className = "tkFlow" + (p.state === h[h.length - 1]?.state ? " is-here" : "");
    const rowTop = document.createElement("div");
    rowTop.className = "tkFlow__row";
    const label = document.createElement("span");
    label.className = "tkFlow__label";
    label.textContent = p.state;
    const visits = document.createElement("span");
    visits.className = "tkFlow__visits";
    visits.textContent = p.visits > 1 ? "\xD7" + p.visits : "";
    const avg = document.createElement("span");
    avg.className = "tkFlow__avg";
    avg.title = "avg per visit";
    avg.textContent = "avg " + humanize(p.avgMs);
    const total = document.createElement("span");
    total.className = "tkFlow__total";
    total.textContent = humanize(p.totalMs);
    rowTop.appendChild(label);
    rowTop.appendChild(visits);
    rowTop.appendChild(avg);
    rowTop.appendChild(total);
    const bar = document.createElement("div");
    bar.className = "tkFlow__bar";
    const fill = document.createElement("span");
    fill.style.width = Math.max(4, Math.round(p.totalMs / maxPhase * 100)) + "%";
    bar.appendChild(fill);
    row.appendChild(rowTop);
    row.appendChild(bar);
    flow.appendChild(row);
  });
  const tl = document.getElementById("ticket-timeline");
  tl.innerHTML = "";
  if (spans.length) {
    const bar = document.createElement("div");
    bar.className = "tkTimeline";
    spans.forEach((s) => {
      const seg = document.createElement("span");
      seg.className = "tkTimeline__seg " + timelineHue(s.state);
      seg.style.flexGrow = String(Math.max(1, s.durMs / 1e3));
      const hh = s.startMs ? new Date(s.startMs).toISOString().slice(11, 16) : "\u2014";
      seg.title = s.state + " \xB7 " + humanize(s.durMs) + " \xB7 from " + hh + " UTC";
      bar.appendChild(seg);
    });
    tl.appendChild(bar);
    const legend = document.createElement("p");
    legend.className = "tkTimeline__legend";
    legend.textContent = spans.length + " phase" + (spans.length === 1 ? "" : "s") + (c.mergedAt ? " \xB7 ends at merge" : " \xB7 ends now") + " \xB7 hover for detail";
    tl.appendChild(legend);
  } else {
    const p = document.createElement("p");
    p.className = "phaseModal__empty";
    p.textContent = "Timeline unavailable (no timestamps).";
    tl.appendChild(p);
  }
  const maxDur = Math.max(1, ...spans.map((s) => s.durMs));
  const histRows = [];
  h.forEach((entry, i) => {
    const next = h[i + 1]?.at;
    const dur = entry.at ? next ? new Date(next).getTime() - new Date(entry.at).getTime() : since(entry.at) : null;
    const startMs = entry.at ? Date.parse(entry.at) : NaN;
    const endMs = next ? Date.parse(next) : c.mergedAt ? Date.parse(c.mergedAt) : Date.now();
    const li = document.createElement("li");
    li.className = "tkHist" + (i === h.length - 1 ? " is-here" : "");
    const row = document.createElement("div");
    row.className = "tkHist__row";
    const label = document.createElement("span");
    label.className = "tkHist__label";
    label.textContent = entry.state;
    const when = document.createElement("code");
    when.textContent = entry.at ? entry.at.slice(5, 16).replace("T", " ") : "\u2014";
    const durEl = document.createElement("span");
    durEl.className = "tkHist__dur";
    durEl.textContent = dur != null ? humanize(dur) : "\u2014";
    row.appendChild(label);
    row.appendChild(when);
    row.appendChild(durEl);
    const bar = document.createElement("div");
    bar.className = "tkHist__bar";
    const fill = document.createElement("span");
    if (dur != null) fill.style.width = Math.round(dur / maxDur * 100) + "%";
    bar.appendChild(fill);
    li.appendChild(row);
    li.appendChild(bar);
    history.appendChild(li);
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) histRows.push({ li, startMs, endMs });
  });
  const raw = document.getElementById("ticket-raw");
  raw.open = false;
  const summary = raw.querySelector("summary");
  summary.innerHTML = "";
  summary.appendChild(icon("play", "tkRawChev"));
  const summaryTxt = document.createElement("span");
  summaryTxt.textContent = "Raw history \xB7 " + h.length + " transition" + (h.length === 1 ? "" : "s");
  summary.appendChild(summaryTxt);
  if (c.head && st) {
    const fb = c.branch ? "https://github.com/" + st.repo + "/actions?query=branch%3A" + encodeURIComponent('"' + c.branch + '"') : null;
    fetchRuns(c.head).then((runs) => {
      if (modal.hidden) return;
      histRows.forEach((r) => decorateRunWithLinks(r.li, runs, r.startMs, r.endMs, fb));
      raw.title = runs && runs.length ? runs.length + " workflow runs on this head \u2014 per-phase links open the matching run" : runs ? "No runs for this head sha \u2014 links fall back to the branch run list" : "GitHub API rate-limited \u2014 links fall back to the branch run list";
    });
  }
  const tokensBox = document.getElementById("ticket-tokens");
  tokensBox.innerHTML = "";
  const tokens = tokensFor(c, tokensStream());
  if (!tokens.length) {
    const p = document.createElement("p");
    p.className = "phaseModal__empty";
    p.textContent = "No token spend recorded for this card yet.";
    tokensBox.appendChild(p);
  } else {
    const table = document.createElement("table");
    table.className = "tkTokens";
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Leg</th><th>Model</th><th>Read</th><th>Write</th><th>Tokens</th><th>Cache read</th></tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    tokens.forEach((t) => {
      const tr = document.createElement("tr");
      const splitless = t.prompt == null && t.completion == null;
      const read = (t.prompt ?? 0) + (t.cacheRead ?? 0);
      const cells = [
        t.leg,
        t.model ?? "\u2014",
        splitless ? "\u2014" : fmtTokens(read),
        splitless ? "\u2014" : fmtTokens(t.completion ?? 0),
        fmtTokens(t.total ?? 0),
        t.cacheRead ? fmtTokens(t.cacheRead) : "\u2014"
      ];
      cells.forEach((v) => {
        const td = document.createElement("td");
        td.textContent = String(v);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tokensBox.appendChild(table);
    const agg = tokenTotals([{ tokens }]);
    const total = document.createElement("p");
    total.className = "phaseModal__empty";
    total.textContent = "Total: " + fmtTokens(cardTokens(c)) + " tokens across " + tokens.length + " legs \xB7 R " + fmtTokens(agg.read) + " / W " + fmtTokens(agg.write) + (agg.unsplit ? " / +" + fmtTokens(agg.unsplit) + " unsplit" : "") + " \xB7 model " + (tokens[tokens.length - 1]?.model ?? "\u2014");
    tokensBox.appendChild(total);
  }
  let rework = 0;
  const seenStates = [];
  (c.history ?? []).forEach((e) => {
    if (seenStates.includes(e.state)) rework += 1;
    else seenStates.push(e.state);
  });
  const stats = document.getElementById("ticket-stats");
  stats.innerHTML = "";
  const totalMs = spans.length ? spans[spans.length - 1].endMs - spans[0].startMs : null;
  const pairs = [
    [c.mergedAt ? "Lead \u2192 merge" : "Lead time", totalMs != null ? humanize(totalMs) : "\u2014"],
    ["Phase visits", String(h.length)],
    ["Rework loops", "\xD7" + rework]
  ];
  pairs.forEach(([k, v]) => {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    stats.appendChild(dt);
    stats.appendChild(dd);
  });
  document.getElementById("ticket-gh").setAttribute("href", cardUrl(c));
  document.getElementById("ticket-back").onclick = () => {
    if (ticketFrom === "bn") openBottlenecks();
    else openLane(laneId);
  };
}
var BN_STUCK_MS = 45 * 60 * 1e3;
var BN_STUCK_STORAGE_MS = 6 * 36e5;
var BN_PIPELINE = /* @__PURE__ */ new Set(["development", "pr_created", "pr_validation", "review", "validating"]);
var bnBtn = document.getElementById("bottleneck-btn");
var ticketFrom = "lane";
function laneCardPairs() {
  if (!st) return [];
  const out = [];
  for (const lane of ALL_LANES) for (const card of st.lanes[lane.id] ?? []) out.push({ lane: lane.id, card });
  return out;
}
function stuckNow(pairs, now) {
  const live = pairs.filter((p) => p.lane !== "merged_recent");
  return [
    ...stuckCards(live.filter((p) => BN_PIPELINE.has(p.lane)), now, BN_STUCK_MS),
    ...stuckCards(live.filter((p) => !BN_PIPELINE.has(p.lane)), now, BN_STUCK_STORAGE_MS)
  ].sort((a, b) => b.ageMs - a.ageMs);
}
function updateBottleneckChip() {
  if (!st) return;
  const now = Date.now();
  const pairs = laneCardPairs();
  const stuck = stuckNow(pairs, now);
  const errs = errorCards(pairs.filter((p) => p.lane !== "merged_recent"));
  const done = deliveredToday(pairs.map((p) => p.card), now);
  const set = (id, n) => {
    const el2 = document.getElementById(id);
    if (el2) {
      el2.textContent = n > 99 ? "99+" : String(n);
      el2.classList.toggle("is-hot", n > 0);
    }
  };
  set("bn-stuck", stuck.length);
  set("bn-err", errs.length);
  set("bn-done", done.length);
}
function bnRow(num, issue, title, meta, metaCls, lane, card) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "bnRow";
  const id = document.createElement("span");
  id.className = "bnRow__id";
  id.textContent = "#" + (num ?? issue ?? "\u2014");
  const ttl = document.createElement("span");
  ttl.className = "bnRow__title";
  ttl.textContent = title;
  ttl.title = title;
  const laneEl = document.createElement("span");
  laneEl.className = "bnRow__lane";
  laneEl.textContent = TITLES[lane] ?? lane;
  const metaEl = document.createElement("span");
  metaEl.className = "bnRow__meta " + metaCls;
  metaEl.textContent = meta;
  row.appendChild(id);
  row.appendChild(ttl);
  row.appendChild(laneEl);
  row.appendChild(metaEl);
  row.addEventListener("click", () => {
    ticketFrom = "bn";
    openTicket(card, lane);
  });
  return row;
}
function bnEmpty(box, text) {
  const p = document.createElement("p");
  p.className = "phaseModal__empty";
  p.textContent = text;
  box.appendChild(p);
}
function openBottlenecks() {
  if (!st) return;
  document.getElementById("lane-view").hidden = true;
  document.getElementById("ticket-view").hidden = true;
  document.getElementById("bottleneck-view").hidden = false;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  modal.querySelector(".phaseModal__close")?.focus();
  document.getElementById("bn-eyebrow").textContent = "BOTTLENECKS \xB7 " + st.factory.toUpperCase() + " \xB7 snapshot " + humanize(since(st.tick.at)) + " ago";
  const now = Date.now();
  const pairs = laneCardPairs();
  const stuck = stuckNow(pairs, now);
  const stuckBox = document.getElementById("bn-stuck-list");
  stuckBox.innerHTML = "";
  if (!stuck.length) bnEmpty(stuckBox, "Nothing stuck \u2014 every open card moved in the last 45m.");
  stuck.slice(0, 8).forEach((sItem) => {
    const card = pairs.find((p) => (p.card.pr ?? p.card.issue) === (sItem.pr ?? sItem.issue) && p.lane === sItem.lane)?.card;
    stuckBox.appendChild(bnRow(sItem.pr, sItem.issue, sItem.title, humanize(sItem.ageMs) + " idle", "is-warn", sItem.lane, card));
  });
  if (stuck.length > 8) {
    const more = document.createElement("p");
    more.className = "bnMore";
    more.textContent = "+" + (stuck.length - 8) + " more stuck";
    stuckBox.appendChild(more);
  }
  const errs = errorCards(pairs.filter((p) => p.lane !== "merged_recent"));
  const errBox = document.getElementById("bn-err-list");
  errBox.innerHTML = "";
  if (!errs.length) bnEmpty(errBox, "No failing checks right now.");
  errs.slice(0, 8).forEach((e) => {
    const card = pairs.find((p) => (p.card.pr ?? p.card.issue) === (e.pr ?? e.issue) && p.lane === e.lane)?.card;
    errBox.appendChild(bnRow(e.pr, e.issue, e.title, e.verdict, "is-bad", e.lane, card));
  });
  const done = deliveredToday(pairs.map((p) => p.card), now);
  const doneBox = document.getElementById("bn-done-list");
  doneBox.innerHTML = "";
  if (!done.length) bnEmpty(doneBox, "Nothing merged today (UTC) yet.");
  const head = document.createElement("p");
  head.className = "bnBig";
  head.textContent = String(done.length) + " delivered";
  doneBox.appendChild(head);
  done.slice(0, 8).forEach((d) => {
    const card = pairs.map((p) => p.card).find((c) => (c.pr ?? c.issue) === (d.pr ?? d.issue));
    doneBox.appendChild(bnRow(d.pr, d.issue, d.title, d.leadMs != null ? "lead " + humanize(d.leadMs) : "\u2014", "is-good", "merged_recent", card));
  });
  const flow = document.getElementById("bn-flow");
  flow.innerHTML = "";
  const ag = flowAverages(pairs.map((p) => p.card), now);
  if (!ag.length) bnEmpty(flow, "No phase history in this snapshot yet.");
  const maxAvg = Math.max(1, ...ag.map((a) => a.avgMs));
  ag.forEach((a) => {
    const row = document.createElement("div");
    row.className = "bnFlow";
    const top = document.createElement("div");
    top.className = "bnFlow__row";
    const label = document.createElement("span");
    label.className = "bnFlow__label";
    label.textContent = a.state + (a.visits > 1 ? " \xD7" + a.visits : "");
    const avg = document.createElement("span");
    avg.className = "bnFlow__avg";
    avg.textContent = "avg " + humanize(a.avgMs);
    top.appendChild(label);
    top.appendChild(avg);
    const bar = document.createElement("div");
    bar.className = "tkFlow__bar";
    const fill = document.createElement("span");
    fill.className = "hue--" + timelineHue(a.state).replace("hue--", "");
    fill.style.width = Math.max(4, Math.round(a.avgMs / maxAvg * 100)) + "%";
    bar.appendChild(fill);
    row.appendChild(top);
    row.appendChild(bar);
    flow.appendChild(row);
  });
}
function setActive(i) {
  activeIdx = i;
  const f = factories[i];
  selectBtnName.textContent = f.name;
  selectBtnDot.style.background = f.accent;
  selectBtnDot.style.boxShadow = "0 0 6px " + f.accent;
  closeFactoryMenu();
  document.documentElement.style.setProperty("--factory-accent", f.accent);
  loadLine.textContent = "Loading " + f.name + " state\u2026";
  loadFactory(i).then((json) => {
    st = json;
    loadLine.hidden = true;
    updateStatus();
    draw();
    renderMobileLanes();
    loadLedger();
  }).catch((err) => {
    loadLine.textContent = "Failed to load " + f.name + " state (" + err.message + ")";
  });
}
function renderFactoryList() {
  const matches = filterFactories(factories, selectSearch.value);
  if (selectHighlight >= matches.length) selectHighlight = Math.max(0, matches.length - 1);
  selectList.innerHTML = "";
  matches.forEach((f, pos) => {
    const realIdx = factories.indexOf(f);
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "board__selectOpt" + (realIdx === activeIdx ? " is-active" : "") + (pos === selectHighlight ? " is-hl" : "");
    btn.dataset.factory = String(realIdx);
    const dot = document.createElement("span");
    dot.className = "board__selectDot";
    dot.style.background = factories[realIdx].accent;
    btn.appendChild(dot);
    const name = document.createElement("span");
    name.className = "board__selectName";
    name.textContent = f.name;
    btn.appendChild(name);
    if (realIdx === activeIdx) {
      const mark = document.createElement("span");
      mark.className = "board__selectMark";
      mark.appendChild(icon("dot"));
      const markTxt = document.createElement("span");
      markTxt.textContent = "live";
      mark.appendChild(markTxt);
      btn.appendChild(mark);
    }
    btn.addEventListener("click", () => setActive(realIdx));
    btn.addEventListener("mouseenter", () => {
      selectHighlight = pos;
      selectList.querySelectorAll(".board__selectOpt").forEach((o) => o.classList.remove("is-hl"));
      btn.classList.add("is-hl");
    });
    li.appendChild(btn);
    selectList.appendChild(li);
  });
  if (!matches.length) {
    const li = document.createElement("li");
    li.className = "board__selectEmpty";
    li.textContent = "No repository matches \u201C" + selectSearch.value.trim() + "\u201D";
    selectList.appendChild(li);
  }
}
function openFactoryMenu() {
  selectMenu.hidden = false;
  selectBtn.setAttribute("aria-expanded", "true");
  selectSearch.value = "";
  selectHighlight = activeIdx;
  renderFactoryList();
  selectSearch.focus();
}
function closeFactoryMenu() {
  selectMenu.hidden = true;
  selectBtn.setAttribute("aria-expanded", "false");
}
function moveHighlight(delta) {
  const opts = selectList.querySelectorAll(".board__selectOpt");
  if (!opts.length) return;
  selectHighlight = (selectHighlight + delta + opts.length) % opts.length;
  opts.forEach((o) => o.classList.remove("is-hl"));
  opts[selectHighlight].classList.add("is-hl");
  opts[selectHighlight].scrollIntoView({ block: "nearest" });
}
selectBtn.addEventListener("click", () => selectMenu.hidden ? openFactoryMenu() : closeFactoryMenu());
selectSearch.addEventListener("input", () => {
  selectHighlight = 0;
  renderFactoryList();
});
selectSearch.addEventListener("keydown", (ev) => {
  if (ev.key === "ArrowDown") {
    ev.preventDefault();
    moveHighlight(1);
  } else if (ev.key === "ArrowUp") {
    ev.preventDefault();
    moveHighlight(-1);
  } else if (ev.key === "Enter") {
    ev.preventDefault();
    const idx = Number(selectList.querySelector(".board__selectOpt.is-hl")?.dataset.factory ?? NaN);
    if (!Number.isNaN(idx)) setActive(idx);
  } else if (ev.key === "Escape") {
    ev.preventDefault();
    closeFactoryMenu();
    selectBtn.focus();
  }
});
document.addEventListener("click", (ev) => {
  if (!selectMenu.hidden && !tabsBox.contains(ev.target)) closeFactoryMenu();
});
function renderMobileLanes() {
  if (!compact.matches || !st) return;
  mobileLanes.innerHTML = "";
  ALL_LANES.forEach((lane) => {
    const cards = cardsIn(lane.id);
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "board__mobileLane";
    btn.textContent = lane.title + " \xB7 " + cards.length;
    btn.addEventListener("click", () => openLane(lane.id));
    li.appendChild(btn);
    mobileLanes.appendChild(li);
  });
}
function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
}
modal.addEventListener("click", (e) => {
  if (e.target.closest("[data-close]")) closeModal();
});
bnBtn.addEventListener("click", () => {
  if (modal.hidden || document.getElementById("bottleneck-view")?.hidden) openBottlenecks();
  else closeModal();
});
document.getElementById("bn-back").onclick = () => closeModal();
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeModal();
});
var resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(draw, 120);
});
compact.addEventListener?.("change", () => {
  draw();
  renderMobileLanes();
});
if (document.fonts?.ready) document.fonts.ready.then(draw);
setInterval(() => {
  loadFactory(activeIdx).then(() => {
    updateStatus();
    draw();
    loadLedger();
  }).catch(() => {
  });
}, 6e4);
setActive(0);
