const NAV = [
  ["dashboard", "Dashboard", "M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z", "d"],
  ["actors", "Threat Actors", "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-7 8a7 7 0 0 1 14 0", "a"],
  ["graph", "Graph", "M5 19V5m0 14h14M7 15l4-5 3 3 5-7", "g"],
  ["collection", "Collection", "M4 7h16v10H4zM8 7V5h8v2", "c"],
  ["infrastructure", "Infrastructure", "M4 15h6v5H4zm10-6h6v11h-6zM9 4h6v16H9z", "n"],
  ["search", "Search", "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm10 2-5.2-5.2", "f"],
  ["analytics", "AI Analytics", "M12 3l1.6 4.2L18 9l-4.4 1.8L12 15l-1.6-4.2L6 9l4.4-1.8zM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z", "i"],
  ["timeline", "Timeline", "M5 4v16m0-8h8m-8 4h12", "t"],
  ["reports", "Reports", "M6 3h8l4 4v14H6zM14 3v5h5", "r"],
  ["settings", "Settings", "M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7zm8-3.5-2-.6a6.7 6.7 0 0 0-.4-1.1l1.1-1.8-1.7-1.7-1.8 1.1a6.7 6.7 0 0 0-1.1-.4L12.5 4h-2.4l-.6 2a6.7 6.7 0 0 0-1.1.4L6.6 5.3 4.9 7l1.1 1.8a6.7 6.7 0 0 0-.4 1.1L3.6 12v2.4l2 .6a6.7 6.7 0 0 0 .4 1.1L4.9 19l1.7 1.7 1.8-1.1a6.7 6.7 0 0 0 1.1.4l.6 2h2.4l.6-2a6.7 6.7 0 0 0 1.1-.4l1.8 1.1 1.7-1.7-1.1-1.8a6.7 6.7 0 0 0 .4-1.1l2-.6z", "s"],
];

const RANGES = {
  full: ["2025-10-01", "2026-12-31", "Full span"],
  y2026: ["2026-01-01", "2026-12-31", "Year 2026"],
  july: ["2026-07-01", "2026-12-31", "From July 2026"],
};

const CATEGORY_COLORS = {
  "hacking services": "#3ee0d0",
  "stolen data": "#b07cff",
  drugs: "#4ea1ff",
  arms: "#ff5d73",
  "money laundering": "#f0a35e",
  "terror financing": "#e6c15a",
};

const KIND_COLORS = {
  pgp: "#4ea1ff",
  wallet: "#3ee0d0",
  handle: "#e6c15a",
  onion: "#f0a35e",
  jabber: "#d56bff",
  clearnet: "#3dd68c",
  actor: "#7c6bff",
};

const DEFAULT_SAMPLE = [
  "I keep build notes on every box. We ship the panel and we take the fee.",
  "Don't ask for extras. If the buyer pays late I drop the job.",
  "I don't haggle and we move on. That's the whole offer.",
  "I post the same terms every time.",
].join(" ");

const state = {
  view: "dashboard",
  q: "",
  category: "",
  source: "",
  minConfidence: 0,
  start: RANGES.full[0],
  end: RANGES.full[1],
  meta: null,
  sources: [],
  selectedId: null,
  profileTab: "activity",
  analyticsTab: "behaviour",
  sampleText: DEFAULT_SAMPLE,
  candidateName: "NightPanel",
  graph: null,
  graphQuery: "",
  graphKinds: [],
  entityKind: "",
  paletteIndex: 0,
};

let renderToken = 0;
let shellBound = false;

const $ = (id) => document.getElementById(id);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function svg(path) {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
}

function brand() {
  return `<span class="brand"><svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><path d="M16 2.5 28.5 9.5v13L16 29.5 3.5 22.5v-13Z" fill="none" stroke="#8d7bff" stroke-width="1.4"/><path d="M16 8.2 23 12.2v8L16 24.2 9 20.2v-8Z" fill="#6d5efc"/></svg><strong>EchoLeaks</strong></span>`;
}

function initials(name) {
  const parts = String(name || "A").split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0] || "").join("").toUpperCase();
}

function queryString() {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.category) params.set("category", state.category);
  if (state.source) params.set("source", state.source);
  params.set("min_confidence", String(state.minConfidence || 0));
  if (state.start) params.set("start", state.start);
  if (state.end) params.set("end", state.end);
  return params.toString();
}

async function api(path, options) {
  const response = await fetch(path, options);
  const type = response.headers.get("content-type") || "";
  if (!response.ok) {
    let message = response.statusText;
    if (type.includes("json")) {
      const body = await response.json();
      message = body.detail || message;
      if (Array.isArray(message)) message = message.map((item) => item.msg || String(item)).join(" ");
    } else {
      message = await response.text();
    }
    throw new Error(message || "Request failed");
  }
  if (type.includes("application/json")) return response.json();
  return response;
}

function banner(message, kind) {
  const el = $("banner");
  const text = message === "Failed to fetch"
    ? "The API is not reachable. Start the server, then reload this page."
    : message;
  if (el) {
    el.hidden = !text;
    el.textContent = text || "";
    el.className = `banner ${kind || ""}`.trim();
  }
  if (text) toast(text, kind);
}

function toast(message, kind) {
  if (prefs().toasts === false) return;
  const host = $("toasts");
  if (!host || !message) return;
  const note = document.createElement("div");
  note.className = `toast ${kind || ""}`.trim();
  note.textContent = message;
  host.appendChild(note);
  setTimeout(() => note.remove(), 4200);
}

function prefs() {
  try {
    return JSON.parse(localStorage.getItem("echo_prefs") || "{}");
  } catch {
    return {};
  }
}

function savePrefs(next) {
  localStorage.setItem("echo_prefs", JSON.stringify({ ...prefs(), ...next }));
}

function animateCount(node) {
  if (!node) return;
  const target = Number(node.dataset.count || 0);
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / 640);
    const value = Math.round(target * (1 - (1 - t) ** 3));
    node.textContent = node.dataset.suffix ? `${value}${node.dataset.suffix}` : String(value);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function chip(category) {
  const color = CATEGORY_COLORS[category] || "#9aa";
  return `<span class="chip"><i style="background:${color};width:8px;height:8px;border-radius:50%;display:inline-block"></i>${esc(category)}</span>`;
}

function meter(value) {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  return `<span class="meter" title="${width}"><i style="width:${width}%"></i></span>${Math.round(width)}`;
}

function statusPill(status) {
  const kind = status === "active" ? "good" : status === "dormant" ? "warn" : "hot";
  return `<span class="pill ${kind}">${esc(status || "active")}</span>`;
}

function rangeKey() {
  const found = Object.entries(RANGES).find(([, value]) => value[0] === state.start && value[1] === state.end);
  return found ? found[0] : "full";
}

function userName() {
  return sessionStorage.getItem("echoleaks_user") || "Analyst";
}

function renderLogin() {
  $("login").innerHTML = `
    <section class="login" id="login-stage">
      <div class="login-hero">
        <canvas id="net" aria-hidden="true"></canvas>
        <div class="glow-follow" aria-hidden="true"></div>
        <div class="login-brand">${brand()}</div>
        <div class="login-copy">
          <p class="eyebrow">Threat intelligence · Attribution</p>
          <h1>From anonymity to attribution</h1>
          <p class="tag">Uncover. Link. Identify.</p>
          <p>A local investigation desk for actors, identifiers, infrastructure notes, and writing-style links.</p>
        </div>
        <div class="feature-list">
          <article><span class="dot">1</span><div><strong>Collect</strong><span>Ingest source files that clear the reliability bar.</span></div></article>
          <article><span class="dot">2</span><div><strong>Analyze</strong><span>Graph links, stylometry, and behavioural profiles.</span></div></article>
          <article><span class="dot">3</span><div><strong>Attribute</strong><span>Confidence, persona clusters, and exportable reports.</span></div></article>
        </div>
      </div>
      <div class="login-panel">
        <form class="login-card stack" id="login-form">
          <div class="mode-switch" role="tablist">
            <button type="button" id="mode-in" aria-pressed="true">Sign in</button>
            <button type="button" id="mode-up" aria-pressed="false">Open a desk</button>
          </div>
          <h2 id="login-title">Welcome back</h2>
          <p class="lede" id="login-lede">Open the local workbench. This session stays in the browser.</p>
          <label class="field">Work email<input name="email" type="email" placeholder="analyst@example.com" autocomplete="username"></label>
          <label class="field">Password<input name="password" type="password" placeholder="Password" autocomplete="current-password"></label>
          <label class="check"><input type="checkbox" checked> Keep this desk on this browser</label>
          <button class="btn primary full" type="submit" id="login-submit">Sign in</button>
          <button class="btn full" type="button" id="guest-entry">Continue as analyst</button>
          <p class="fine">No account is created and nothing is sent to a third party.</p>
        </form>
      </div>
    </section>
  `;
  const setMode = (signup) => {
    $("mode-in").setAttribute("aria-pressed", signup ? "false" : "true");
    $("mode-up").setAttribute("aria-pressed", signup ? "true" : "false");
    $("login-title").textContent = signup ? "Open a desk" : "Welcome back";
    $("login-lede").textContent = signup
      ? "Name this browser session. It is stored only on this machine."
      : "Open the local workbench. This session stays in the browser.";
    $("login-submit").textContent = signup ? "Create local session" : "Sign in";
  };
  $("mode-in").addEventListener("click", () => setMode(false));
  $("mode-up").addEventListener("click", () => setMode(true));
  $("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const email = new FormData(event.target).get("email");
    const name = String(email || "").split("@")[0].trim();
    sessionStorage.setItem("echoleaks_user", name || "Analyst");
    enterApp().catch(showLoginError);
  });
  $("guest-entry").addEventListener("click", () => {
    sessionStorage.setItem("echoleaks_user", "Analyst");
    enterApp().catch(showLoginError);
  });
  const stage = $("login-stage");
  stage.addEventListener("mousemove", (event) => {
    const rect = stage.getBoundingClientRect();
    stage.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    stage.style.setProperty("--my", `${event.clientY - rect.top}px`);
  });
  startLoginNet();
}

function startLoginNet() {
  const canvas = $("net");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const nodes = Array.from({ length: 42 }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.00035,
    vy: (Math.random() - 0.5) * 0.00035,
  }));
  let frame = 0;
  const draw = () => {
    if (!$("net") || $("login").hidden) return;
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 700;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    nodes.forEach((node) => {
      node.x += node.vx;
      node.y += node.vy;
      if (node.x < 0 || node.x > 1) node.vx *= -1;
      if (node.y < 0 || node.y > 1) node.vy *= -1;
    });
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const dx = (nodes[i].x - nodes[j].x) * width;
        const dy = (nodes[i].y - nodes[j].y) * height;
        const dist = Math.hypot(dx, dy);
        if (dist > 140) continue;
        ctx.strokeStyle = `rgba(139,124,255,${(1 - dist / 140) * 0.35})`;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x * width, nodes[i].y * height);
        ctx.lineTo(nodes[j].x * width, nodes[j].y * height);
        ctx.stroke();
      }
    }
    nodes.forEach((node) => {
      ctx.fillStyle = "#3ee0d0";
      ctx.beginPath();
      ctx.arc(node.x * width, node.y * height, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });
    frame = requestAnimationFrame(draw);
  };
  cancelAnimationFrame(frame);
  draw();
}

function renderShell() {
  $("sidebar").innerHTML = `
    ${brand()}
    <nav class="nav" id="nav">
      ${NAV.map(([id, label, path]) => `<button type="button" data-view="${id}">${svg(path)}<span>${label}</span></button>`).join("")}
    </nav>
    <div class="sidebar-foot"><div class="live"><i></i> Collection loop</div>Local feeds are checked on the interval in Settings.</div>
  `;
  const options = Object.entries(RANGES).map(([key, value]) => (
    `<option value="${key}" ${key === rangeKey() ? "selected" : ""}>${value[2]}</option>`
  )).join("");
  $("topbar").innerHTML = `
    <form class="search" id="top-search">
      ${svg("M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm10 2-5.2-5.2")}
      <input id="top-q" type="search" placeholder="Search actors, handles, wallets, PGP keys…" value="${esc(state.q)}" aria-label="Global search">
    </form>
    <button class="palette-btn" type="button" id="open-palette">Commands <span class="kbd">Ctrl K</span></button>
    <select class="range" id="range" aria-label="Time range">${options}</select>
    <div class="user-chip">
      <span class="avatar">${esc(initials(userName()))}</span>
      <span>${esc(userName())}</span>
      <button type="button" id="sign-out">Sign out</button>
    </div>
  `;
  $("nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (button) location.hash = button.dataset.view;
  });
  $("top-search").addEventListener("submit", (event) => {
    event.preventDefault();
    state.q = $("top-q").value.trim();
    rememberSearch(state.q);
    location.hash = "search";
    if (state.view === "search") renderView();
  });
  $("range").addEventListener("change", () => {
    const next = RANGES[$("range").value] || RANGES.full;
    state.start = next[0];
    state.end = next[1];
    renderView();
  });
  $("sign-out").addEventListener("click", () => {
    sessionStorage.removeItem("echoleaks_user");
    $("app").hidden = true;
    $("login").hidden = false;
    renderLogin();
  });
  $("open-palette").addEventListener("click", openPalette);
}

function markNav() {
  document.querySelectorAll("#nav button").forEach((button) => {
    if (button.dataset.view === state.view) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

function rememberSearch(term) {
  if (!term) return;
  const prior = JSON.parse(sessionStorage.getItem("echo_recent") || "[]");
  const next = [term, ...prior.filter((item) => item !== term)].slice(0, 6);
  sessionStorage.setItem("echo_recent", JSON.stringify(next));
}

async function enterApp() {
  state.meta = await api("/api/meta");
  state.sources = await api("/api/sources");
  $("login").hidden = true;
  $("app").hidden = false;
  renderShell();
  if (!shellBound) {
    shellBound = true;
    $("view").addEventListener("click", onViewClick);
    $("view").addEventListener("submit", onSubmit);
    window.addEventListener("hashchange", applyHash);
    window.addEventListener("resize", () => {
      if (state.view === "graph" && state.graph) drawGraph(state.graph);
    });
  }
  if (!location.hash || location.hash === "#") location.hash = "dashboard";
  else applyHash();
}

function applyHash() {
  const name = (location.hash || "#dashboard").slice(1);
  state.view = NAV.some(([id]) => id === name) ? name : "dashboard";
  renderView();
}

async function renderView() {
  const token = ++renderToken;
  markNav();
  const view = $("view");
  view.innerHTML = `<div class="skeleton-page"><div class="sk sk-title"></div><div class="sk-grid"><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div></div></div>`;
  try {
    if (state.view === "dashboard") await renderDashboard(token);
    else if (state.view === "actors") await renderActors(token);
    else if (state.view === "graph") await renderGraph(token);
    else if (state.view === "collection") await renderCollection(token);
    else if (state.view === "infrastructure") await renderInfrastructure(token);
    else if (state.view === "search") await renderSearch(token);
    else if (state.view === "analytics") await renderAnalytics(token);
    else if (state.view === "timeline") await renderTimeline(token);
    else if (state.view === "reports") await renderReports(token);
    else if (state.view === "settings") await renderSettings(token);
    if (token === renderToken) {
      banner("", "");
      view.classList.remove("view-enter");
      void view.offsetWidth;
      view.classList.add("view-enter");
    }
  } catch (error) {
    if (token !== renderToken) return;
    view.innerHTML = "";
    banner(error.message, "error");
  }
}

function monthSeries(actors, extraMonths = []) {
  const months = [...new Set([
    ...extraMonths,
    ...actors.map((actor) => String(actor.first_seen || "").slice(0, 7)),
  ].filter((month) => String(month).length === 7))].sort();
  let running = 0;
  const totals = [];
  const news = [];
  months.forEach((month) => {
    const born = actors.filter((actor) => String(actor.first_seen || "").startsWith(month)).length;
    running += born;
    news.push(born);
    totals.push(running);
  });
  return { months, news, totals };
}

function chartLayout(labels, series, width, height) {
  const pad = { l: 36, r: 16, t: 16, b: 28 };
  const max = Math.max(1, ...series.flatMap((item) => item.values));
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const xAt = (index, count) => pad.l + (count <= 1 ? plotW / 2 : (plotW * index) / (count - 1));
  const points = [];
  series.forEach((item) => {
    item.values.forEach((value, index) => {
      points.push({
        x: xAt(index, labels.length),
        y: pad.t + plotH - (value / max) * plotH,
        index,
        value,
        name: item.name,
        color: item.color,
        label: labels[index],
      });
    });
  });
  return { pad, max, plotW, plotH, points };
}

function drawLine(canvas, labels, series, hover) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 640;
  const height = canvas.clientHeight || 240;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const layout = chartLayout(labels, series, width, height);
  ctx.strokeStyle = "rgba(146,170,220,0.15)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const y = layout.pad.t + (layout.plotH / 3) * i;
    ctx.beginPath();
    ctx.moveTo(layout.pad.l, y);
    ctx.lineTo(width - layout.pad.r, y);
    ctx.stroke();
  }
  if (hover) {
    ctx.strokeStyle = "rgba(124,107,255,0.45)";
    ctx.beginPath();
    ctx.moveTo(hover.x, layout.pad.t);
    ctx.lineTo(hover.x, layout.pad.t + layout.plotH);
    ctx.stroke();
  }
  ctx.fillStyle = "#8d9bbd";
  ctx.font = "11px Segoe UI, sans-serif";
  labels.forEach((label, index) => {
    if (labels.length > 8 && index % 2 && (!hover || hover.index !== index)) return;
    const x = layout.pad.l + (labels.length === 1 ? layout.plotW / 2 : (layout.plotW * index) / (labels.length - 1));
    ctx.fillText(String(label).slice(2), x - 14, height - 8);
  });
  series.forEach((item) => {
    ctx.beginPath();
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 2;
    item.values.forEach((value, index) => {
      const point = layout.points.find((entry) => entry.name === item.name && entry.index === index);
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    item.values.forEach((value, index) => {
      const point = layout.points.find((entry) => entry.name === item.name && entry.index === index);
      const active = hover && hover.index === index;
      ctx.beginPath();
      ctx.fillStyle = item.color;
      ctx.arc(point.x, point.y, active ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  canvas._layout = layout;
}

function bindTrend(canvas, labels, series) {
  drawLine(canvas, labels, series, null);
  const tip = $("trend-tip");
  const nearest = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let best = null;
    let bestDist = 28;
    (canvas._layout?.points || []).forEach((point) => {
      const dist = Math.hypot(point.x - x, point.y - y);
      if (dist < bestDist) {
        best = point;
        bestDist = dist;
      }
    });
    return best;
  };
  canvas.onmousemove = (event) => {
    const point = nearest(event);
    drawLine(canvas, labels, series, point);
    if (!tip) return;
    if (!point) {
      tip.hidden = true;
      return;
    }
    const sameMonth = (canvas._layout.points || []).filter((entry) => entry.index === point.index);
    tip.hidden = false;
    tip.innerHTML = `<strong>${esc(point.label)}</strong><br>${sameMonth.map((entry) => `${esc(entry.name)}: ${entry.value}`).join("<br>")}<br><span class="muted">Click for who appeared</span>`;
    const box = canvas.parentElement.getBoundingClientRect();
    tip.style.left = `${event.clientX - box.left + 12}px`;
    tip.style.top = `${event.clientY - box.top - 12}px`;
  };
  canvas.onmouseleave = () => {
    drawLine(canvas, labels, series, null);
    if (tip) tip.hidden = true;
  };
  canvas.onclick = (event) => {
    const point = nearest(event);
    if (!point) return;
    explainMonth(point.label);
  };
}

function showInsight(anchor, title, body) {
  if (!anchor) return false;
  let panel = $("insight");
  if (panel && panel.dataset.key === title && panel.previousElementSibling === anchor) {
    panel.remove();
    return false;
  }
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "insight";
    panel.className = "insight";
  }
  panel.dataset.key = title;
  panel.innerHTML = `<h3>${esc(title)}</h3>${body}<button type="button" class="btn ghost" data-action="close-insight">Close</button>`;
  anchor.insertAdjacentElement("afterend", panel);
  panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  return true;
}

function explainStat(kind) {
  const board = state.board || { actors: [], overview: { clusters: [] } };
  const actors = board.actors;
  const grid = document.querySelector(".stat-grid");
  document.querySelectorAll("button.stat").forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.stat === kind ? "true" : "false");
  });
  let opened = false;
  if (kind === "total") {
    opened = showInsight(grid, "Total Actors", `<p>Profiles with at least one recorded event between ${esc(state.start)} and ${esc(state.end)}. The time range above rebuilds this count.</p><ul>${actors.map((actor) => `<li><button type="button" class="btn ghost" data-action="open-actor" data-id="${actor.id}">${esc(actor.display_name)}</button> · ${esc(actor.category)}</li>`).join("") || "<li>None in this window.</li>"}</ul>`);
  } else if (kind === "new") {
    const born = actors.filter((actor) => actor.first_seen && actor.first_seen >= state.start);
    opened = showInsight(grid, "New Actors", `<p>Profiles whose first-seen date falls inside this range. Personas already on file from an earlier month stay in Total Actors and are left out of this count.</p><ul>${born.map((actor) => `<li><button type="button" class="btn ghost" data-action="open-actor" data-id="${actor.id}">${esc(actor.display_name)}</button> · first seen ${esc(actor.first_seen)}</li>`).join("") || "<li>No new personas in this range.</li>"}</ul>`);
  } else if (kind === "links") {
    const clusters = board.overview.clusters || [];
    opened = showInsight(grid, "Linked Entities", `<p>Relationship edges between actors: shared PGP keys, wallets, handles, messenger ids, trust notes, and reviewed writing-style links. A persona cluster is a group whose strongest link scores 60 or higher.</p><ul>${clusters.map((cluster) => `<li><strong>${esc(cluster.label)}</strong> · ${cluster.members.map((member) => esc(member.display_name)).join(", ")}</li>`).join("") || "<li>No cluster in this window.</li>"}</ul>`);
  } else {
    const ranked = [...actors].sort((a, b) => b.attribution_confidence - a.attribution_confidence);
    opened = showInsight(grid, "Attribution Confidence", `<p>The average of the confidence stored on each profile in this window. Each score is the figure recorded with that actor. Opening a profile shows the identifiers and links behind it.</p><ul>${ranked.map((actor) => `<li><button type="button" class="btn ghost" data-action="open-actor" data-id="${actor.id}">${esc(actor.display_name)}</button> · ${Math.round(actor.attribution_confidence)}</li>`).join("") || "<li>No profiles in this window.</li>"}</ul>`);
  }
  if (!opened) {
    document.querySelectorAll("button.stat").forEach((button) => button.setAttribute("aria-pressed", "false"));
  }
}

function explainMonth(month) {
  const actors = (state.board && state.board.actors) || [];
  const events = (state.board && state.board.eventMap && state.board.eventMap[month]) || 0;
  const born = actors.filter((actor) => String(actor.first_seen || "").startsWith(month));
  const card = document.querySelector(".chart-grid .card");
  showInsight(card, month, `<p>${events} recorded event${events === 1 ? "" : "s"} this month. ${born.length} actor${born.length === 1 ? "" : "s"} first seen then.</p><ul>${born.map((actor) => `<li><button type="button" class="btn ghost" data-action="open-actor" data-id="${actor.id}">${esc(actor.display_name)}</button> · ${esc(actor.category)}</li>`).join("") || "<li>No new profile starts in this month. The event count still includes scans and notes on personas already on file.</li>"}</ul>`);
}

function sliceFromPointer(event) {
  const el = event.target.closest(".donut");
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const dist = Math.hypot(dx, dy);
  if (dist < rect.width * 0.32 || dist > rect.width * 0.5) return null;
  const deg = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
  const pct = (deg / 360) * 100;
  return (state.donutSlices || []).find((slice) => pct >= slice.start && pct < slice.end) || null;
}

function explainCategory(category) {
  const actors = ((state.board && state.board.actors) || []).filter((actor) => actor.category === category);
  const card = document.querySelector(".chart-grid .card:last-child");
  showInsight(card, category, `<p>Actors filed under ${esc(category)} in the current window. The slice is that count divided by every actor in the window.</p><ul>${actors.map((actor) => `<li><button type="button" class="btn ghost" data-action="open-actor" data-id="${actor.id}">${esc(actor.display_name)}</button> · confidence ${Math.round(actor.attribution_confidence)}</li>`).join("") || "<li>None in this window.</li>"}</ul><button type="button" class="btn" data-action="filter-category" data-category="${esc(category)}">Show only this category</button>`);
}

function donut(categories, total) {
  if (!total) return `<div class="donut" style="background:#1c2744"><div><strong>0</strong><span class="muted">actors</span></div></div>`;
  let cursor = 0;
  state.donutSlices = [];
  const stops = categories.map((item) => {
    const start = cursor;
    cursor += (item.count / total) * 100;
    state.donutSlices.push({ category: item.category, start, end: cursor });
    const color = CATEGORY_COLORS[item.category] || "#8899aa";
    return `${color} ${start}% ${cursor}%`;
  });
  const rows = categories.map((item) => (
    `<button type="button" data-action="explain-category" data-category="${esc(item.category)}"><b style="color:${CATEGORY_COLORS[item.category] || "#fff"}">${esc(item.category)}</b><em>${Math.round((item.count / total) * 100)}%</em></button>`
  )).join("");
  return `
    <div class="donut-wrap">
      <div class="donut" data-action="donut-hit" style="background:conic-gradient(${stops.join(",")})"><div><strong>${total}</strong><span class="muted">actors</span></div></div>
      <div class="donut-legend">${rows}</div>
    </div>
  `;
}

async function loadProfile(actorId) {
  if (!actorId) return null;
  state.selectedId = actorId;
  return api(`/api/actors/${actorId}`);
}

function profileCard(profile) {
  if (!profile) return `<article class="card profile"><h2>Threat Actor Profile</h2><p class="muted">Select an actor to open the profile.</p></article>`;
  const actor = profile.actor;
  const byKind = Object.fromEntries(profile.identifiers.map((item) => [item.kind, item.value]));
  const tab = state.profileTab;
  let body = "";
  if (tab === "activity") {
    body = `<ul class="activity">${profile.events.slice(0, 5).map((event) => `<li><strong>${esc(event.occurred_at.slice(0, 10))}</strong> ${esc(event.event_type)}<div class="muted">${esc(event.detail)}</div></li>`).join("") || `<li class="muted">No events in the file.</li>`}</ul>`;
  } else if (tab === "links") {
    body = `<ul class="activity">${profile.links.map((link) => `<li><button type="button" class="btn ghost" data-action="open-actor" data-id="${link.actor_id}">${esc(link.display_name)}</button> ${meter(link.score)}<div class="muted">${esc(link.methods.map((method) => method.detail).join(" · "))}</div></li>`).join("") || `<li class="muted">No links yet.</li>`}</ul>`;
  } else {
    const types = (state.meta?.indicator_types || []).map((item) => `<option value="${esc(item.id)}">${esc(item.label)}</option>`).join("");
    body = `
      <ul class="activity">${profile.indicators.map((item) => `<li>${esc(item.type_label)} ${item.inventory_match ? `<span class="pill good">${esc(item.clearnet_match)}</span>` : `<span class="pill">unmatched</span>`}<div class="muted">${esc(item.observation)}</div></li>`).join("") || `<li class="muted">No infrastructure notes.</li>`}</ul>
      <form class="stack" data-form="indicator" style="margin-top:10px">
        <input type="hidden" name="actor_id" value="${actor.id}">
        <label class="field">Type<select name="indicator_type">${types}</select></label>
        <label class="field">Clearnet match<input name="clearnet_match" placeholder="host.example.net"></label>
        <label class="field">Observation<textarea name="observation" placeholder="What the source report recorded"></textarea></label>
        <button class="btn primary" type="submit">Store note</button>
      </form>
    `;
  }
  const grouped = profile.identifiers.map((item) => `<span class="chip">${esc(item.kind)}</span> ${esc(item.value)}`).join("<br>");
  const behavior = profile.behavior;
  return `
    <article class="card profile">
      <p class="eyebrow">Investigation dossier</p>
      <h2>Threat Actor Profile</h2>
      <div class="who">
        <span class="avatar-lg">${esc(initials(actor.display_name))}</span>
        <div>
          <strong>${esc(actor.display_name)}</strong>
          <p>${chip(actor.category)} ${statusPill(actor.status)}</p>
        </div>
      </div>
      <p class="muted">${esc(actor.summary || "")}</p>
      <div class="kv">
        <div><span>Handles</span><b>${esc(byKind.handle || "—")}</b></div>
        <div><span>PGP</span><b>${esc(byKind.pgp || "—")}</b></div>
        <div><span>Wallet</span><b>${esc(byKind.wallet || "—")}</b></div>
        <div><span>Messenger</span><b>${esc(byKind.jabber || "—")}</b></div>
        <div><span>Tor service ref</span><b>${esc(byKind.onion || "—")}</b></div>
        <div><span>Clearnet</span><b>${esc(byKind.clearnet || "—")}</b></div>
        <div><span>Last seen</span><b>${esc(actor.last_seen || actor.last_scan || "—")}</b></div>
        <div><span>Source</span><b>${esc(actor.primary_source || "—")}</b></div>
      </div>
      <p class="muted">${grouped || "No identifiers on file."}</p>
      ${behavior ? `<p class="muted">${behavior.event_count} events · ${behavior.active_span_days} day span · ${behavior.shared_identifier_count} shared identifiers</p>` : ""}
      <p class="muted">Attribution confidence <span class="badge evidence">Recorded score</span></p>
      <p>${meter(actor.attribution_confidence)}</p>
      <div class="tabs">
        <button type="button" data-tab="activity" ${tab === "activity" ? 'aria-current="page"' : ""}>Activity</button>
        <button type="button" data-tab="links" ${tab === "links" ? 'aria-current="page"' : ""}>Links</button>
        <button type="button" data-tab="notes" ${tab === "notes" ? 'aria-current="page"' : ""}>Notes</button>
      </div>
      ${body}
      <button class="btn full" type="button" data-action="open-graph" data-id="${actor.id}" style="margin-top:12px">View in Graph</button>
    </article>
  `;
}

async function renderDashboard(token) {
  const [overview, actors, sources] = await Promise.all([
    api(`/api/overview?${queryString()}`),
    api(`/api/actors?${queryString()}`),
    api("/api/sources"),
  ]);
  if (token !== renderToken) return;
  const newest = actors.filter((actor) => actor.first_seen && actor.first_seen >= state.start).length;
  const average = actors.length
    ? Math.round(actors.reduce((sum, actor) => sum + Number(actor.attribution_confidence || 0), 0) / actors.length)
    : 0;
  const months = monthSeries(actors, overview.timeline.map((item) => item.month));
  const selected = state.selectedId && actors.some((actor) => actor.id === state.selectedId)
    ? state.selectedId
    : actors[0]?.id;
  const profile = selected ? await loadProfile(selected) : null;
  if (token !== renderToken) return;
  $("view").innerHTML = `
    <div class="dash">
      <div>
        <div class="page-head">
          <p class="eyebrow">EchoLeaks · ${esc(state.start)} – ${esc(state.end)}</p>
          <h1>Intelligence overview</h1>
          <p class="muted">Actors, links, and collection status for this time window.</p>
        </div>
        <section class="stat-grid">
          <button type="button" class="card stat" data-action="explain-stat" data-stat="total"><span class="muted">Total threat actors</span><b data-count="${overview.actor_count}">0</b><span class="muted">in this window</span></button>
          <button type="button" class="card stat" data-action="explain-stat" data-stat="new"><span class="muted">Newly identified</span><b data-count="${newest}">0</b><span class="muted">first seen in this range</span></button>
          <button type="button" class="card stat" data-action="explain-stat" data-stat="links"><span class="muted">Linked entities</span><b data-count="${overview.link_count}">0</b><span class="muted">${overview.cluster_count} persona clusters</span></button>
          <button type="button" class="card stat" data-action="explain-stat" data-stat="confidence"><span class="muted">Attribution confidence</span><b data-count="${average}" data-suffix="%">0%</b><span class="muted">average across this set</span></button>
        </section>
        <section class="chart-grid">
          <article class="card">
            <h2>Actor Trends</h2>
            <p class="muted">Hover a point for the month. Click it to see who was first seen then.</p>
            <div class="legend"><span><i style="background:#4ea1ff"></i>Events</span><span><i style="background:#7c6bff"></i>New actors</span></div>
            <div class="chart-box"><canvas id="trend"></canvas><div id="trend-tip" class="tip" hidden></div></div>
          </article>
          <article class="card">
            <h2>Threat Categories</h2>
            ${donut(overview.categories, overview.actor_count)}
          </article>
        </section>
        <section class="intel-row">
          <article class="card">
            <h2>Recent discoveries</h2>
            <ul class="activity">${[...actors].sort((a, b) => String(b.first_seen).localeCompare(String(a.first_seen))).slice(0, 4).map((actor) => `<li><button type="button" class="btn ghost" data-action="open-actor" data-id="${actor.id}">${esc(actor.display_name)}</button><div class="muted">${esc(actor.first_seen || "—")} · ${esc(actor.category)}</div></li>`).join("") || `<li class="empty">No actors in this window.</li>`}</ul>
          </article>
          <article class="card">
            <h2>Active investigations</h2>
            <div class="cluster-row">
              ${overview.clusters.map((cluster, index) => `<button type="button" class="btn" data-action="explain-cluster" data-index="${index}">${esc(cluster.label)} · ${cluster.members.length}</button>`).join("") || `<span class="muted">No cluster in this window.</span>`}
            </div>
          </article>
          <article class="card">
            <h2>Collection status</h2>
            <p class="live"><i></i> ${sources.filter((source) => source.last_ingest).length} sources ingested</p>
            <ul class="activity">${(overview.ingest_log || []).slice(0, 3).map((item) => `<li><span class="pill ${item.status === "imported" ? "good" : item.status === "rejected" ? "bad" : "warn"}">${esc(item.status)}</span> ${esc(item.source_name || item.feed_name)}</li>`).join("") || `<li class="muted">No ingest events yet.</li>`}</ul>
          </article>
        </section>
      </div>
      <div id="profile-slot">${profileCard(profile)}</div>
    </div>
  `;
  const eventMap = Object.fromEntries(overview.timeline.map((item) => [item.month, item.count]));
  state.board = { actors, overview, eventMap };
  bindTrend($("trend"), months.months, [
    { name: "Events", color: "#4ea1ff", values: months.months.map((month) => eventMap[month] || 0) },
    { name: "New actors", color: "#7c6bff", values: months.news },
  ]);
  document.querySelectorAll("[data-count]").forEach(animateCount);
}

function actorTable(actors) {
  if (!actors.length) return `<tr><td colspan="6" class="muted">No actors matched this query.</td></tr>`;
  return actors.map((actor) => `
    <tr class="clickable" data-action="open-actor" data-id="${actor.id}">
      <td><strong>${esc(actor.display_name)}</strong><div class="muted">${esc(actor.status)}</div></td>
      <td>${chip(actor.category)}</td>
      <td>${meter(actor.attribution_confidence)}</td>
      <td>${(actor.identifier_preview || []).map(esc).join("<br>") || "—"}</td>
      <td>${actor.link_count || 0}</td>
      <td>${esc(actor.last_scan || "—")}<div class="muted">${esc(actor.primary_source || "")}</div></td>
    </tr>
  `).join("");
}

async function renderActors(token) {
  const actors = await api(`/api/actors?${queryString()}`);
  if (token !== renderToken) return;
  const selected = state.selectedId && actors.some((actor) => actor.id === state.selectedId)
    ? state.selectedId
    : actors[0]?.id;
  const profile = selected ? await loadProfile(selected) : null;
  if (token !== renderToken) return;
  const categories = [`<option value="">All categories</option>`].concat(
    (state.meta?.categories || []).map((category) => `<option value="${esc(category)}" ${category === state.category ? "selected" : ""}>${esc(category)}</option>`),
  ).join("");
  $("view").innerHTML = `
    <div class="dash">
      <div>
        <div class="page-head"><p class="eyebrow">Actor database</p><h1>Threat actors</h1><p class="muted">${actors.length} profiles in this window. Open a card or a row for the dossier.</p></div>
        <form class="filters" data-form="report-filters">
          <label class="field">Category<select name="category">${categories}</select></label>
          <label class="field">Min confidence<input name="min_confidence" type="number" min="0" max="100" value="${state.minConfidence}"></label>
          <button class="btn" type="submit">Apply</button>
        </form>
        <div class="actor-cards">
          ${actors.slice(0, 4).map((actor) => `
            <button type="button" class="card actor-card" data-action="open-actor" data-id="${actor.id}" ${actor.id === selected ? 'aria-pressed="true"' : ""}>
              <strong>${esc(actor.display_name)}</strong>
              <p>${chip(actor.category)} ${statusPill(actor.status)}</p>
              <p>${meter(actor.attribution_confidence)}</p>
              <p class="muted">${actor.identifier_count || 0} identifiers · ${actor.link_count || 0} links · last seen ${esc(actor.last_seen || actor.last_scan || "—")}</p>
            </button>
          `).join("")}
        </div>
        <div class="card table-wrap" style="margin-top:14px">
          <table>
            <thead><tr><th>Actor</th><th>Category</th><th>Confidence</th><th>Identifiers</th><th>Links</th><th>Last scan</th></tr></thead>
            <tbody>${actorTable(actors)}</tbody>
          </table>
        </div>
      </div>
      <div id="profile-slot">${profileCard(profile)}</div>
    </div>
  `;
}

function sharedIdentifiers(identifiers) {
  const groups = new Map();
  (identifiers || []).forEach((item) => {
    const key = `${item.kind}|${item.value}`;
    if (!groups.has(key)) groups.set(key, { key, kind: item.kind, value: item.value, actors: [] });
    groups.get(key).actors.push(item.actor_id);
  });
  return [...groups.values()]
    .sort((a, b) => b.actors.length - a.actors.length || a.kind.localeCompare(b.kind))
    .filter((item) => item.actors.length > 1 || ["pgp", "wallet", "onion"].includes(item.kind))
    .slice(0, 16);
}

async function renderGraph(token) {
  const data = await api(`/api/graph?${queryString()}`);
  if (token !== renderToken) return;
  state.graph = data;
  if (!state.selectedId && data.nodes[0]) state.selectedId = data.nodes[0].id;
  const profile = state.selectedId ? await loadProfile(state.selectedId).catch(() => null) : null;
  if (token !== renderToken) return;
  const kinds = ["actor", "pgp", "wallet", "handle", "onion", "jabber", "clearnet"];
  $("view").innerHTML = `
    <div class="page-head"><p class="eyebrow">Relationship intelligence</p><h1>Network graph</h1><p class="muted">Scroll to zoom, drag the background to pan, drag a node to move it. Click a node to open its panel.</p></div>
    <div class="graph-layout">
      <article class="card graph-stage">
        <div class="graph-toolbar">
          <div class="legend">
            ${kinds.map((kind) => `<span><i style="background:${KIND_COLORS[kind] || "#9ab"}"></i>${esc(kind)}</span>`).join("")}
          </div>
          <div class="graph-tools">
            <input id="graph-q" type="search" placeholder="Find in graph" value="${esc(state.graphQuery)}" aria-label="Search the graph">
            <button class="btn" type="button" id="graph-fit">Fit</button>
            <button class="btn" type="button" id="reflow">Reflow</button>
          </div>
        </div>
        <div class="filters" id="graph-kinds">
          ${kinds.map((kind) => `<button type="button" class="btn" data-kind="${kind}" ${state.graphKinds.includes(kind) ? 'aria-pressed="true"' : ""}>${esc(kind)}</button>`).join("")}
        </div>
        <canvas id="graph-canvas" width="900" height="560"></canvas>
        <div id="graph-tip" class="tip" hidden></div>
        <p id="graph-readout" class="muted">Click a node. Actors open a dossier. Colored dots are shared identifiers.</p>
      </article>
      <div id="profile-slot">${profileCard(profile)}</div>
    </div>
  `;
  $("reflow").addEventListener("click", () => drawGraph(state.graph, true));
  $("graph-fit").addEventListener("click", () => {
    const scene = $("graph-canvas")?._scene;
    if (!scene) return;
    scene.camera = { x: 0, y: 0, k: 1 };
    paintGraph(null);
  });
  $("graph-q").addEventListener("input", (event) => {
    state.graphQuery = event.target.value.trim();
    paintGraph($("graph-canvas")?._hover || null);
  });
  $("graph-kinds").addEventListener("click", (event) => {
    const button = event.target.closest("[data-kind]");
    if (!button) return;
    const kind = button.dataset.kind;
    state.graphKinds = state.graphKinds.includes(kind)
      ? state.graphKinds.filter((item) => item !== kind)
      : [...state.graphKinds, kind];
    button.setAttribute("aria-pressed", state.graphKinds.includes(kind) ? "true" : "false");
    paintGraph($("graph-canvas")?._hover || null);
  });
  drawGraph(data);
  const selected = data.nodes.find((node) => node.id === state.selectedId);
  const readout = $("graph-readout");
  if (selected && readout) {
    readout.textContent = `${selected.label} is highlighted. Click another actor or a colored identifier dot to inspect that link.`;
  }
}

function drawGraph(data, reshuffle) {
  const canvas = $("graph-canvas");
  if (!canvas || !data) return;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.parentElement.clientWidth - 24 || 860;
  const height = 560;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const actors = data.nodes.map((node) => ({
    ...node,
    nodeType: "actor",
    color: CATEGORY_COLORS[node.category] || KIND_COLORS.actor,
  }));
  const extras = sharedIdentifiers(data.identifiers).map((item) => ({
    id: `id:${item.key}`,
    label: item.kind,
    value: item.value,
    nodeType: item.kind,
    color: KIND_COLORS[item.kind] || "#9ab",
    actors: item.actors,
  }));
  const nodes = [...actors, ...extras];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links = data.edges.map((edge) => ({ source: edge.source, target: edge.target, score: edge.score, kind: "actor" }));
  extras.forEach((item) => {
    item.actors.forEach((actorId) => links.push({ source: actorId, target: item.id, score: 70, kind: item.nodeType }));
  });
  nodes.forEach((node, index) => {
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2 + (reshuffle ? 0.6 : 0);
    const radius = node.nodeType === "actor" ? Math.min(width, height) * 0.3 : Math.min(width, height) * 0.42;
    node.x = width / 2 + Math.cos(angle) * radius;
    node.y = height / 2 + Math.sin(angle) * radius * 0.82;
  });
  for (let step = 0; step < 260; step += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.hypot(dx, dy) || 0.1;
        const force = 4800 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].x -= fx;
        nodes[i].y -= fy;
        nodes[j].x += fx;
        nodes[j].y += fy;
      }
    }
    links.forEach((link) => {
      const left = byId.get(link.source);
      const right = byId.get(link.target);
      if (!left || !right) return;
      const dx = right.x - left.x;
      const dy = right.y - left.y;
      const dist = Math.hypot(dx, dy) || 0.1;
      const force = (dist - 190) * 0.035;
      left.x += (dx / dist) * force;
      left.y += (dy / dist) * force;
      right.x -= (dx / dist) * force;
      right.y -= (dy / dist) * force;
    });
    nodes.forEach((node) => {
      node.x += (width / 2 - node.x) * 0.012;
      node.y += (height / 2 - node.y) * 0.012;
      node.x = Math.max(40, Math.min(width - 70, node.x));
      node.y = Math.max(28, Math.min(height - 24, node.y));
    });
  }
  canvas._scene = { nodes, links, byId, width, height, camera: { x: 0, y: 0, k: 1 }, phase: 0 };
  paintGraph(null);
  if (state.graphFrame) cancelAnimationFrame(state.graphFrame);
  const loop = () => {
    if (state.view !== "graph" || !$("graph-canvas")) return;
    canvas._scene.phase = (canvas._scene.phase + 0.7) % 1000;
    paintGraph(canvas._hover || null);
    state.graphFrame = requestAnimationFrame(loop);
  };
  state.graphFrame = requestAnimationFrame(loop);
  const worldPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    const camera = canvas._scene.camera;
    const sx = ((event.clientX - rect.left) / rect.width) * width;
    const sy = ((event.clientY - rect.top) / rect.height) * height;
    return { x: (sx - camera.x) / camera.k, y: (sy - camera.y) / camera.k, sx, sy, rect };
  };
  const hitTest = (event) => {
    const point = worldPoint(event);
    return nodes.find((node) => nodeVisible(node) && Math.hypot(node.x - point.x, node.y - point.y) < (node.nodeType === "actor" ? 18 : 12));
  };
  let drag = null;
  canvas.onpointerdown = (event) => {
    const hit = hitTest(event);
    const point = worldPoint(event);
    drag = { hit, x: event.clientX, y: event.clientY, moved: false, nx: hit?.x, ny: hit?.y, ox: canvas._scene.camera.x, oy: canvas._scene.camera.y };
    canvas.setPointerCapture(event.pointerId);
    canvas._pointer = point;
  };
  canvas.onpointermove = (event) => {
    const point = worldPoint(event);
    if (drag) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 3) drag.moved = true;
      if (drag.hit) {
        drag.hit.x = drag.nx + dx / point.rect.width * width / canvas._scene.camera.k;
        drag.hit.y = drag.ny + dy / point.rect.height * height / canvas._scene.camera.k;
      } else {
        canvas._scene.camera.x = drag.ox + dx / point.rect.width * width;
        canvas._scene.camera.y = drag.oy + dy / point.rect.height * height;
      }
    }
    const hit = drag?.hit || hitTest(event);
    canvas._hover = hit || null;
    canvas.style.cursor = drag?.hit ? "grabbing" : hit ? "pointer" : "grab";
    const tip = $("graph-tip");
    if (!tip) return;
    if (!hit || drag) {
      tip.hidden = true;
      return;
    }
    const names = (hit.actors || []).map((id) => byId.get(id)?.label).filter(Boolean);
    tip.hidden = false;
    tip.innerHTML = hit.nodeType === "actor"
      ? `<strong>${esc(hit.label)}</strong><br>${esc(hit.category || "actor")}<br><span class="muted">Click to open the dossier</span>`
      : `<strong>${esc(hit.nodeType)}</strong><br>${esc(hit.value)}<br><span class="muted">${names.length ? `Shared by ${esc(names.join(", "))}` : "Click for the actors"}</span>`;
    const host = canvas.parentElement.getBoundingClientRect();
    tip.style.left = `${event.clientX - host.left + 14}px`;
    tip.style.top = `${event.clientY - host.top + 14}px`;
  };
  canvas.onpointerleave = () => {
    if (drag) return;
    canvas._hover = null;
    const tip = $("graph-tip");
    if (tip) tip.hidden = true;
  };
  canvas.onpointerup = () => {
    const hit = drag && !drag.moved ? drag.hit : null;
    drag = null;
    if (hit) openGraphNode(hit, byId);
  };
  if (!canvas._wheelBound) {
    canvas._wheelBound = true;
    canvas.addEventListener("wheel", (event) => {
      const scene = canvas._scene;
      if (!scene) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = ((event.clientX - rect.left) / rect.width) * scene.width;
      const sy = ((event.clientY - rect.top) / rect.height) * scene.height;
      const camera = scene.camera;
      const x = (sx - camera.x) / camera.k;
      const y = (sy - camera.y) / camera.k;
      const next = Math.min(2.6, Math.max(0.45, camera.k * (event.deltaY < 0 ? 1.08 : 0.92)));
      camera.x = sx - x * next;
      camera.y = sy - y * next;
      camera.k = next;
    }, { passive: false });
  }
}

function nodeShown(node) {
  if (!state.graphKinds.length || node.nodeType === "actor") return true;
  return state.graphKinds.includes(node.nodeType);
}

function nodeMatch(node) {
  const query = (state.graphQuery || "").toLowerCase();
  if (!query) return true;
  return `${node.label || ""} ${node.value || ""} ${node.category || ""}`.toLowerCase().includes(query);
}

function nodeVisible(node) {
  return nodeShown(node) && nodeMatch(node);
}

function openGraphNode(hit, byId) {
  state.selectedId = hit.nodeType === "actor" ? hit.id : state.selectedId;
  paintGraph(hit);
  const readout = $("graph-readout");
  if (hit.nodeType === "actor") {
    if (readout) readout.textContent = `${hit.label} is a ${hit.category} actor. The dossier lists identifiers, links, and infrastructure notes.`;
    loadProfile(hit.id).then((profile) => {
      const slot = $("profile-slot");
      if (slot) slot.innerHTML = profileCard(profile);
    }).catch((error) => banner(error.message, "error"));
    return;
  }
  const names = (hit.actors || []).map((id) => byId.get(id)).filter(Boolean);
  if (readout) readout.textContent = `${hit.nodeType} ${hit.value} is shared by ${names.map((node) => node.label).join(", ") || "no other actor in this window"}.`;
  const slot = $("profile-slot");
  if (!slot) return;
  slot.innerHTML = `
    <article class="card profile">
      <p class="eyebrow">Shared identifier</p>
      <h2>${esc(hit.nodeType)}</h2>
      <p><strong>${esc(hit.value)}</strong></p>
      <p class="muted">Actors connected to this dot reuse the same ${esc(hit.nodeType)}. That overlap is the link drawn on the graph.</p>
      <ul class="activity">${names.map((node) => `<li><button type="button" class="btn ghost" data-action="open-actor" data-id="${node.id}">${esc(node.label)}</button> · ${esc(node.category || "")}</li>`).join("") || "<li>No actor in this window.</li>"}</ul>
    </article>
  `;
}

function paintGraph(hover) {
  const canvas = $("graph-canvas");
  const scene = canvas && canvas._scene;
  if (!scene) return;
  const { nodes, links, byId, width, height } = scene;
  const camera = scene.camera || { x: 0, y: 0, k: 1 };
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.k, camera.k);
  links.forEach((link) => {
    const left = byId.get(link.source);
    const right = byId.get(link.target);
    if (!left || !right || !nodeShown(left) || !nodeShown(right)) return;
    const hot = hover && (hover.id === left.id || hover.id === right.id);
    const dim = !nodeMatch(left) || !nodeMatch(right);
    ctx.setLineDash(link.kind === "actor" ? [6, 8] : []);
    ctx.lineDashOffset = -(scene.phase || 0);
    ctx.strokeStyle = dim ? "rgba(146,170,220,0.12)" : link.kind === "actor" ? "rgba(139,124,255,0.7)" : "rgba(62,224,208,0.35)";
    ctx.lineWidth = hot ? 2.4 : 1;
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.font = "12px IBM Plex Sans, Segoe UI, sans-serif";
  nodes.forEach((node) => {
    if (!nodeShown(node)) return;
    const radius = node.nodeType === "actor" ? 11 : 6;
    const selected = node.id === state.selectedId || (hover && hover.id === node.id);
    const dim = !nodeMatch(node);
    ctx.globalAlpha = dim ? 0.2 : 1;
    if (selected) {
      ctx.beginPath();
      ctx.strokeStyle = "#3ee0d0";
      ctx.lineWidth = 2;
      ctx.arc(node.x, node.y, radius + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.fillStyle = node.color;
    ctx.shadowColor = node.color;
    ctx.shadowBlur = selected ? 16 : 0;
    ctx.arc(node.x, node.y, selected ? radius + 2 : radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (node.nodeType !== "actor") return;
    ctx.fillStyle = "#e7eeff";
    ctx.fillText(node.label, node.x + radius + 8, node.y + 4);
    ctx.globalAlpha = 1;
  });
  ctx.restore();
}

async function renderCollection(token) {
  const [sources, log, indicators, inventory] = await Promise.all([
    api("/api/sources"),
    api("/api/ingest/log"),
    api(`/api/indicators?${queryString()}`),
    api("/api/inventory"),
  ]);
  if (token !== renderToken) return;
  state.sources = sources;
  const imported = log.filter((item) => item.status === "imported").length;
  const rejected = log.filter((item) => item.status === "rejected").length;
  const cards = sources.map((source) => `
    <article class="card source-card">
      <div class="kind">${esc(source.kind)}</div>
      <h2>${esc(source.name)}</h2>
      <p>${meter(source.reliability)} reliability</p>
      <p>${source.last_ingest ? `<span class="pill good">Live · ingested</span>` : `<span class="pill warn">Waiting</span>`}</p>
      <p class="muted">Last scan ${esc(source.last_ingest || "not yet")} · records follow the reliability bar</p>
      <p class="muted">${esc(source.notes || "")}</p>
    </article>
  `).join("");
  const matches = indicators.filter((item) => item.inventory_match).length;
  $("view").innerHTML = `
    <div class="page-head"><p class="eyebrow">Dark-web sources</p><h1>Collection</h1><p class="muted">Marketplace, forum, deep-web, and clearnet files are imported when they meet the reliability bar. ${matches} infrastructure notes match inventory. ${imported} imports and ${rejected} rejections are in the recent log.</p></div>
    <div class="collection-layout">
      <div class="source-grid">${cards || `<p class="muted">No sources stored.</p>`}</div>
      <article class="card">
        <h2>Ingest log</h2>
        <ul class="activity">${log.slice(0, 6).map((item) => `<li><span class="pill ${item.status === "imported" ? "good" : item.status === "rejected" ? "bad" : "warn"}">${esc(item.status)}</span> ${esc(item.source_name || item.feed_name)}<div class="muted">${esc(item.detail || "")}</div></li>`).join("")}</ul>
        <div class="inline" style="margin-top:12px">
          <button class="btn primary" type="button" data-action="ingest-run">Run ingest</button>
          <button class="btn" type="button" data-action="ingest-retry">Retry rejected</button>
        </div>
      </article>
    </div>
    <div class="split" style="margin-top:14px">
      <article class="card">
        <h2>Inventory matches</h2>
        <ul class="activity">${inventory.map((asset) => `<li>${esc(asset.asset_ref)} <span class="muted">${asset.indicator_ids.length ? `${asset.indicator_ids.length} match` : "unmatched"}</span></li>`).join("")}</ul>
      </article>
      <form class="card stack" data-form="feed">
        <h2>Submit a source document</h2>
        <label class="field">JSON feed<textarea name="feed" placeholder='{"source":{"name":"Desk notes","kind":"feed","reliability":85},"actors":[]}'></textarea></label>
        <button class="btn primary" type="submit">Ingest document</button>
      </form>
    </div>
  `;
}

async function renderSearch(token) {
  const actors = await api(`/api/actors?${queryString()}`);
  if (token !== renderToken) return;
  const visible = actors.filter((actor) => {
    if (!state.entityKind) return true;
    return (actor.identifier_preview || []).some((item) => item.toLowerCase().startsWith(`${state.entityKind}:`));
  });
  const categories = [`<option value="">All categories</option>`].concat(
    (state.meta?.categories || []).map((category) => `<option value="${esc(category)}" ${category === state.category ? "selected" : ""}>${esc(category)}</option>`),
  ).join("");
  const sources = [`<option value="">All sources</option>`].concat(
    state.sources.map((source) => `<option value="${esc(source.name)}" ${source.name === state.source ? "selected" : ""}>${esc(source.name)}</option>`),
  ).join("");
  const recent = JSON.parse(sessionStorage.getItem("echo_recent") || "[]");
  const kinds = ["handle", "pgp", "wallet", "onion", "clearnet", "jabber"];
  $("view").innerHTML = `
    <div class="page-head"><p class="eyebrow">${esc(state.start)} – ${esc(state.end)}</p><h1>Search and query</h1><p class="muted">Search handles, PGP keys, wallets, service refs, domains, and actor names. The time range in the top bar limits the result set.</p></div>
    <form class="card stack" id="search-form" data-form="search">
      <div class="inline">
        <label class="field">Query<input name="q" value="${esc(state.q)}" placeholder="Handle, wallet, PGP, domain, actor"></label>
        <label class="field">Entity<select name="entity"><option value="">Any identifier</option>${kinds.map((kind) => `<option value="${kind}" ${kind === state.entityKind ? "selected" : ""}>${kind}</option>`).join("")}</select></label>
        <label class="field">Category<select name="category">${categories}</select></label>
        <label class="field">Source<select name="source">${sources}</select></label>
        <label class="field">Min confidence<input name="min_confidence" type="number" min="0" max="100" value="${state.minConfidence}"></label>
        <button class="btn primary" type="submit">Search</button>
      </div>
    </form>
    <div class="split" style="margin-top:14px">
      <article class="card">
        <h2>Results <span class="muted">${visible.length}</span></h2>
        <div class="table-wrap">
        <table>
          <thead><tr><th>Actor</th><th>Category</th><th>Confidence</th><th>Identifiers</th><th>Links</th><th>Last scan</th></tr></thead>
          <tbody>${visible.length ? actorTable(visible) : `<tr><td colspan="6" class="empty">No actor matched these filters.</td></tr>`}</tbody>
        </table>
        </div>
      </article>
      <article class="card">
        <h2>Recent searches</h2>
        <div class="cluster-row">${recent.map((term) => `<button type="button" class="btn" data-action="recent" data-term="${esc(term)}">${esc(term)}</button>`).join("") || `<span class="muted">Searches you run will be listed here.</span>`}</div>
      </article>
    </div>
  `;
}

async function renderAnalytics(token) {
  const actors = await api(`/api/actors?${queryString()}`);
  if (token !== renderToken) return;
  const selected = state.selectedId && actors.some((actor) => actor.id === state.selectedId)
    ? state.selectedId
    : actors[0]?.id;
  const profile = selected ? await loadProfile(selected) : null;
  if (token !== renderToken) return;
  const actor = profile?.actor;
  const behavior = profile?.behavior;
  const buckets = behavior?.hour_buckets || {};
  const maxBucket = Math.max(...Object.values(buckets), 1);
  const options = actors.map((item) => `<option value="${item.id}" ${item.id === selected ? "selected" : ""}>${esc(item.display_name)}</option>`).join("");
  const tab = state.analyticsTab;
  let panel = "";
  if (!profile) {
    panel = `<p class="muted">No actor in this window.</p>`;
  } else if (tab === "behaviour") {
    panel = `
      <div class="analytics-grid">
        <div class="ring" style="background:conic-gradient(#ff5d73 ${actor.attribution_confidence}%, rgba(255,255,255,0.08) 0)"><div><strong>${Math.round(actor.attribution_confidence)}%</strong><span class="muted">confidence</span></div></div>
        <div>
          <h2>Behavioural profile <span class="badge evidence">From recorded events</span></h2>
          <p class="muted">${behavior.event_count} events over ${behavior.active_span_days} days. ${behavior.shared_identifier_count} shared identifiers. Night-heavy or terse patterns are observations, not a separate model claim.</p>
          <div class="bars">${Object.entries(buckets).map(([name, count]) => `<div class="bar-line"><span>${esc(name)}</span><span class="track"><i style="width:${(count / maxBucket) * 100}%"></i></span><em>${count}</em></div>`).join("")}</div>
        </div>
        <div>
          <h2>Key indicators</h2>
          <ul class="activity">${profile.identifiers.map((item) => `<li><span class="chip">${esc(item.kind)}</span> ${esc(item.value)}</li>`).join("")}</ul>
          <p class="muted">Sources: ${behavior.sources.map(esc).join(", ") || "—"}</p>
        </div>
      </div>
    `;
  } else if (tab === "stylometry") {
    panel = `
      <form class="stack" data-form="rank">
        <label class="field">Writing sample<textarea id="sample-text">${esc(state.sampleText)}</textarea></label>
        <div class="inline">
          <label class="field">New persona name<input id="candidate-name" value="${esc(state.candidateName)}"></label>
          <button class="btn primary" type="submit">Compare</button>
        </div>
      </form>
      <div id="rank-results" style="margin-top:12px"></div>
    `;
  } else {
    panel = `<p class="muted"><span class="badge ai">Similarity score</span> is a writing-style estimate until an analyst records the link. <span class="badge evidence">Stored link</span> is the confirmed relationship.</p><ul class="activity">${profile.links.map((link) => `<li><strong>${esc(link.display_name)}</strong> ${meter(link.score)} <span class="badge evidence">Verified link</span><div class="muted">${esc(link.methods.map((method) => `${method.method}: ${method.detail}`).join(" · "))}</div></li>`).join("") || `<li class="muted">No confirmed persona link for this actor. Compare a sample on the Stylometry tab.</li>`}</ul>`;
  }
  $("view").innerHTML = `
    <div class="page-head">
      <p class="eyebrow">Estimates stay labeled</p>
      <h1>AI analytics</h1>
      <p class="muted">Behaviour, stylometry, and persona links. Similarity is an estimate. A recorded link is evidence an analyst confirmed.</p>
    </div>
    <article class="card">
      <div class="inline">
        <label class="field">Actor<select id="analytics-actor">${options}</select></label>
        <div class="tabs">
          <button type="button" data-analytics="behaviour" ${tab === "behaviour" ? 'aria-current="page"' : ""}>Behavioural profile</button>
          <button type="button" data-analytics="stylometry" ${tab === "stylometry" ? 'aria-current="page"' : ""}>Stylometry</button>
          <button type="button" data-analytics="persona" ${tab === "persona" ? 'aria-current="page"' : ""}>Persona linkage</button>
        </div>
      </div>
      <div style="margin-top:14px">${panel}</div>
    </article>
  `;
  $("analytics-actor").addEventListener("change", () => {
    state.selectedId = Number($("analytics-actor").value);
    renderView();
  });
  if (tab === "stylometry") fillRanks().catch((error) => banner(error.message, "error"));
}

function renderRanks(data) {
  const rows = data.matches.slice(0, 5).map((match) => `
    <tr>
      <td>${esc(match.display_name)}<div class="muted">${chip(match.category)}</div></td>
      <td>${meter(match.score)}</td>
      <td>Aligned: ${match.aligned.map(esc).join(", ")}<div class="muted">Apart: ${match.divergent.map(esc).join(", ")}</div></td>
      <td><button type="button" class="btn" data-action="link-persona" data-id="${match.actor_id}" data-score="${match.score}">Record linkage</button></td>
    </tr>
  `).join("");
  return `${data.short_text ? `<p class="banner">Short sample. Treat the score as weak.</p>` : ""}
    <table><thead><tr><th>Known actor</th><th>Similarity</th><th>Features</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function fillRanks() {
  const text = $("sample-text")?.value || state.sampleText;
  state.sampleText = text;
  const data = await api("/api/stylometry/rank", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const slot = $("rank-results");
  if (slot) slot.innerHTML = renderRanks(data);
}

async function renderInfrastructure(token) {
  const [indicators, inventory] = await Promise.all([
    api(`/api/indicators?${queryString()}`),
    api("/api/inventory"),
  ]);
  if (token !== renderToken) return;
  const groups = {};
  indicators.forEach((item) => {
    const key = item.type_label || item.indicator_type;
    groups[key] = groups[key] || [];
    groups[key].push(item);
  });
  $("view").innerHTML = `
    <div class="page-head"><p class="eyebrow">Clearnet correlation</p><h1>Infrastructure intelligence</h1><p class="muted">Notes are matched by string to the operator inventory. A match means the same host or certificate name appears in both places.</p></div>
    <div class="split">
      <article class="card">
        <h2>Indicator notes</h2>
        ${Object.entries(groups).map(([label, items]) => `
          <h3 style="margin:14px 0 6px">${esc(label)} <span class="muted">${items.length}</span></h3>
          <ul class="activity">${items.map((item) => `<li><button type="button" class="btn ghost" data-action="open-actor" data-id="${item.actor_id}">${esc(item.display_name || "Actor")}</button> ${item.inventory_match ? `<span class="pill good">${esc(item.clearnet_match)}</span>` : `<span class="pill">unmatched</span>`}<div class="muted">${esc(item.observation || "")}</div></li>`).join("")}</ul>
        `).join("") || `<p class="empty">No infrastructure notes in this window.</p>`}
      </article>
      <article class="card">
        <h2>Inventory relationships</h2>
        <ul class="timeline">${inventory.map((asset) => `<li><span class="rail"></span><div><strong>${esc(asset.asset_ref)}</strong><div class="muted">${esc(asset.kind || "asset")} · ${asset.indicator_ids.length ? `${asset.indicator_ids.length} linked note${asset.indicator_ids.length === 1 ? "" : "s"}` : "no note yet"}</div><div class="muted">${esc(asset.notes || "")}</div></div></li>`).join("") || `<li><span class="rail"></span><div class="empty">No inventory assets.</div></li>`}</ul>
      </article>
    </div>
  `;
}

async function renderTimeline(token) {
  const [overview, actors] = await Promise.all([
    api(`/api/overview?${queryString()}`),
    api(`/api/actors?${queryString()}`),
  ]);
  if (token !== renderToken) return;
  const max = Math.max(...overview.timeline.map((item) => item.count), 1);
  $("view").innerHTML = `
    <div class="page-head"><p class="eyebrow">${esc(state.start)} – ${esc(state.end)}</p><h1>Investigation timeline</h1><p class="muted">Event volume by month, and the personas first seen in this window. Change the range in the top bar to move the window.</p></div>
    <div class="split">
      <article class="card">
        <h2>Activity</h2>
        <div class="bars">${overview.timeline.map((item) => `<div class="bar-line"><span>${esc(item.month)}</span><span class="track"><i style="width:${(item.count / max) * 100}%"></i></span><em>${item.count}</em></div>`).join("") || `<p class="empty">No events in this window.</p>`}</div>
      </article>
      <article class="card">
        <h2>New identities</h2>
        <ul class="timeline">${[...actors].sort((a, b) => String(a.first_seen).localeCompare(String(b.first_seen))).map((actor) => `<li><span class="rail"></span><div><button type="button" class="btn ghost" data-action="open-actor" data-id="${actor.id}">${esc(actor.display_name)}</button><div class="muted">${esc(actor.first_seen || "—")} · ${esc(actor.category)} · confidence ${Math.round(actor.attribution_confidence)}</div></div></li>`).join("") || `<li><span class="rail"></span><div class="empty">No actors in this window.</div></li>`}</ul>
      </article>
    </div>
    <article class="card" style="margin-top:14px">
      <h2>Persona movements</h2>
      <p class="muted">Clusters are groups whose strongest link scores 60 or higher. Open one to see the members.</p>
      <div class="cluster-row">${overview.clusters.map((cluster, index) => `<button type="button" class="btn" data-action="explain-cluster" data-index="${index}">${esc(cluster.label)} · ${cluster.members.length}</button>`).join("") || `<span class="muted">No cluster in this window.</span>`}</div>
    </article>
  `;
  state.board = { actors, overview, eventMap: Object.fromEntries(overview.timeline.map((item) => [item.month, item.count])) };
}

async function renderReports(token) {
  const overview = await api(`/api/overview?${queryString()}`);
  if (token !== renderToken) return;
  const query = queryString();
  const categories = [`<option value="">All</option>`].concat(
    (state.meta?.categories || []).map((category) => `<option value="${esc(category)}" ${category === state.category ? "selected" : ""}>${esc(category)}</option>`),
  ).join("");
  $("view").innerHTML = `
    <div class="page-head"><p class="eyebrow">Evidence package</p><h1>Reports and export</h1><p class="muted">${overview.actor_count} actors in ${esc(state.start)} – ${esc(state.end)}. Exports use the filters below and the time range in the top bar.</p></div>
    <div class="report-grid">
      <article class="card">
        <h2>Result set</h2>
        <form class="stack" data-form="report-filters">
          <label class="field">Actor name<input name="q" value="${esc(state.q)}" placeholder="Leave blank for the full window"></label>
          <label class="field">Category<select name="category">${categories}</select></label>
          <label class="field">Minimum confidence<input name="min_confidence" type="number" min="0" max="100" value="${state.minConfidence}"></label>
          <div class="filters">
            ${["Actors", "Relationships", "Sources", "Attribution"].map((item) => `<label class="check"><input type="checkbox" checked disabled> ${item}</label>`).join("")}
          </div>
          <p class="muted">CSV, JSON, and PDF each include the actors, links, sources, and attribution scores in this result set.</p>
          <button class="btn" type="submit">Apply filters</button>
        </form>
        <ul class="activity" style="margin-top:14px">
          ${overview.clusters.map((cluster) => `<li><strong>${esc(cluster.label)}</strong><div class="muted">${cluster.members.map((member) => esc(member.display_name)).join(", ")}</div></li>`).join("") || `<li class="muted">No clusters in this result set.</li>`}
        </ul>
      </article>
      <article class="card">
        <h2>Export formats</h2>
        <div class="stack">
          <a class="btn" href="/api/export/csv?${query}">CSV<span class="muted">Spreadsheet</span></a>
          <a class="btn" href="/api/export/json?${query}">JSON<span class="muted">Structured result set</span></a>
          <a class="btn primary" href="/api/export/report?${query}">PDF<span class="muted">Generate report</span></a>
        </div>
      </article>
    </div>
  `;
}

async function renderSettings(token) {
  const settings = await api("/api/settings");
  if (token !== renderToken) return;
  const local = prefs();
  $("view").innerHTML = `
    <div class="page-head"><p class="eyebrow">Desk preferences</p><h1>Settings</h1><p class="muted">Collection rules are stored with the local database. Notification and layout choices stay in this browser.</p></div>
    <div class="split">
      <form class="card stack" data-form="settings">
        <h2>Collection schedule</h2>
        <label class="check"><input id="auto-enabled" type="checkbox" ${settings.autonomous_enabled ? "checked" : ""}> Autonomous collection</label>
        <label class="field">Minimum reliability<input id="min-reliability" type="number" min="0" max="100" value="${settings.min_reliability}"></label>
        <p class="muted">The loop checks the local feed folder every ${settings.ingest_interval_seconds} seconds. Files under the bar are rejected and logged.</p>
        <button class="btn primary" type="submit">Save collection rules</button>
      </form>
      <article class="card">
        <h2>System status</h2>
        <p class="live"><i></i> API online</p>
        <div class="kv">
          <div><span>Reliability bar</span><b>${settings.min_reliability}</b></div>
          <div><span>Autonomous</span><b>${settings.autonomous_enabled ? "On" : "Off"}</b></div>
          <div><span>Sources</span><b>${state.sources.length}</b></div>
          <div><span>Analyst</span><b>${esc(userName())}</b></div>
        </div>
      </article>
    </div>
    <div class="split" style="margin-top:14px">
      <form class="card stack" data-form="prefs">
        <h2>Investigation preferences</h2>
        <label class="check"><input name="toasts" type="checkbox" ${local.toasts === false ? "" : "checked"}> Toast notifications</label>
        <label class="check"><input name="compact" type="checkbox" ${local.compact ? "checked" : ""}> Compact tables</label>
        <p class="muted">Stylometry runs on this machine. Scores are estimates until you record a persona link.</p>
        <button class="btn" type="submit">Save preferences</button>
      </form>
      <article class="card">
        <h2>Sources on file</h2>
        <ul class="activity">${state.sources.map((source) => `<li><strong>${esc(source.name)}</strong><div class="muted">${esc(source.kind)} · reliability ${Math.round(source.reliability)}</div></li>`).join("") || `<li class="muted">No sources yet.</li>`}</ul>
        <p class="muted">Sessions are local. Sign out clears the name stored in this browser.</p>
      </article>
    </div>
  `;
  document.body.classList.toggle("compact", Boolean(local.compact));
}

async function refreshOpenProfile() {
  if (!state.selectedId) return;
  const profile = await loadProfile(state.selectedId);
  const slot = $("profile-slot");
  if (slot) slot.innerHTML = profileCard(profile);
}

async function onSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  try {
    if (form.dataset.form === "search" || form.dataset.form === "report-filters") {
      const data = new FormData(form);
      if (form.dataset.form === "search") {
        state.q = String(data.get("q") || "").trim();
        state.source = String(data.get("source") || "");
        state.entityKind = String(data.get("entity") || "");
        rememberSearch(state.q);
      }
      if (data.has("q")) {
        state.q = String(data.get("q") || "").trim();
        const top = $("top-q");
        if (top) top.value = state.q;
      }
      state.category = String(data.get("category") || "");
      state.minConfidence = Number(data.get("min_confidence") || 0);
      await renderView();
      return;
    }
    if (form.dataset.form === "indicator") {
      const data = Object.fromEntries(new FormData(form).entries());
      data.actor_id = Number(data.actor_id);
      data.confidence = 60;
      data.service_ref = "";
      data.source = "analyst";
      const saved = await api("/api/indicators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      banner(saved.inventory_match ? "Note stored and matched to inventory." : "Note stored. No inventory match.", "ok");
      await refreshOpenProfile();
      return;
    }
    if (form.dataset.form === "prefs") {
      const data = new FormData(form);
      savePrefs({
        toasts: data.get("toasts") === "on",
        compact: data.get("compact") === "on",
      });
      document.body.classList.toggle("compact", data.get("compact") === "on");
      banner("Preferences saved on this browser.", "ok");
      return;
    }
    if (form.dataset.form === "settings") {
      await api("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autonomous_enabled: $("auto-enabled").checked,
          min_reliability: Number($("min-reliability").value),
        }),
      });
      banner("Settings saved.", "ok");
      await renderView();
      return;
    }
    if (form.dataset.form === "feed") {
      const documentJson = JSON.parse(String(new FormData(form).get("feed") || "{}"));
      const result = await api("/api/ingest/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(documentJson),
      });
      banner(`${result.status}: ${result.detail}`, result.status === "imported" ? "ok" : "error");
      await renderView();
      return;
    }
    if (form.dataset.form === "rank") {
      state.candidateName = $("candidate-name").value.trim();
      await fillRanks();
    }
  } catch (error) {
    banner(error.message, "error");
  }
}

async function onViewClick(event) {
  const tab = event.target.closest("[data-tab]");
  if (tab) {
    state.profileTab = tab.dataset.tab;
    await refreshOpenProfile();
    return;
  }
  const analytics = event.target.closest("[data-analytics]");
  if (analytics) {
    state.analyticsTab = analytics.dataset.analytics;
    await renderView();
    return;
  }
  const action = event.target.closest("[data-action]");
  if (!action) return;
  try {
    if (action.dataset.action === "close-insight") {
      const panel = $("insight");
      if (panel) panel.remove();
      document.querySelectorAll("button.stat, .donut-legend button").forEach((button) => button.removeAttribute("aria-pressed"));
    } else if (action.dataset.action === "explain-stat") {
      explainStat(action.dataset.stat);
    } else if (action.dataset.action === "explain-category") {
      document.querySelectorAll(".donut-legend button").forEach((button) => {
        button.setAttribute("aria-pressed", button.dataset.category === action.dataset.category ? "true" : "false");
      });
      explainCategory(action.dataset.category);
    } else if (action.dataset.action === "donut-hit") {
      const slice = sliceFromPointer(event);
      if (!slice) return;
      document.querySelectorAll(".donut-legend button").forEach((button) => {
        button.setAttribute("aria-pressed", button.dataset.category === slice.category ? "true" : "false");
      });
      explainCategory(slice.category);
    } else if (action.dataset.action === "filter-category") {
      state.category = action.dataset.category || "";
      await renderView();
    } else if (action.dataset.action === "explain-cluster") {
      const cluster = state.board && state.board.overview.clusters[Number(action.dataset.index)];
      if (!cluster) return;
      showInsight(action.parentElement, cluster.label, `<p>These personas are grouped because their strongest shared identifier, trust note, or writing-style link scores 60 or higher.</p><ul>${cluster.members.map((member) => `<li><button type="button" class="btn ghost" data-action="open-actor" data-id="${member.id}">${esc(member.display_name)}</button> · ${esc(member.category)} · ${Math.round(member.attribution_confidence)}</li>`).join("")}</ul>`);
    } else if (action.dataset.action === "open-actor") {
      state.selectedId = Number(action.dataset.id);
      if (state.view === "dashboard" || state.view === "actors" || state.view === "graph") {
        await refreshOpenProfile();
      } else {
        location.hash = "actors";
      }
    } else if (action.dataset.action === "open-graph") {
      state.selectedId = Number(action.dataset.id);
      location.hash = "graph";
    } else if (action.dataset.action === "recent") {
      state.q = action.dataset.term || "";
      const top = $("top-q");
      if (top) top.value = state.q;
      await renderView();
    } else if (action.dataset.action === "link-persona") {
      const name = $("candidate-name").value.trim();
      state.candidateName = name;
      const result = await api("/api/persona-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_name: name,
          matched_actor_id: Number(action.dataset.id),
          score: Number(action.dataset.score),
          sample: $("sample-text").value,
          evidence: "Analyst confirmed a stylometric linkage.",
        }),
      });
      banner(`Recorded ${result.candidate.display_name}.`, "ok");
      state.selectedId = result.candidate.id;
      state.analyticsTab = "persona";
      await renderView();
    } else if (action.dataset.action === "ingest-run" || action.dataset.action === "ingest-retry") {
      const path = action.dataset.action === "ingest-run" ? "/api/ingest/run" : "/api/ingest/retry-rejected";
      const result = await api(path, { method: "POST" });
      banner(result.results.length ? `Processed ${result.results.length} file(s).` : "Nothing waiting.", "ok");
      await renderView();
    }
  } catch (error) {
    banner(error.message, "error");
  }
}

function showLoginError(error) {
  const card = document.querySelector(".login-card");
  if (!card) return;
  let note = document.getElementById("login-error");
  if (!note) {
    note = document.createElement("p");
    note.id = "login-error";
    note.className = "banner error";
    card.appendChild(note);
  }
  note.textContent = error.message === "Failed to fetch"
    ? "The API is not reachable. Start the server, then try again."
    : error.message;
}

let paletteToken = 0;

function openPalette() {
  const palette = $("palette");
  if (!palette) return;
  palette.hidden = false;
  state.paletteIndex = 0;
  $("palette-q").value = "";
  paintPalette("");
  $("palette-q").focus();
}

function closePalette() {
  const palette = $("palette");
  if (palette) palette.hidden = true;
}

async function paintPalette(query) {
  const token = ++paletteToken;
  const q = query.trim().toLowerCase();
  const screens = NAV
    .filter(([, label]) => !q || label.toLowerCase().includes(q))
    .map(([id, label, , key]) => ({ kind: "view", id, label, hint: `Alt+${key.toUpperCase()}` }));
  let actors = [];
  if (query.trim().length >= 2) {
    try {
      actors = await api(`/api/actors?q=${encodeURIComponent(query.trim())}&start=${state.start}&end=${state.end}&min_confidence=0`);
    } catch {
      actors = [];
    }
  }
  if (token !== paletteToken) return;
  const hits = [
    ...screens,
    ...actors.slice(0, 6).map((actor) => ({ kind: "actor", id: actor.id, label: actor.display_name, hint: actor.category })),
  ];
  state.paletteHits = hits;
  if (state.paletteIndex >= hits.length) state.paletteIndex = 0;
  const list = $("palette-list");
  if (!list) return;
  list.innerHTML = hits.map((hit, index) => `
    <button type="button" class="palette-item" data-palette="${index}" ${index === state.paletteIndex ? 'aria-selected="true"' : ""}>
      <span>${esc(hit.label)}</span><span class="muted">${esc(hit.hint)}</span>
    </button>
  `).join("") || `<p class="empty">No matches.</p>`;
}

function choosePalette(index) {
  const hit = (state.paletteHits || [])[index];
  if (!hit) return;
  closePalette();
  if (hit.kind === "view") {
    if (location.hash === `#${hit.id}`) renderView();
    else location.hash = hit.id;
    return;
  }
  state.selectedId = hit.id;
  if (location.hash === "#actors") renderView();
  else location.hash = "actors";
}

function onKey(event) {
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if ($("palette").hidden) openPalette();
    else closePalette();
    return;
  }
  if (event.key === "Escape") {
    closePalette();
    const panel = $("insight");
    if (panel) panel.remove();
    return;
  }
  if (!$("palette").hidden) {
    const count = (state.paletteHits || []).length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!count) return;
      state.paletteIndex = (state.paletteIndex + (event.key === "ArrowDown" ? 1 : -1) + count) % count;
      document.querySelectorAll(".palette-item").forEach((button, index) => {
        if (index === state.paletteIndex) button.setAttribute("aria-selected", "true");
        else button.removeAttribute("aria-selected");
      });
    } else if (event.key === "Enter") {
      event.preventDefault();
      choosePalette(state.paletteIndex);
    }
    return;
  }
  if (typing || $("app").hidden) return;
  if (event.key === "/") {
    event.preventDefault();
    $("top-q")?.focus();
    return;
  }
  if (event.altKey && !event.ctrlKey && !event.metaKey) {
    const item = NAV.find((entry) => entry[3] === event.key.toLowerCase());
    if (!item) return;
    event.preventDefault();
    location.hash = item[0];
  }
}

function boot() {
  renderLogin();
  document.addEventListener("keydown", onKey);
  $("palette").addEventListener("click", (event) => {
    if (event.target.closest("[data-close-palette]")) closePalette();
    const item = event.target.closest("[data-palette]");
    if (item) choosePalette(Number(item.dataset.palette));
  });
  $("palette-q").addEventListener("input", (event) => {
    state.paletteIndex = 0;
    paintPalette(event.target.value);
  });
  if (sessionStorage.getItem("echoleaks_user")) {
    enterApp().catch(showLoginError);
  }
}

boot();
