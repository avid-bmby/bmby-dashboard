// ==UserScript==
// @name         BMBY – Link Telephony Dashboard
// @namespace    bmby-link-telephony-dashboard
// @version      0.1.2
// @description  Tabs dashboard (VOIP + Passwords + User search) for BMBY
// @updateURL    https://raw.githubusercontent.com/avid-bmby/bmby-dashboard/main/bmby-dashboard.user.js
// @downloadURL  https://raw.githubusercontent.com/avid-bmby/bmby-dashboard/main/bmby-dashboard.user.js
// @match        https://bmby.com/nihul/*
// @match        https://www.bmby.com/nihul/*
// @match        https://bmby.com/preferences/*
// @match        https://www.bmby.com/preferences/*
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// ==/UserScript==

(() => {
  "use strict";

  // PROD default: quiet. To debug, set Store.set('DBG', true) from console.
  const DBG = false;
  const log = (...a) => { if (DBG) console.log('[BMBY-DASH]', ...a); };

  // ===== USERS: perf constants (used by Users tab scanning) =====
  const IFRAME_CONCURRENCY   = 10;
  const IFRAME_TIMEOUT_MS    = 7500;
  const POST_LOAD_POLL_TRIES = 14;
  const POST_LOAD_POLL_MS    = 170;



  /*****************************************************************
   * NET SPY (debug only)
   *****************************************************************/
  const NetSpy = DBG ? (() => {
    let fetchHooked = false;
    let xhrHooked = false;
    const maxItems = 40;
    const items = [];
    const listeners = new Set();

    function push(ev) {
      try {
        items.unshift(ev);
        if (items.length > maxItems) items.length = maxItems;
        listeners.forEach((fn) => {
          try { fn(ev); } catch {}
        });
      } catch {}
    }

    function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    function list() { return items.slice(); }

    function safeUrl(u) {
      try { return String(u || ""); } catch { return ""; }
    }

    function hookFetch() {
      if (fetchHooked) return;
      fetchHooked = true;
      const orig = window.fetch;
      if (typeof orig !== "function") return;
      window.fetch = async function (...args) {
        const start = Date.now();
        const url = safeUrl(args?.[0]?.url || args?.[0]);
        const method = (args?.[1]?.method || "GET").toUpperCase();
        const res = await orig.apply(this, args);
        try {
          const ct = res.headers?.get?.("content-type") || "";
          if (ct.includes("text") || ct.includes("json") || ct.includes("html")) {
            const clone = res.clone();
            const body = await clone.text();
            push({ kind: "fetch", url, method, status: res.status, ms: Date.now() - start, body });
          } else {
            push({ kind: "fetch", url, method, status: res.status, ms: Date.now() - start, body: "" });
          }
        } catch {
          push({ kind: "fetch", url, method, status: res.status, ms: Date.now() - start, body: "" });
        }
        return res;
      };
    }

    function hookXHR() {
      if (xhrHooked) return;
      xhrHooked = true;
      const XHR = window.XMLHttpRequest;
      if (!XHR) return;
      const origOpen = XHR.prototype.open;
      const origSend = XHR.prototype.send;

      XHR.prototype.open = function (method, url, ...rest) {
        try {
          this.__bmbySpy = { method: String(method || "GET").toUpperCase(), url: safeUrl(url), start: 0 };
        } catch {}
        return origOpen.call(this, method, url, ...rest);
      };

      XHR.prototype.send = function (...args) {
        try {
          if (this.__bmbySpy) this.__bmbySpy.start = Date.now();
          const onEnd = () => {
            try {
              const info = this.__bmbySpy || { method: "GET", url: "" };
              const ct = (this.getResponseHeader && this.getResponseHeader("content-type")) || "";
              const isText = ct.includes("text") || ct.includes("json") || ct.includes("html") || (!ct && typeof this.responseText === "string");
              const body = isText ? String(this.responseText || "") : "";
              push({ kind: "xhr", url: info.url, method: info.method, status: this.status || 0, ms: info.start ? Date.now() - info.start : 0, body });
            } catch {}
          };
          this.addEventListener("loadend", onEnd, { once: true });
        } catch {}
        return origSend.apply(this, args);
      };
    }

    hookFetch();
    hookXHR();

    return { on, list };
  })() : ({ on: () => () => {}, list: () => [] });

  /*****************************************************************
   * STORAGE (PROD)
   *****************************************************************/
  const DEV_PREFIX = "BMBY__";
  const HasGM =
    typeof GM_getValue === "function" &&
    typeof GM_setValue === "function" &&
    typeof GM_deleteValue === "function";

  const Store = {
    get(k, fallback = null) {
      const key = DEV_PREFIX + k;
      try {
        // GM_getValue can return objects/arrays directly (no JSON.parse needed)
        if (HasGM) {
          const v = GM_getValue(key, fallback);
          return v == null ? fallback : v;
        }

        const v = localStorage.getItem(key);
        if (v == null) return fallback;
        if (typeof v !== 'string') return v;
        if (!v.trim()) return fallback;
        try { return JSON.parse(v); } catch { return fallback; }
      } catch {
        return fallback;
      }
    },
    set(k, v) {
      const key = DEV_PREFIX + k;
      try {
        if (HasGM) return GM_setValue(key, v);
        localStorage.setItem(key, JSON.stringify(v));
      } catch {}
    },
    del(k) {
      const key = DEV_PREFIX + k;
      try {
        if (HasGM) return GM_deleteValue(key);
        localStorage.removeItem(key);
      } catch {}
    },
  };

  // small helper
  function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }


  /*****************************************************************
   * UI IDs
   *****************************************************************/
  const UI = {
    dashId: "bmby-dev-dash",
    backdropId: "bmby-dev-backdrop",
    btnId: "bmby-dev-openbtn",
    cssId: "bmby-dev-style",
  };

  // persist dashboard position (drag & drop)
  const DASH_POS_KEY = "dash_pos";

  function applyDashPosition(dash) {
    const pos = Store.get(DASH_POS_KEY, null);
    if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
      dash.style.transform = "none";
      dash.style.left = `${pos.left}px`;
      dash.style.top  = `${pos.top}px`;
      return;
    }
    // default center
    dash.style.left = "50%";
    dash.style.top = "50%";
    dash.style.transform = "translate(-50%, -50%)";
  }

  function enableDashDrag(dash) {
    if (!dash || dash.__bmbyDragBound) return;
    dash.__bmbyDragBound = true;

    const header = dash.querySelector('.bmby-header');
    if (!header) return;

    let dragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let left = startLeft + dx;
      let top  = startTop + dy;

      // keep within viewport (soft clamp)
      const rect = dash.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      left = Math.max(8, Math.min(left, vw - rect.width - 8));
      top  = Math.max(8, Math.min(top,  vh - rect.height - 8));

      dash.style.transform = 'none';
      dash.style.left = `${left}px`;
      dash.style.top  = `${top}px`;
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);

      const rect = dash.getBoundingClientRect();
      Store.set(DASH_POS_KEY, { left: Math.round(rect.left), top: Math.round(rect.top) });
    };

    header.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      // allow clicks on buttons without dragging
      const target = e.target;
      if (target && (target.closest('button') || target.closest('input') || target.closest('a'))) return;

      const rect = dash.getBoundingClientRect();
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startLeft = rect.left; startTop = rect.top;

      dash.style.transform = 'none';
      dash.style.left = `${startLeft}px`;
      dash.style.top  = `${startTop}px`;

      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mouseup', onUp, true);
      e.preventDefault();
    });
  }

  /*****************************************************************
   * CSS
   *****************************************************************/
  function injectCSS() {
    if (document.getElementById(UI.cssId)) return;

    const s = document.createElement("style");
    s.id = UI.cssId;
    s.textContent = `
:root{
  --bmby-bg:#ffffff;
  --bmby-surface:#f6f7f9;
  --bmby-border:rgba(0,0,0,.10);
  --bmby-text:#101418;
  --bmby-muted:rgba(16,20,24,.62);
  --bmby-accent:#2563eb;
  --bmby-accent2:#7c3aed;
  --bmby-danger:#dc2626;
  --bmby-shadow:0 18px 55px rgba(0,0,0,.20);
  --bmby-radius:22px;
  --bmby-font:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
}

html.bmby-dev-mode{ outline:4px solid rgba(124,58,237,.30); outline-offset:-4px; }

#${UI.btnId}{
  position:fixed; right:16px; bottom:16px; z-index:2147483647;
  padding:10px 12px;
  border-radius:999px;
  border:1px solid rgba(124,58,237,.35);
  background:rgba(124,58,237,.10);
  color:#3b1d9a;
  font:800 12px/1 var(--bmby-font);
  cursor:pointer;
  box-shadow:0 10px 30px rgba(0,0,0,.18);
}
#${UI.btnId}:active{ transform: translateY(1px); }

#${UI.backdropId}{
  position:fixed; inset:0; z-index:2147483646;
  background: rgba(0,0,0,.28);
  display:none; align-items:center; justify-content:center;
}

#${UI.dashId}{
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 640px; max-width: calc(100vw - 24px);
  background: var(--bmby-bg);
  color: var(--bmby-text);
  border: 1px solid var(--bmby-border);
  border-radius: var(--bmby-radius);
  box-shadow: var(--bmby-shadow);
  font-family: var(--bmby-font);
  display:none;
}

.bmby-header{
  display:flex; gap:10px; align-items:center; justify-content:space-between;
  padding: 12px 14px;
  border-bottom:1px solid var(--bmby-border);
  background: linear-gradient(180deg,#ffffff 0%, #f7f8fb 100%);
  border-top-left-radius: var(--bmby-radius);
  border-top-right-radius: var(--bmby-radius);
  cursor: move;
  user-select: none;
}
.bmby-pill{
  display:inline-flex; align-items:center; gap:8px;
  padding:7px 10px; border-radius:999px;
  border:1px solid var(--bmby-border);
  background:#fff; font:800 12px/1 var(--bmby-font);
}
.bmby-pill.dev{ border-color: rgba(124,58,237,.35); background: rgba(124,58,237,.08); color:#3b1d9a; }

.bmby-tabs{ display:flex; gap:8px; padding:10px 14px; }
.bmby-tab{
  padding:8px 10px; border-radius:999px;
  border:1px solid var(--bmby-border);
  background:#fff; cursor:pointer;
  font:800 12px/1 var(--bmby-font);
}
.bmby-tab.active{ border-color: rgba(37,99,235,.35); background: rgba(37,99,235,.08); color:#0b3aa6; }

.bmby-body{ padding:14px; }
.bmby-card{
  background: var(--bmby-surface);
  border:1px solid rgba(0,0,0,.08);
  border-radius:18px;
  padding:12px;
}

.bmby-row{ display:flex; gap:10px; align-items:center; margin-top:8px; font-size:13px; }
.bmby-k{ width:120px; color:var(--bmby-muted); font-weight:800; }
.bmby-v{ font-weight:800; }

.bmby-input{
  width: 240px;
  padding:10px 12px;
  border-radius:14px;
  border:1px solid rgba(0,0,0,.14);
  background:#fff;
  outline:none;
}
.bmby-input:focus{
  border-color: rgba(37,99,235,.55);
  box-shadow:0 0 0 3px rgba(37,99,235,.14);
}

.bmby-btn{
  padding:10px 12px;
  border-radius:14px;
  border:1px solid rgba(0,0,0,.14);
  background:#fff;
  cursor:pointer;
  font-weight:900;
}
.bmby-btn.primary{ border-color: rgba(37,99,235,.35); background: rgba(37,99,235,.10); }
.bmby-btn.secondary{ opacity:.9; }
.bmby-btn:active{ transform: translateY(1px); }

.bmby-small{ color:var(--bmby-muted); font-size:12px; margin-top:6px; line-height:1.4; }

.bmby-hist{
  margin-top:10px;
  max-height: 120px;
  overflow:auto;
  border-radius:14px;
  border:1px solid rgba(0,0,0,.10);
  background:#fff;
}
.bmby-chip{
  padding:8px 10px;
  border-bottom:1px solid rgba(0,0,0,.06);
  font-size:12px;
  cursor:pointer;
}
.bmby-chip:last-child{ border-bottom:none; }

.bmby-result{
  margin-top:10px;
  border-radius:14px;
  border:1px solid rgba(0,0,0,.10);
  background:#fff;
  padding:10px;
  font-size:12px;
  line-height:1.5;
}

.bmby-link{ color:var(--bmby-accent); text-decoration:underline; font-weight:900; }

.bmby-toast{
  position:fixed; left:16px; bottom:16px; z-index:2147483647;
  background: rgba(17,24,39,.92);
  color:#fff;
  border-radius:14px;
  padding:10px 12px;
  font-family: var(--bmby-font);
  font-weight:800;
  box-shadow:0 10px 25px rgba(0,0,0,.25);
  max-width:360px;
  display:none;
}
.bmby-toast.ok{ background: rgba(22,163,74,.92); }
.bmby-toast.warn{ background: rgba(245,158,11,.92); }
.bmby-toast.error{ background: rgba(220,38,38,.92); }


/* Users highlight */
.bmbyUserHL{
  outline: 4px solid rgba(0,255,140,0.95) !important;
  box-shadow: 0 0 0 6px rgba(0,255,140,0.20) inset !important;
  background: rgba(0,255,140,0.12) !important;
  position: relative !important;
}
.bmbyUserHL::after{
  content: 'USER FOUND';
  position: absolute;
  top: -10px; left: 8px;
  background: rgba(0,255,140,0.95);
  color: #111;
  font-weight: 900;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 6px;
}
`;
    document.head.appendChild(s);
  }

  /*****************************************************************
   * Toast (FIXED: no duplicate "ms" variable -> no SyntaxError)
   *****************************************************************/
  let toastTimer = null;
  function toast(msg, type = "info", ms = 4500) {
    // Backward compatible overloads:
    // toast("hi", 3000)
    // toast("hi", "ok", 3000)
    if (typeof type === "number") {
      ms = type;
      type = "info";
    }
    if (toastTimer) {
      try { clearTimeout(toastTimer); } catch {}
      toastTimer = null;
    }

    let el = document.getElementById("bmbyToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "bmbyToast";
      el.className = "bmby-toast";
      document.body.appendChild(el);
    }

    el.className = "bmby-toast" + (type && type !== "info" ? " " + type : "");
    el.textContent = msg;
    el.style.display = "block";

    toastTimer = setTimeout(() => {
      try { el.style.display = "none"; } catch {}
    }, ms);
  }

  /*****************************************************************
   * Helpers
   *****************************************************************/
  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  
  function savePwHighlight(projectIdP, password) {
    try { Store.set(PW_HIGHLIGHT_KEY, { project: String(projectIdP||""), password: String(password||""), ts: Date.now() }); } catch {}
  }
  function loadPwHighlight() {
    try { return Store.get(PW_HIGHLIGHT_KEY, null); } catch { return null; }
  }
  function clearPwHighlight() {
    try { Store.remove(PW_HIGHLIGHT_KEY); } catch {}
  }

function escapeAttr(s) {
    return escapeHtml(s).replace(/\s/g, "%20");
  }

  /*****************************************************************
   * Boot UI elements
   *****************************************************************/
  function ensureButton() {
    if (document.getElementById(UI.btnId)) return;
    const b = document.createElement("button");
    b.id = UI.btnId;
    b.type = "button";
    b.textContent = "BMBY DEV";
    b.addEventListener("click", toggleDashboard);
    document.body.appendChild(b);
  }

  function ensureBackdrop() {
    if (document.getElementById(UI.backdropId)) return;
    const bd = document.createElement("div");
    bd.id = UI.backdropId;
    bd.addEventListener("click", (e) => {
      if (e.target === bd) closeDashboard();
    });
    document.body.appendChild(bd);
  }

  const TABS = [
    { id: "voip", label: "VOIP" },
    { id: "passwords", label: "סיסמאות" },
    { id: "extensions", label: "שלוחות" },
    { id: "users", label: "משתמשים" },
  ];

  function buildDashboard() {
    if (document.getElementById(UI.dashId)) return;

    ensureBackdrop();

    const dash = document.createElement("div");
    dash.id = UI.dashId;

    dash.innerHTML = `
      <div class="bmby-header">
        <span class="bmby-pill dev">DEV: ON</span>
        <span class="bmby-pill">דשבורד טלפוניה (DEV)</span>
        <span style="margin-right:auto"></span>
        <button class="bmby-btn secondary" data-x="close">סגור</button>
      </div>
      <div class="bmby-tabs" data-x="tabs"></div>
      <div class="bmby-body">
        <div class="bmby-card" data-x="panel"></div>
      </div>
    `;

    document.getElementById(UI.backdropId).appendChild(dash);

    // drag & drop + restore last position
    enableDashDrag(dash);
    applyDashPosition(dash);

    dash.querySelector('[data-x="close"]').addEventListener("click", closeDashboard);

    const tabsEl = dash.querySelector('[data-x="tabs"]');
    for (const t of TABS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bmby-tab";
      btn.textContent = t.label;
      btn.dataset.tab = t.id;
      btn.addEventListener("click", () => setActiveTab(t.id));
      tabsEl.appendChild(btn);
    }

    const saved = Store.get("activeTab", "voip");
    setActiveTab(saved);

    document.documentElement.classList.add("bmby-dev-mode");
  }

  function openDashboard() {
    buildDashboard();
    const bd = document.getElementById(UI.backdropId);
    const dash = document.getElementById(UI.dashId);
    if (bd) bd.style.display = "flex";
    if (dash) {
      dash.style.display = "block";
      applyDashPosition(dash);
    }
  }

  function closeDashboard() {
    const bd = document.getElementById(UI.backdropId);
    const dash = document.getElementById(UI.dashId);
    if (dash) dash.style.display = "none";
    if (bd) bd.style.display = "none";
  }

  function toggleDashboard() {
    const bd = document.getElementById(UI.backdropId);
    const dash = document.getElementById(UI.dashId);
    if (!bd || !dash) return openDashboard();
    const isOpen = bd.style.display !== "none";
    if (isOpen) closeDashboard();
    else openDashboard();
  }

  function setActiveTab(tabId) {
    Store.set("activeTab", tabId);

    const dash = document.getElementById(UI.dashId);
    if (!dash) return;

    dash.querySelectorAll(".bmby-tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tabId);
    });

    const panel = dash.querySelector('[data-x="panel"]');
    if (!panel) return;

    if (tabId === "voip") panel.innerHTML = renderVoipPanel();
    else if (tabId === "passwords") panel.innerHTML = renderPasswordsPanel();
    else if (tabId === "extensions") panel.innerHTML = renderExtensionsPanel();
    else if (tabId === "users") panel.innerHTML = renderUsersPanel();
    else panel.innerHTML = renderComingSoon(tabId);

    if (tabId === "voip") bindVoipPanel(panel);
    if (tabId === "passwords") bindPasswordsPanel(panel);
    if (tabId === "extensions") bindExtensionsPanel(panel);
    if (tabId === "users") bindUsersPanel(panel);
  }

  function renderComingSoon(tabId) {
    const title =
      tabId === "passwords" ? "חיפוש סיסמאות" :
      tabId === "extensions" ? "חיפוש שלוחות" : "בקרוב";
    return `
      <div style="font:900 14px/1.2 var(--bmby-font);">${title}</div>
      <div class="bmby-small">בקרוב נוסיף את הפיצ׳ר הזה. כרגע DEV מתמקד ב-VOIP.</div>
    `;
  }

  /*****************************************************************
   * TAB: PASSWORDS (from PROD)
   *****************************************************************/
  const PW_REQ_KEY = "pw_req_dev_v1";
  function savePwReq(req) { Store.set(PW_REQ_KEY, req); }
  function loadPwReq() { return Store.get(PW_REQ_KEY, null); }
  function clearPwReq() { try { Store.remove(PW_REQ_KEY); } catch(e) { Store.set(PW_REQ_KEY, null); } }

  

  function ensureManualPwHighlighter() {
    if (document.getElementById("bmby-manual-pw-btn")) return;

    const btn = document.createElement("button");
    btn.id = "bmby-manual-pw-btn";
    btn.textContent = "הדגש סיסמא";
    btn.title = "לחץ כדי לבחור סיסמא ולהדגיש בטבלה";
    btn.style.cssText = `
      position:fixed;left:16px;bottom:16px;z-index:2147483647;
      background:rgba(0,0,0,.85);color:#fff;border:0;border-radius:12px;
      padding:10px 12px;font:13px Arial;font-weight:900;cursor:pointer;
      box-shadow:0 10px 30px rgba(0,0,0,.35);
    `;
    btn.addEventListener("click", async () => {
      const pw = prompt("איזו סיסמא להדגיש?", "");
      if (!pw) return;
      // store as if it came from dashboard, then run highlight
      savePwReq({ project: "MANUAL", password: String(pw).trim(), ts: Date.now() });
      await sleep(150);
      await setTimeout(() => { try { highlightPasswordOnGridRemoteSite(); } catch(e){ log('highlight call failed', e);} }, 600);
  
    });
    document.body.appendChild(btn);
  }

  // Highlight result on /nihul/GridRemoteSite.php (PROD-like)
  async function highlightPasswordOnGridRemoteSite() {
    if (!/\/nihul\/GridRemoteSite\.php/i.test(location.pathname)) return;
    log('GridRemoteSite detected');

    const req = loadPwReq();
    if (!req || !req.password) {
      log('No pending password request in storage. Showing manual highlight button.');
      try { ensureManualPwHighlighter(); } catch (e) { log('ensureManualPwHighlighter failed', e); }
      return;
    }
    log('Pending password request found', req);

    // TTL 5 minutes
    const ts = Number(req.ts || 0);
    if (!ts || (Date.now() - ts) > 5 * 60_000) { clearPwReq(); return; }

    const wanted = String(req.password).trim();
    if (!wanted) { clearPwReq(); return; }

    // Wait for tables to appear
    for (let i = 0; i < 40; i++) {
      if (document.querySelectorAll("table th").length) break;
      await sleep(250);
    }

    const norm = (s) => String(s || "").trim().replace(/\s+/g, " ");
    const isPwHeader = (t) => {
      const x = norm(t);
      return x === "סיסמא" || x === "סיסמה" || x.includes("סיסמ");
    };

    // Find the table that contains password header
    const tables = [...document.querySelectorAll("table")];
    let hitTable = null;
    let pwIdx = -1;

    for (const t of tables) {
      const ths = [...t.querySelectorAll("th")];
      if (!ths.length) continue;
      const idx = ths.findIndex(th => isPwHeader(th.textContent));
      if (idx !== -1) { hitTable = t; pwIdx = idx; break; }
    }

    if (!hitTable || pwIdx === -1) { clearPwReq(); return; }

    const rows = [...hitTable.querySelectorAll("tbody tr")];
    if (!rows.length) { clearPwReq(); return; }

    // styles (once)
    if (!document.getElementById("bmby-pw-hl-style")) {
      const st = document.createElement("style");
      st.id = "bmby-pw-hl-style";
      st.textContent = `
        .bmby-pw-dim table tr {  opacity: 1 !important;  filter: none !important;}
        .bmby-pw-dim table tbody tr.bmby-pw-hit { opacity: 1 !important; filter: none !important; }
        .bmby-pw-hit { background: #fff3c4 !important;  outline: 2px solid #f0c040;  font-weight: bold;}
        .bmby-pw-hit td { background: transparent !important; }
        .bmby-pw-hit td.bmby-pw-cell { background: #fff3a0 !important; font-weight: 900; }
        #bmby-pw-banner{
          position:fixed;left:16px;right:16px;top:12px;z-index:2147483647;
          background:rgba(0,0,0,.88);color:#fff;padding:10px 12px;border-radius:12px;
          font:13px Arial;box-shadow:0 12px 30px rgba(0,0,0,.35);
          display:flex;align-items:center;justify-content:space-between;gap:12px;
        }
        #bmby-pw-banner b{font-size:14px}
        #bmby-pw-banner button{
          border:0;border-radius:10px;padding:8px 10px;cursor:pointer;font-weight:800;
          background:#ffe66d;color:#111;
        }
      `;
      document.head.appendChild(st);
    }

    for (const r of rows) {
      const tds = r.querySelectorAll("td");
      const c = tds[pwIdx];
      if (!c) continue;

      const cellText = norm(c.innerText);
      const inputVal = norm(c.querySelector("input,textarea,select")?.value);
      const w = norm(wanted);

      if (cellText === w || inputVal === w || cellText.includes(w)) {
        // banner
        const old = document.getElementById("bmby-pw-banner");
        if (old) old.remove();
        const banner = document.createElement("div");
        banner.id = "bmby-pw-banner";
        banner.innerHTML = `<div><b>✅ נמצאה סיסמא</b> — ${escapeHtml(wanted)}</div>
                            <button id="bmby-pw-banner-close">סגור</button>`;
        document.body.appendChild(banner);
        document.getElementById("bmby-pw-banner-close").onclick = () => banner.remove();

        // dim all rows, mark hit
        document.body.classList.add("bmby-pw-dim");
        r.classList.add("bmby-pw-hit");
        c.classList.add("bmby-pw-cell");

        r.style.outline = "3px solid rgba(0,0,0,.25)";
        r.scrollIntoView({ behavior: "smooth", block: "center" });

        clearPwReq();
        return;
      }
    }

    // not found
    clearPwReq();
  }

function renderPasswordsPanel() {
    const lastPid = Store.get("pw_last_pid", "");
    const lastPw  = Store.get("pw_last_pw", "");
    const hist = getHistory("passwords");

    const histHtml =
      hist.length === 0
        ? `<div class="bmby-small">אין היסטוריה</div>`
        : `<div class="bmby-hist">${hist
            .map((h) => {
              const parts = String(h).split("|");
              const pid = parts[0] || "";
              const pw = parts.slice(1).join("|") || "";
              const label = `P${escapeHtml(pid)} | ${escapeHtml(pw)}`;
              return `<div class="bmby-chip" data-x="histpw" data-p="${escapeHtml(pid)}" data-w="${escapeHtml(pw)}">${label}</div>`;
            })
            .join("")}</div>`;

    return `
      <div style="font:900 14px/1.2 var(--bmby-font);">חיפוש סיסמאות (GridRemoteSite)</div>
      <div class="bmby-small">פותח טאב של הממשקים (GridRemoteSite) ומדגיש את הסיסמא בעמודה "סיסמא".</div>

      <div class="bmby-form">
        <label>Project</label>
        <input class="bmby-input" data-x="pid" placeholder="9681 או P9681" value="${escapeHtml(lastPid)}" />
        <label style="margin-top:8px">Password</label>
        <input class="bmby-input" data-x="pw" placeholder="סיסמא" value="${escapeHtml(lastPw)}" />
        <div class="bmby-actions">
          <button class="bmby-btn" data-x="run">חפש</button>
          <button class="bmby-btn secondary" data-x="clear">נקה</button>
        </div>
        <div class="bmby-small" style="margin-top:6px">אחרונים:</div>
        ${histHtml}
        <div class="bmby-result" data-x="result"><div class="bmby-small">פותח טאב ומדגיש שם.</div></div>
      </div>
    `;
  }

  async function findPasswordInInterfaces(pidDigits, password, resEl) {
  const url = new URL("/nihul/GridRemoteSite.php", location.origin);
  url.searchParams.set("ProjectID", String(pidDigits));

  // UI: searching
  if (resEl) {
    resEl.innerHTML = `<div class="bmby-small">מחפש סיסמא בתוך הממשקים…</div>
                       <div class="bmby-small" style="opacity:.8">פרויקט: ${escapeHtml("P" + pidDigits)}</div>`;
  }

  // Fetch HTML (same-origin, with cookies)
  const html = await fetch(url.toString(), { credentials: "include" }).then(r => {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.text();
  });

  const doc = new DOMParser().parseFromString(html, "text/html");

  // Find "סיסמא" column index
  const ths = [...doc.querySelectorAll("table th")];
  const idx = ths.findIndex(th => (th.textContent || "").trim() === "סיסמא");
  if (idx === -1) {
    if (resEl) resEl.innerHTML = `<div class="bmby-small">❌ לא נמצאה עמודה בשם <b>סיסמא</b></div>`;
    return { found: false, reason: "no_column", url: url.toString() };
  }

  const rows = [...doc.querySelectorAll("table tbody tr")];
  for (const r of rows) {
    const tds = r.querySelectorAll("td");
    const cell = tds[idx];
    if (!cell) continue;

    if ((cell.textContent || "").trim() === String(password)) {
      const name = (tds[0]?.textContent || "").trim() || "—";

      if (resEl) {
        resEl.innerHTML =
          `<div class="bmby-small">✅ נמצאה הסיסמא!</div>` +
          `<div class="bmby-small" style="opacity:.9;margin-top:6px">ממשק: <b>${escapeHtml(name)}</b></div>` +
          `<div class="bmby-small" style="opacity:.9">סיסמא: <b>${escapeHtml(password)}</b></div>` +
          `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">` +
            `<button data-x="open-grid" class="bmby-btn bmby-btn-light">פתח רשימה</button>` +
          `</div>`;
        const btn = resEl.querySelector('[data-x="open-grid"]');
        if (btn) btn.addEventListener("click", (e) => {
          e.preventDefault();
          try { savePwReq({ project: "P" + String(pidDigits), password: String(password), ts: Date.now() }); } catch (err) { console.warn("[BMBY-DASH] savePwReq failed", err); }
          try { savePwReq({ project: "P" + String(pidDigits), password: String(password), ts: Date.now() }); } catch (err) { console.warn("[BMBY-DASH] savePwReq failed", err); }
          window.open(url.toString(), "_blank", "noopener,noreferrer");
        });
      }

      return { found: true, name, url: url.toString() };
    }
  }

  if (resEl) {
    resEl.innerHTML =
      `<div class="bmby-small">❌ לא נמצאה הסיסמא בפרויקט</div>` +
      `<div class="bmby-small" style="opacity:.8;margin-top:6px">אפשר לפתוח את הרשימה לבדיקה ידנית.</div>` +
      `<div style="margin-top:10px">` +
        `<button data-x="open-grid" class="bmby-btn bmby-btn-light">פתח רשימה</button>` +
      `</div>`;
    const btn = resEl.querySelector('[data-x="open-grid"]');
    if (btn) btn.addEventListener("click", (e) => {
          e.preventDefault();
          try { savePwReq({ project: "P" + String(pidDigits), password: String(password), ts: Date.now() }); } catch (err) { console.warn("[BMBY-DASH] savePwReq failed", err); }
          try { savePwReq({ project: "P" + String(pidDigits), password: String(password), ts: Date.now() }); } catch (err) { console.warn("[BMBY-DASH] savePwReq failed", err); }
          window.open(url.toString(), "_blank", "noopener,noreferrer");
        });
  }

  return { found: false, reason: "not_found", url: url.toString() };
}


  function bindPasswordsPanel(panel) {
    const pidEl = panel.querySelector('[data-x="pid"]');
    const pwEl  = panel.querySelector('[data-x="pw"]');
    const run   = panel.querySelector('[data-x="run"]');
    const clear = panel.querySelector('[data-x="clear"]');
    const resEl = panel.querySelector('[data-x="result"]');

    const runIt = async () => {
      const pid = normalizePid(pidEl.value);
      const pw = String(pwEl.value || "").trim();
      if (!pid) return toast("❌ מספר פרויקט לא תקין", false);
      if (!pw) return toast("❌ חסרה סיסמא", false);

      Store.set("pw_last_pid", pidEl.value);
      Store.set("pw_last_pw", pw);

      addHistory("passwords", `${pid}|${pw}`);

      resEl.innerHTML = `<div class="bmby-small">מחפש סיסמא בתוך הממשקים לפרויקט ${escapeHtml(pid)}...</div>`;
      try {
        const pidDigits = pid;
        await findPasswordInInterfaces(pidDigits, pw, resEl);
      } catch (err) {
        console.error("[BMBY PW]", err);
        resEl.innerHTML = `<div class="bmby-small">❌ שגיאה בחיפוש (ייתכן שנדרש להתחבר מחדש)</div>`;
        toast("❌ שגיאה בחיפוש סיסמא", false);
      }
    };

    run?.addEventListener("click", (e) => { e.preventDefault(); runIt(); });
    clear?.addEventListener("click", (e) => {
      e.preventDefault();
      pidEl.value = "";
      pwEl.value = "";
      Store.set("pw_last_pid", "");
      Store.set("pw_last_pw", "");
      clearHistory("passwords");
      clearPwReq();
      setActiveTab("passwords"); // re-render
      toast("נוקה", true);
    });

    panel.querySelectorAll('[data-x="histpw"]').forEach((chip) => {
      chip.addEventListener("click", () => {
        pidEl.value = chip.dataset.p || "";
        pwEl.value = chip.dataset.w || "";
      });
    });

    pwEl?.addEventListener("keydown", (e) => { if (e.key === "Enter") runIt(); });
    pidEl?.addEventListener("keydown", (e) => { if (e.key === "Enter") runIt(); });
  }

  async function runPasswordHighlightIfNeeded() {
    if (!/\/nihul\/GridRemoteSite\.php$/i.test(location.pathname)) return;

    const req = loadPwReq();
    if (!req?.password || !req?.pid) return;

    // avoid keeping stale requests forever
    if (Date.now() - Number(req.ts || 0) > 5 * 60_000) {
      clearPwReq();
      return;
    }

    // wait for table
    for (let i = 0; i < 80; i++) {
      const ths = [...document.querySelectorAll("table th")];
      if (ths.length) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    const ths = [...document.querySelectorAll("table th")];
    const idx = ths.findIndex((th) => (th.textContent || "").trim() === "סיסמא");
    if (idx === -1) {
      toast('❌ אין עמודה בשם "סיסמא"', false);
      clearPwReq();
      return;
    }

    const rows = document.querySelectorAll("table tbody tr");
    for (const r of rows) {
      const tds = r.querySelectorAll("td");
      const c = tds[idx];
      if (c && (c.textContent || "").trim() === String(req.password).trim()) {
        r.style.outline = "3px solid #ffe66d";
        c.style.background = "#ffe66d";
        c.style.color = "#111";
        c.style.fontWeight = "900";
        r.scrollIntoView({ behavior: "smooth", block: "center" });
        toast(`✅ נמצאה הסיסמא (P${req.pid})`, true);
        clearPwReq();
        return;
      }
    }

    toast(`❌ לא נמצאה הסיסמא (P${req.pid})`, false);
    clearPwReq();
  }

  /*****************************************************************
   * TAB: EXTENSIONS (from PROD, with stop)
   *****************************************************************/
  let extRunToken = { running: false, stop: false };

  function renderExtensionsPanel() {
    const last = Store.get("ext_last", "");
    const hist = getHistory("extensions");

    const histHtml =
      hist.length === 0
        ? `<div class="bmby-small">אין היסטוריה</div>`
        : `<div class="bmby-hist">${hist
            .map((h) => `<div class="bmby-chip" data-x="histext" data-v="${escapeHtml(h)}">${escapeHtml(h)}</div>`)
            .join("")}</div>`;

    return `
      <div style="font:900 14px/1.2 var(--bmby-font);">חיפוש שלוחה</div>
      <div class="bmby-small">מחפש שלוחה ע"י בדיקת Projects שמופיעים בדף הנוכחי (ProjectID ב-onclick/href) ואז POST ל-SettingsExt.php.</div>

      <div class="bmby-form">
        <label>Extension</label>
        <input class="bmby-input" data-x="ext" placeholder="למשל 201" value="${escapeHtml(last)}" />
        <div class="bmby-actions">
          <button class="bmby-btn" data-x="run">חפש</button>
          <button class="bmby-btn secondary" data-x="stop">עצור</button>
          <button class="bmby-btn secondary" data-x="clear">נקה</button>
        </div>

        <div class="bmby-small" style="margin-top:6px">אחרונים:</div>
        ${histHtml}

        <div class="bmby-result" data-x="result">
          <div class="bmby-small">טיפ: כדי לקבל הרבה ProjectID, עמוד במסך רשימת פרויקטים.</div>
        </div>
      </div>
    `;
  }

  function collectProjectIdsFromPage() {
    const ids = new Set();
    document.querySelectorAll("[onclick], a[href]").forEach((el) => {
      const src = el.getAttribute("onclick") || el.getAttribute("href") || "";
      const m1 = src.match(/ProjectID=(\d+)/i);
      const m2 = src.match(/FindedProjects=(\d+)/i);
      if (m1) ids.add(m1[1]);
      if (m2) ids.add(m2[1]);
    });
    return [...ids].sort((a, b) => Number(a) - Number(b));
  }

  async function fetchSettingsExtHtml(projectId) {
    const url = new URL("/nihul/VoIP/SettingsExt.php", location.origin);
    const body =
      `ProjectID=${encodeURIComponent(projectId)}` +
      `&Ext=0&Del=0&ExtLite=0&Update=`;
    const res = await fetch(url.toString(), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
      },
      body
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }

  function htmlHasExtension(html, ext) {
    if (!html) return false;
    const re = new RegExp(`\\b${String(ext).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`);
    return re.test(html);
  }

  async function runExtensionSearch(ext, resultEl) {
    if (extRunToken.running) return;
    extRunToken.running = true;
    extRunToken.stop = false;

    const ids = collectProjectIdsFromPage();
    if (!ids.length) {
      resultEl.innerHTML = `<div class="bmby-small">❌ לא נמצאו ProjectID בדף הזה. עבור למסך רשימת פרויקטים ואז נסה שוב.</div>`;
      extRunToken.running = false;
      return;
    }

    const t0 = Date.now();
    resultEl.innerHTML = `<div class="bmby-small">מתחיל... נמצאו ${ids.length} פרויקטים לבדיקה.</div>`;

    for (let i = 0; i < ids.length; i++) {
      if (extRunToken.stop) {
        resultEl.innerHTML = `<div class="bmby-small">⏹ נעצר. נבדקו ${i}/${ids.length}</div>`;
        extRunToken.running = false;
        return;
      }

      const pid = ids[i];
      const pct = Math.round(((i + 1) / ids.length) * 100);
      resultEl.innerHTML = `
        <div class="bmby-small">בודק פרויקט ${escapeHtml(pid)}...</div>
        <div class="bmby-small">התקדמות: ${i + 1}/${ids.length} (${pct}%)</div>
      `;

      try {
        const html = await fetchSettingsExtHtml(pid);
        if (htmlHasExtension(html, ext)) {
          await copyToClipboard(pid);
          resultEl.innerHTML = `
            <div class="bmby-small">✅ נמצאה שלוחה ${escapeHtml(ext)} בפרויקט <b>${escapeHtml(pid)}</b></div>
            <div class="bmby-small">הועתק ללוח: ${escapeHtml(pid)}</div>
          `;
          extRunToken.running = false;
          return;
        }
      } catch {
        // ignore per project failures
      }

      // small throttle
      await new Promise((r) => setTimeout(r, 120));
    }

    const sec = Math.round((Date.now() - t0) / 1000);
    resultEl.innerHTML = `<div class="bmby-small">❌ לא נמצאה שלוחה ${escapeHtml(ext)} (נבדקו ${ids.length} פרויקטים ב-${sec}s)</div>`;
    extRunToken.running = false;
  }

  function bindExtensionsPanel(panel) {
    const extEl = panel.querySelector('[data-x="ext"]');
    const run   = panel.querySelector('[data-x="run"]');
    const stop  = panel.querySelector('[data-x="stop"]');
    const clear = panel.querySelector('[data-x="clear"]');
    const resEl = panel.querySelector('[data-x="result"]');

    const runIt = () => {
      const ext = String(extEl.value || "").trim();
      if (!/^\d+$/.test(ext)) return toast("❌ שלוחה חייבת להיות מספר", false);

      Store.set("ext_last", ext);
      addHistory("extensions", ext);

      runExtensionSearch(ext, resEl);
    };

    run?.addEventListener("click", (e) => { e.preventDefault(); runIt(); });
    stop?.addEventListener("click", (e) => { e.preventDefault(); extRunToken.stop = true; });
    clear?.addEventListener("click", (e) => {
      e.preventDefault();
      extEl.value = "";
      Store.set("ext_last", "");
      clearHistory("extensions");
      extRunToken.stop = true;
      setActiveTab("extensions");
      toast("נוקה", true);
    });

    panel.querySelectorAll('[data-x="histext"]').forEach((chip) => {
      chip.addEventListener("click", () => { extEl.value = chip.dataset.v || ""; });
    });

    extEl?.addEventListener("keydown", (e) => { if (e.key === "Enter") runIt(); });
  }

  /*****************************************************************
   * HISTORY (simple list of last searched project IDs)
   *****************************************************************/
  function getHistory(tool) {
    const v = Store.get("hist_" + tool, []);
    return Array.isArray(v) ? v : [];
  }
  function addHistory(tool, val) {
    val = String(val || "").trim();
    if (!val) return;
    const hist = getHistory(tool).filter((x) => String(x) !== val);
    hist.unshift(val);
    Store.set("hist_" + tool, hist.slice(0, 20));
  }
  function clearHistory(tool) {
    Store.set("hist_" + tool, []);
  }

  /*****************************************************************
   * VOIP PARSING + LEARNING
   *****************************************************************/
  function parseVoipFromText(text) {
    const s = String(text || "");

    // Try JSON first
    try {
      const j = JSON.parse(s);
      const pick = (obj, keys) => {
        for (const k of keys) {
          if (obj && typeof obj === "object" && k in obj && obj[k] != null && String(obj[k]).trim() !== "") {
            return String(obj[k]).trim();
          }
        }
        return "";
      };

      // common shapes
      const domain = pick(j, ["domain", "Domain", "sip_domain", "sipDomain"]) || pick(j?.data, ["domain", "Domain", "sip_domain", "sipDomain"]);
      const account = pick(j, ["account", "Account", "accountCode", "AccountCode", "account_code", "Account Code"]) || pick(j?.data, ["account", "Account", "accountCode", "AccountCode", "account_code", "Account Code"]);
      const partition = pick(j, ["partition", "Partition", "sip_partition", "sipPartition"]) || pick(j?.data, ["partition", "Partition", "sip_partition", "sipPartition"]);

      if (domain || account || partition) {
        return { domain: domain || "—", account: account || "—", partition: partition || "—" };
      }
    } catch {}

    // HTML fallback: parse HTML form (BMBY usually renders VOIP as HTML, not JSON)
    try {
      const doc = new DOMParser().parseFromString(s, "text/html");
      const byId = (id) => doc.getElementById(id);
      // Prefer exact known VOIP fields when present (PerProject.Ajax.php)
      const domainSel = byId("PartitionDomain");
      const domainOpt = domainSel ? (domainSel.querySelector("option[selected]") || domainSel.querySelector("option:checked") || domainSel.querySelector("option")) : null;
      const explicitDomain = domainOpt ? (domainOpt.getAttribute("value") || domainOpt.textContent || "").trim() : "";
      const explicitAccount = (byId("VoipAccountCode") && byId("VoipAccountCode").value != null) ? String(byId("VoipAccountCode").value).trim() : "";
      const explicitPartition = (byId("VoipPartition") && byId("VoipPartition").value != null) ? String(byId("VoipPartition").value).trim() : "";
      if (explicitDomain || explicitAccount || explicitPartition) {
        return { domain: explicitDomain || "—", account: explicitAccount || "—", partition: explicitPartition || "—" };
      }


      const clean = (v) => {
        const t = String(v || "").trim();
        if (!t || t === "—" || t === "-" || t === "— —") return "";
        return t;
      };

      
// --- Strict table-row parsing (RTL safe) ---
const getRowValue = (wantedLabels, opts = {}) => {
  const { exclude = [], take = "control" } = opts;
  const want = wantedLabels.map((x) => String(x).toLowerCase());
  const ex = exclude.map((x) => String(x).toLowerCase());

  const trs = Array.from(doc.querySelectorAll("tr"));
  for (const tr of trs) {
    const tds = Array.from(tr.querySelectorAll("td,th"));
    if (!tds.length) continue;

    // Find which cell is the label (contains the wanted text)
    for (let i = 0; i < tds.length; i++) {
      const cellText = (tds[i].textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!cellText) continue;

      const isExcluded = ex.some((e) => e && cellText.includes(e));
      if (isExcluded) continue;

      const isWanted = want.some((w) => w && (cellText === w || cellText.includes(w)));
      if (!isWanted) continue;

      // Typically: [label][control] or [control][label] depending on RTL/layout.
      const candidates = [];
      if (i + 1 < tds.length) candidates.push(tds[i + 1]);
      if (i - 1 >= 0) candidates.push(tds[i - 1]);

      // Prefer the adjacent cell that actually contains a control.
      for (const c of candidates) {
        const el = c.querySelector("select,input,textarea");
        if (!el) continue;

        if (el.tagName === "SELECT") {
          const sel = el;
          const opt = sel.selectedOptions && sel.selectedOptions.length ? sel.selectedOptions[0] : null;
          const v = clean(opt ? (opt.value || opt.textContent) : sel.value);
          if (v) return v;
        } else if (el.tagName === "INPUT") {
          const type = (el.getAttribute("type") || "text").toLowerCase();
          if (type === "checkbox") {
            return el.checked ? "כן" : "לא";
          }
          const v = clean(el.value);
          if (v) return v;
        } else {
          const v = clean(el.value);
          if (v) return v;
        }
      }

      // Fallback: sometimes value is plain text in adjacent cell
      for (const c of candidates) {
        const v = clean((c.textContent || "").replace(/\s+/g, " ").trim());
        if (v) return v;
      }
    }
  }
  return "";
};

// Prefer exact VOIP fields
let d = clean(getRowValue(["domain"], { exclude: ["cell partition"] }));
let a = clean(getRowValue(["account code", "account"], {}));
let p = clean(getRowValue(["partition"], { exclude: ["cell partition"] }));

// Legacy label parser (kept as fallback)
if (!d) d = clean(getByLabelFromDoc(doc, ["domain", "sip domain", "sip server", "voip domain", "דומיין", "שרת", "דומיין voip"]));
if (!a) a = clean(getByLabelFromDoc(doc, ["account code", "account", "accountcode", "account_code", "sip user", "sip username", "user", "קוד חשבון", "חשבון", "משתמש", "משתמש sip"]));
if (!p) p = clean(getByLabelFromDoc(doc, ["partition", "sip partition", "מחיצה", "פרטישן", "שלוחה"]));
// Heuristic scan by input names/ids (when labels are not in table cells)
      const inputs = Array.from(doc.querySelectorAll("input,select,textarea"));
      const pickInput = (reName, prefer = (v) => true) => {
        for (const el of inputs) {
          const name = ((el.getAttribute("name") || "") + " " + (el.id || "")).toLowerCase();
          if (!reName.test(name)) continue;

          if (el.tagName === "INPUT" && (el.type || "").toLowerCase() === "checkbox") {
            const val = el.checked ? "כן" : "לא";
            if (prefer(val)) return val;
            continue;
          }
          const val = String(el.value || "").trim();
          if (val && prefer(val)) return val;
        }
        return "";
      };

      if (!d) d = pickInput(/(domain|sip.*domain|sip.*server|voip.*domain)/i, (v) => v.length >= 3);
      if (!a) a = pickInput(/(accountcode|account_code|account\s*code|account|user(name)?|login|sip.*user|ext|extension|code)/i, (v) => v.length >= 2);
      if (!p) p = pickInput(/partition/i, () => true);

      if (String(p).toLowerCase() === "on") p = "כן";

      if (d || a || p) {
        return { domain: d || "—", account: a || "—", partition: p || "—" };
      }
    } catch {}

    return null;
  }

  function buildLearnTemplateFromUrl(url) {
    // Replace CompanyID/ProjectID numbers with tokens
    try {
      const u = new URL(url, location.origin);
      if (u.searchParams.has("CompanyID")) u.searchParams.set("CompanyID", "{CompanyID}");
      if (u.searchParams.has("ProjectID")) u.searchParams.set("ProjectID", "{ProjectID}");
      return u.toString();
    } catch {
      return String(url || "");
    }
  }

  function tryLearnFromNetEvent(ev) {
    const url = String(ev?.url || "");
    const body = ev?.body;
    if (!url || !body) return;

    // Heuristic: only consider requests that look VOIP related
    const u = url.toLowerCase();
    if (!(u.includes("voip") || u.includes("sip") || u.includes("telephony") || u.includes("settings"))) return;

    const parsed = parseVoipFromText(body);
    if (!parsed) return;

    // If we got at least one meaningful field, store as learned endpoint
    const hasValue = (v) => v && v !== "—" && String(v).trim() !== "";
    if (!(hasValue(parsed.domain) || hasValue(parsed.account) || hasValue(parsed.partition))) return;

    const template = buildLearnTemplateFromUrl(url);
    Store.set("voip_learn_template", template);
    Store.set("voip_learn_kind", ev.kind || "fetch");
    Store.set("voip_learn_last", { template, at: Date.now() });
    toast("✅ למדתי את מקור ה-VOIP מהמערכת (יישמר ב-DEV)", "ok");
  }

  // Live learning: listen to network events while the user works normally
  NetSpy.on(tryLearnFromNetEvent);

  function getLearnedTemplate() {
    const t = Store.get("voip_learn_template", "");
    return t && typeof t === "string" ? t : "";
  }

  function buildUrlFromTemplate(template, cid, pid) {
    return String(template || "")
      .replaceAll("{CompanyID}", encodeURIComponent(String(cid)))
      .replaceAll("{ProjectID}", encodeURIComponent(String(pid)));
  }

/*****************************************************************
   * VOIP FLOW (Background): Wizard fetch -> CompanyID -> VOIP Settings fetch
   *****************************************************************/
  function normalizePid(input) {
    const s = String(input || "").trim();
    const m = s.match(/\d+/);
    if (!m) return null;
    return m[0];
  }

  async function fetchCompanyIdForPid(pid) {
    // Fetch Wizard?q=P#### and extract CompanyID from onclick in results table
    const q = "P" + String(pid);
    const url = location.origin + "/nihul/Wizard.php?q=" + encodeURIComponent(q);

    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("Wizard fetch failed: " + res.status);

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const tds = Array.from(doc.querySelectorAll("td[onclick]"));
    const td = tds.find((x) => {
      const oc = x.getAttribute("onclick") || "";
      return oc.includes("Wizard.php") && oc.includes("CompanyID=") && oc.includes("FindedProjects=" + String(pid));
    });

    if (!td) return null;

    const oc = td.getAttribute("onclick") || "";
    const mm = oc.match(/CompanyID=(\d+)/i);
    return mm ? mm[1] : null;
  }

  function getByLabelFromDoc(doc, labels) {
    const arr = Array.isArray(labels) ? labels : [labels];
    const wants = arr.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean);
    if (!wants.length) return "—";

    const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

    // We search in common containers; limit to avoid heavy pages
    const cells = Array.from(doc.querySelectorAll("td,th,label,div,span")).slice(0, 6000);
    for (const cell of cells) {
      const txt = norm(cell.textContent);
      if (!txt) continue;

      const hit = wants.some((w) => txt === w || txt.startsWith(w + ":") || txt.includes(w));
      if (!hit) continue;

      // Prefer searching in the same row (table layouts)
      const row = cell.closest("tr") || cell.parentElement;
      if (row) {
        const inputs = Array.from(row.querySelectorAll("input,select,textarea"));
        for (const el of inputs) {
          if (cell.contains(el)) continue;

          if (el.tagName === "INPUT" && (el.type || "").toLowerCase() === "checkbox") {
            return el.checked ? "כן" : "לא";
          }
          const v = (el.value || "").toString().trim();
          if (v) return v;
        }

        // Sometimes value is plain text in another cell
        const rowCells = Array.from(row.querySelectorAll("td,th"));
        for (const rc of rowCells) {
          if (rc === cell) continue;
          const t = norm(rc.textContent);
          if (t && !wants.some((w) => t.includes(w))) return t;
        }
      }

      // Fallback: check siblings near the label
      const sibs = [cell.nextElementSibling, cell.previousElementSibling].filter(Boolean);
      for (const s of sibs) {
        const el = s.querySelector?.("input,select,textarea");
        if (el) {
          if (el.tagName === "INPUT" && (el.type || "").toLowerCase() === "checkbox") {
            return el.checked ? "כן" : "לא";
          }
          const v = (el.value || "").toString().trim();
          if (v) return v;
        }
        const t = norm(s.textContent);
        if (t) return t;
      }
    }
    return "—";
  }

  
// Fetch PerProject.Ajax.php (VOIP form fields like domain/account/partition may be loaded dynamically into divPerProject)
async function fetchVoipPerProjectAjax(cid, pid, checked) {
  const url = `${location.origin}/nihul/VoIP/PerProject.Ajax.php`;
  const body = new URLSearchParams({
    CompanyID: String(cid),
    ProjectID: String(pid ?? 0),
    Checked: checked ? "1" : "0",
  }).toString();

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body,
    credentials: "include",
  });

  if (!res.ok) throw new Error("PerProject.Ajax.php failed: " + res.status);
  return await res.text();
}

async function fetchVoipSettingsData(cid, pid) {
    const learned = getLearnedTemplate();
    const candidates = [];

    if (learned) candidates.push(buildUrlFromTemplate(learned, cid, pid));

    // Known/guessed endpoints (will try sequentially)
    const guesses = [
      (origin) => `${origin}/nihul/VoIP/Settings.php?CompanyID=${encodeURIComponent(cid)}&ProjectID=${encodeURIComponent(pid)}`,
      (origin) => `${origin}/nihul/VoIP/Settings5.php?CompanyID=${encodeURIComponent(cid)}&ProjectID=${encodeURIComponent(pid)}`,
      (origin) => `${origin}/nihul/VoIP/Settings2.php?CompanyID=${encodeURIComponent(cid)}&ProjectID=${encodeURIComponent(pid)}`,
      (origin) => `${origin}/nihul/VoIP/Settings.php?CompanyID=${encodeURIComponent(cid)}`,
      (origin) => `${origin}/nihul/VoIP/Settings5.php?CompanyID=${encodeURIComponent(cid)}`,
    ];
    for (const g of guesses) candidates.push(g(location.origin));

    let lastErr = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) { lastErr = new Error("VOIP fetch failed: " + res.status); continue; }
        
const text = await res.text();

// First: parse the Settings.php HTML itself (may contain only partial info)
const base = parseVoipFromText(text) || { domain: "—", account: "—", partition: "—" };

const hasVal = (v) => v && v !== "—" && String(v).trim() !== "" && v !== "-";
const needsMore = !(hasVal(base.domain) && hasVal(base.account) && hasVal(base.partition));

if (needsMore) {
  // In many BMBY pages, domain/account/partition are injected into #divPerProject by PerProject.Ajax.php (Prototype Ajax.Updater).
  // Since fetch() doesn't execute JS, we must fetch that fragment explicitly.
  try {
    const frag0 = await fetchVoipPerProjectAjax(cid, pid, false);
    const p0 = parseVoipFromText(frag0) || {};
    const frag1 = await fetchVoipPerProjectAjax(cid, pid, true);
    const p1 = parseVoipFromText(frag1) || {};

    // Choose the fragment that yields more meaningful values
    const score = (o) => ["domain", "account", "partition"].reduce((acc, k) => acc + (hasVal(o?.[k]) ? 1 : 0), 0);
    const best = score(p1) > score(p0) ? p1 : p0;

    const merged = {
      domain: hasVal(best.domain) ? best.domain : base.domain,
      account: hasVal(best.account) ? best.account : base.account,
      partition: hasVal(best.partition) ? best.partition : base.partition,
    };

    if (hasVal(merged.domain) || hasVal(merged.account) || hasVal(merged.partition)) {
      return { ...merged, url };
    }
  } catch (e) {
    // ignore perproject errors and fallback to base below
  }
}

if (hasVal(base.domain) || hasVal(base.account) || hasVal(base.partition)) {
  return { domain: base.domain, account: base.account, partition: base.partition, url };
}
} catch (e) {
        lastErr = e;
      }
    }
    if (lastErr) throw lastErr;
    throw new Error("VOIP fetch failed");
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch {
        return false;
      }
    }
  }

  async function runVoipSearch(pidInput) {
    const pid = normalizePid(pidInput);
    if (!pid) {
      toast("נא להזין מספר פרויקט תקין", "warn");
      return;
    }

    toast(`מחפש VOIP עבור P${pid}...`, "info");

    try {
      const cid = await fetchCompanyIdForPid(pid);

      if (!cid) {
        toast("לא נמצאה תוצאה ב-Wizard (CompanyID חסר).", "error");
        showResultPanel(pid, { "CompanyID": "—", "Domain": "—", "Account Code": "—", "Partition": "—", "Link": "—" }, false);
        return;
      }

      const data = await fetchVoipSettingsData(cid, pid);

      const allEmpty = [data.domain, data.account, data.partition].every((x) => !x || x === "—");
      if (allEmpty) {
        toast("לא הצלחתי לקבל נתוני VOIP. כנראה שהמערכת טוענת את זה דרך Ajax – לחץ 'בדוק VOIP מהמערכת' ואז פתח VOIP ידני פעם אחת.", "warn", 7000);
      }

      const copied = data.account && data.account !== "—" ? await copyToClipboard(data.account) : false;

        //  זה התיקון היחיד
        data.url = `${location.origin}/nihul/VoIP/Settings.php?CompanyID=${cid}&ProjectID=${pid}`;



      showResultPanel(pid, {
        "CompanyID": cid,
        "Domain": data.domain,
        "Account Code": data.account,
        "Partition": data.partition,
        "Link": data.url,
      }, copied);

      addHistory("voip", pid);
      toast(copied ? "✅ Account הועתק ללוח" : "⚠️ לא הצלחתי להעתיק ללוח", copied ? "ok" : "warn");
    } catch (err) {
      console.error(err);
      toast("שגיאה בחיפוש VOIP (רקע) – פרטים בקונסול.", "error");
    }
  }

  /*****************************************************************
   * Panels
   *****************************************************************/
  function renderVoipPanel() {
    const last = Store.get("voip_last", "");
    const hist = getHistory("voip");

    const histHtml =
      hist.length === 0
        ? `<div class="bmby-small">אין היסטוריה</div>`
        : `<div class="bmby-hist">${hist
            .map((h) => `<div class="bmby-chip" data-x="hist" data-v="${escapeHtml(h)}">P${escapeHtml(h)}</div>`)
            .join("")}</div>`;

    return `
      <div style="font:900 14px/1.2 var(--bmby-font);">חיפוש VOIP – תוצאה סופית בלבד</div>
      <div class="bmby-small">החיפוש עושה Fetch ל-Wizard ברקע → מוציא CompanyID → מנסה להביא נתוני VOIP. אם BMBY טוען VOIP דרך Ajax/JSON, צריך "למידה" פעם אחת (מבלי לפתוח ביניים בחיפוש).</div>

      <div class="bmby-card" style="margin-top:10px;">
        <div class="bmby-row" style="margin-top:0;">
          <button class="bmby-btn primary" data-x="run">חפש</button>
          <input class="bmby-input" data-x="pid" placeholder="מספר פרויקט (למשל 9681)" value="${escapeHtml(last)}" />
        </div>

        <div class="bmby-row">
          <button class="bmby-btn secondary" data-x="clear">נקה היסטוריה</button>
          <button class="bmby-btn secondary" data-x="learn">בדוק VOIP מהמערכת</button>
          <button class="bmby-btn secondary" data-x="unlearn">רענן</button>
        </div>
        <div class="bmby-small" data-x="learnStatus">קיצור: Ctrl+Shift+V</div>

        ${histHtml}

        <div class="bmby-result" data-x="result">
          <div class="bmby-small">כאן תופיע התוצאה.</div>
        </div>
      </div>
    `;
  }

  function bindVoipPanel(panel) {
    const input = panel.querySelector('[data-x="pid"]');
    const btn = panel.querySelector('[data-x="run"]');
    const clear = panel.querySelector('[data-x="clear"]');

    const doRun = () => {
      const pid = input.value;
      Store.set("voip_last", pid);
      runVoipSearch(pid);
      // refresh history list after run
      setTimeout(() => setActiveTab("voip"), 50);
    };

    btn.addEventListener("click", doRun);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doRun();
    });

    clear.addEventListener("click", () => {
      clearHistory("voip");
      setActiveTab("voip");
      toast("היסטוריה נוקתה", "ok");
    });

    const learnBtn = panel.querySelector('[data-x="learn"]');
    const unlearnBtn = panel.querySelector('[data-x="unlearn"]');
    const learnStatus = panel.querySelector('[data-x="learnStatus"]');

    function refreshLearnStatus() {
      const t = getLearnedTemplate();
      if (!learnStatus) return;
      if (t) learnStatus.textContent = "למידת VOIP: פעילה ✅ (נלמד אוטומטית מרשת – DEV)";
      else learnStatus.textContent = "למידת VOIP: לא קיימת. לחץ 'בדוק VOIP מהמערכת' ואז פתח VOIP ידני פעם אחת (למשל מתפריט BMBY) כדי שאאתר את ה-API.";
    }
    refreshLearnStatus();

    if (learnBtn) {
      learnBtn.addEventListener("click", () => {
        toast("פתח עכשיו VOIP ידני פעם אחת (Company כלשהו). אני מאזין לרשת ואשמור את מקור הנתונים.", "info", 6500);
        refreshLearnStatus();
      });
    }
    if (unlearnBtn) {
      unlearnBtn.addEventListener("click", () => {
        Store.del("voip_learn_template");
        Store.del("voip_learn_kind");
        Store.del("voip_learn_last");
        toast("לימוד VOIP אופס", "ok");
        refreshLearnStatus();
      });
    }

    panel.querySelectorAll('[data-x="hist"]').forEach((chip) => {
      chip.addEventListener("click", () => {
        const v = chip.getAttribute("data-v") || "";
        input.value = v.replace(/^P/i, "");
        Store.set("voip_last", input.value);
      });
    });
  }

  function showResultPanel(pid, kv, copied) {
    const dash = document.getElementById(UI.dashId);
    const el = dash?.querySelector('[data-x="result"]');
    if (!el) return;

    const rows = Object.entries(kv || {})
      .map(([k, v]) => {
        if (k === "Link" && v && v !== "—") {
          return `<div class="bmby-row"><span class="bmby-k">${escapeHtml(k)}:</span><a class="bmby-link" href="${escapeAttr(v)}" target="_blank" rel="noopener">פתיחה</a></div>`;
        }
        return `<div class="bmby-row"><span class="bmby-k">${escapeHtml(k)}:</span><span class="bmby-v">${escapeHtml(String(v))}</span></div>`;
      })
      .join("");

    el.innerHTML = `
      <div class="bmby-row"><span class="bmby-k">פרויקט:</span><span class="bmby-v">P${escapeHtml(String(pid))}</span></div>
      ${rows}
      <div class="bmby-row"><span class="bmby-k">העתקה:</span><span class="bmby-v">${copied ? "✅ Account הועתק" : "⚠️ לא הועתק"}</span></div>
    `;
  }

  

  /*****************************************************************
   * TAB: USERS (username -> Wizard companies(name+ID) -> company -> Users -> highlight)
   * - לא שובר שום פיצ'ר אחר
   * - הכפתור רק שומר מצב; ההרצה האוטומטית קורית לפי העמוד הנוכחי
   *****************************************************************/

  // Keys (DEV) – stored in Store (GM/local)
  const US = {
    active: 'users_active_v1',
    username: 'users_username_v1',
    mode: 'users_mode_v1', // 'single' | 'all'
    companies: 'users_companies_v1', // [{url,name,cid}]
    queue: 'users_queue_v1', // remaining companies
    cur: 'users_cur_v1', // {url,name,cid}
    log: 'users_log_v1',
    last: 'users_last_v1', // {ts, found, label}
    cache: 'users_cache_v1', // { [usernameLower]: {uid, ts} }
    status: 'users_status_v1', // tiny progress/status line
    runId: 'users_runid_v1' // started-run marker
  };

  function usReset(all = false) {
    Store.del(US.active);
    Store.del(US.mode);
    Store.del(US.queue);
    Store.del(US.cur);
    Store.del(US.companies);
    if (all) Store.del(US.username);
    Store.del(US.last);
    Store.del(US.status);
  }

  function usLogAppend(line) {
    // keep the log short so UI stays clean
    const cur = String(Store.get(US.log, '') || '');
    const lines = cur ? cur.split(/\n/) : [];
    lines.push(String(line || ''));
    const MAX = 40;
    const next = lines.slice(-MAX).join('\n');
    Store.set(US.log, next);

    // live update if panel open
    try {
      const dash = document.getElementById(UI.dashId);
      const panel = dash ? dash.querySelector('[data-x="panel"]') : null;
      const ta = panel ? panel.querySelector('[data-x="uslog"]') : null;
      if (ta) {
        ta.textContent = next;
        ta.scrollTop = ta.scrollHeight;
      }
    } catch {}
  }

  function usSetStatus(t) {
    Store.set(US.status, String(t || ''));
    try {
      const dash = document.getElementById(UI.dashId);
      const panel = dash?.querySelector('[data-x="panel"]');
      const st = panel?.querySelector('[data-x="usstatus"]');
      if (st) st.textContent = String(t || '');
    } catch {}
  }

  function usLogClear() {
    Store.set(US.log, '');
    usSetStatus('');
  }

  // ===== USERS: highlight helpers (no dependency on other features) =====
  function usEnsureHLStyle(){
    if (document.getElementById('bmby-users-hl-style')) return;
    const s = document.createElement('style');
    s.id = 'bmby-users-hl-style';
    s.textContent = `
      .bmbyUserHL{
        outline:4px solid rgba(0,255,140,.95) !important;
        box-shadow:0 0 0 6px rgba(0,255,140,.20) inset !important;
        background:rgba(0,255,140,.12) !important;
        position:relative !important;
      }
      .bmbyUserHL::after{
        content:'USER FOUND';
        position:absolute;
        top:-10px; left:8px;
        background:rgba(0,255,140,.95);
        color:#111;
        font-weight:900;
        font-size:11px;
        padding:2px 6px;
        border-radius:6px;
      }
    `;
    document.head.appendChild(s);
  }

  function usWipeHighlights(){
    document.querySelectorAll('.bmbyUserHL').forEach(n=>n.classList.remove('bmbyUserHL'));
  }

  function usFindBestRow(el){
    let cur = el;
    for (let i=0;i<40 && cur;i++){
      if ((cur.tagName||'').toLowerCase() === 'tr') return cur;
      cur = cur.parentElement;
    }
    return el;
  }

  function usHighlightElement(el,label){
    try{ usEnsureHLStyle(); }catch{}
    try{ usWipeHighlights(); }catch{}
    const tr = usFindBestRow(el);
    if (tr && tr.classList) tr.classList.add('bmbyUserHL');
    try{ tr.scrollIntoView({behavior:'smooth', block:'center'}); }catch{}
    if (label) usLogAppend('✅ צבוע: ' + label);
  }


  // reuse from userflow scripts
  function usSafeResolveUrl(raw, baseKind) {
    let u = String(raw || '').trim().replace(/&amp;/g, '&');
    while (u.startsWith('../')) u = u.slice(3);
    if (u.startsWith('./')) u = u.slice(2);
    if (!u || u === '[' || u.includes('[')) return null;

    if (u.startsWith('http')) return u;
    if (u.startsWith('/')) return location.origin + u;

    if (u.startsWith('preferences/')) return location.origin + '/' + u;
    if (u.startsWith('nihul/')) return location.origin + '/' + u;

    if (/^(Wizard\.php|AddProject2\.php)/i.test(u)) return location.origin + '/nihul/' + u;
    if (/^EditUser\.php/i.test(u)) return location.origin + '/preferences/' + u;
    if (/preferences\/EditUser\.php/i.test(u)) return location.origin + '/' + u;

    return baseKind === 'nihul' ? (location.origin + '/nihul/' + u) : (location.origin + '/' + u);
  }

  function usWipeUserHighlights(){
    try{ document.querySelectorAll('.bmbyUserHL').forEach(n=>n.classList.remove('bmbyUserHL')); }catch{}
  }

  function usFindBestRow(el){
    let cur = el;
    for (let i=0;i<40 && cur;i++){
      if ((cur.tagName||'').toLowerCase()==='tr') return cur;
      cur = cur.parentElement;
    }
    return el;
  }

  function usHighlightElement(el, label){
    usWipeUserHighlights();
    const tr = usFindBestRow(el);
    try{ tr.classList.add('bmbyUserHL'); }catch{}
    try{ tr.scrollIntoView({behavior:'smooth', block:'center'}); }catch{}
    if (label) usLogAppend('✅ צבוע: ' + label);
  }

  function usExtractCompanyLinksFromWizard() {
    const out = new Map();
    const els = Array.from(document.querySelectorAll('[onclick],[onClick],a[href]'));

    for (const el of els) {
      const oc = el.getAttribute('onclick') || el.getAttribute('onClick') || '';
      const href = el.getAttribute('href') || '';
      const src = `${oc} ${href}`;

      const m = src.match(/Wizard\.php\?[^"'\s)]+/i);
      if (!m) continue;

      const absUrl = usSafeResolveUrl(m[0], 'nihul');
      if (!absUrl) continue;

      const cid = (absUrl.match(/CompanyID=(\d+)/i) || [])[1] || '';

      const tr = el.closest('tr') || el.closest('TR');
      let name =
        (tr?.querySelector('b')?.textContent || '').trim() ||
        (el.querySelector('b')?.textContent || el.textContent || '').replace(/\s+/g, ' ').trim();

      name = name.replace(/\s+/g, ' ').trim();
      if (!name) name = cid ? `Company ${cid}` : 'Company';

      const label = cid ? `${name} (CompanyID=${cid})` : name;
      if (!out.has(absUrl)) out.set(absUrl, { url: absUrl, name: label, cid });
    }

    return Array.from(out.values());
  }

  function usGetFindedProjectsFromCompanyUrl() {
    const fp = (new URL(location.href).searchParams.get('FindedProjects') || '').trim();
    if (!fp) return [];
    return fp.split(',').map(x => x.trim()).filter(Boolean).map(x => x.replace(/[^\d]/g,'')).filter(Boolean);
  }

  function usGo(url) {
    if (!url) return;
    // שומרים שהדשבורד יפתח לבד בעמוד הבא
    Store.set('dash_open_on_load_v1', true);
    location.href = url;
  }

  function usOpenStartInNewTab(url) {
    if (!url) return false;
    try {
      const w = window.open(url, '_blank', 'noopener,noreferrer');
      return !!w;
    } catch (_) {
      return false;
    }
  }

  function usGoUsersDirect(projectId, companyId) {
    const url = `${location.origin}/nihul/AddProject2.php?ProjectID=${encodeURIComponent(projectId)}&CompanyID=${encodeURIComponent(companyId)}&BrokerageProject=no`;
    usGo(url);
  }

  function usCollectEditLinksOnUsersPage() {
    const candidates = [];
    const seen = new Set();
    const nodes = Array.from(document.querySelectorAll('a[href],a[onclick],a[onClick]'));

    for (const el of nodes) {
      const href = el.getAttribute('href') || '';
      const oc   = el.getAttribute('onclick') || el.getAttribute('onClick') || '';
      const src = `${href} ${oc}`;
      if (!src.includes('EditUser.php')) continue;

      const pick = (txt) => {
        const s = String(txt || '').replace(/&amp;/g,'&');
        const m = s.match(/openwindow\(\s*['"]([^'"]*EditUser\.php[^'"]*)['"]/i);
        if (m && m[1]) return usSafeResolveUrl(m[1], 'root');
        return null;
      };

      const url = pick(href) || pick(oc);
      if (!url) continue;

      const uid = (url.match(/UserID=(\d+)/i) || [])[1] || '';
      if (!uid) continue;

      const key = `${uid}|${url}`;
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({ el, url, uid });
    }

    return candidates;
  }

  // ===== USERS: fast scan via hidden iframes (reliable in BMBY; HTML fetch is often empty) =====

  // Speed boost: try `fetch()` the EditUser HTML first (no iframe rendering).
  // If BMBY returns an empty/blocked body for fetch, we automatically fall back to iframes.
  const US_FETCH_FIRST = true;
  const US_FETCH_TIMEOUT_MS = 3500;

  // UserFlow scan tuning
  const US_IFRAME_CONCURRENCY = 10;   // 6–10 recommended
  const US_IFRAME_TIMEOUT_MS  = 7500;
  const US_POST_LOAD_POLL_TRIES = 14;
  const US_POST_LOAD_POLL_MS    = 170;

  const usNorm = (s) => (s || '').toString().trim().toLowerCase();
  const usSleep = (ms) => new Promise(r => setTimeout(r, ms));

  function usMakeHiddenIframe(id) {
    const iframe = document.createElement('iframe');
    iframe.id = id;
    iframe.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:10px;height:10px;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);
    return iframe;
  }

  function usLoadIframe(iframe, url, timeoutMs) {
    return new Promise((resolve, reject) => {
      let done = false;
      const onLoad = () => {
        if (done) return;
        done = true;
        iframe.removeEventListener('load', onLoad);
        resolve();
      };
      iframe.addEventListener('load', onLoad);
      iframe.src = url;
      setTimeout(() => {
        if (done) return;
        done = true;
        iframe.removeEventListener('load', onLoad);
        reject(new Error('iframe timeout'));
      }, timeoutMs);
    });
  }

  function usStripTags(s) {
    return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function usExtractUsernameFromEditUserHtml(html) {
    const h = String(html || '');
    if (h.length < 200) return '';

    // Try to find the row where the label says Login/Username/שם משתמש, then grab the value <span>...</span>
    const rowRe = /<div[^>]*class="[^"]*wrappRow[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*(?:txt_template|wrappTxtCell)[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div[^>]*class="[^"]*wrappValCell[^"]*"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/gi;
    let m;
    while ((m = rowRe.exec(h))) {
      const label = usNorm(usStripTags(m[1]));
      if (!label) continue;
      const isLoginLabel =
        label.includes('login') ||
        label.includes('username') ||
        label.includes('user name') ||
        label.includes('שם משתמש') ||
        (label.includes('משתמש') && label.includes('שם'));
      if (!isLoginLabel) continue;
      const val = usNorm(usStripTags(m[2]));
      if (val) return val;
    }

    // Fallback: if there is exactly one username-like value inside wrappValCell spans
    const spanRe = /class="[^"]*wrappValCell[^"]*"[\s\S]*?<span[^>]*>([^<]{2,60})<\/span>/gi;
    const vals = [];
    let s;
    while ((s = spanRe.exec(h))) {
      const v = usNorm(s[1]);
      if (!v) continue;
      if (/^[a-z0-9._-]{2,40}$/i.test(v)) vals.push(v);
      if (vals.length > 2) break;
    }
    if (vals.length === 1) return vals[0];
    return '';
  }

  async function usFetchUsernameFromEditUserUrl(url, abortSet) {
    const ctrl = new AbortController();
    if (abortSet) abortSet.add(ctrl);
    const t = setTimeout(() => {
      try { ctrl.abort('timeout'); } catch (_) {}
    }, US_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        signal: ctrl.signal,
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      if (!res || !res.ok) return '';
      const html = await res.text();
      return usExtractUsernameFromEditUserHtml(html);
    } catch {
      return '';
    } finally {
      clearTimeout(t);
      if (abortSet) abortSet.delete(ctrl);
    }
  }

  function usExtractUsernameFromEditUserDoc(doc) {
    if (!doc) return '';

    const rows = Array.from(doc.querySelectorAll('.wrappRow'));
    for (const row of rows) {
      const labelEl = row.querySelector('.txt_template, .wrappTxtCell, .label, .title, b');
      const valEl   = row.querySelector('.wrappValCell span, .wrappValCell, .value, .val');

      const label = usNorm(labelEl?.textContent || '');
      if (!label) continue;

      const isLoginLabel =
        label.includes('login') ||
        label.includes('username') ||
        label.includes('user name') ||
        label.includes('שם משתמש') ||
        (label.includes('משתמש') && label.includes('שם'));

      if (!isLoginLabel) continue;

      const val = usNorm(valEl?.textContent || '');
      if (val) return val;
    }

    // fallback: exactly one username-like value
    const spans = Array.from(doc.querySelectorAll('.wrappValCell span'));
    const cleaned = spans.map(s => usNorm(s.textContent || '')).filter(Boolean);
    const looks = cleaned.filter(v => /^[a-z0-9._-]{2,40}$/i.test(v));
    if (looks.length == 1) return looks[0];

    return '';
  }

  async function usScanUsersAndHighlightFast() {
    const targetUsername = String(Store.get(US.username, '') || '').trim();
    if (!targetUsername) { usLogAppend('❌ אין username שמור.'); return { found:false }; }

    const isActive = () => !!Store.get(US.active, false);
    if (!isActive()) return { found:false };

    await usSleep(220);

    // abort helpers for fast stop when found / navigation
    const abortSet = new Set();
    const abortAll = () => {
      for (const c of Array.from(abortSet)) {
        try { c.abort('found'); } catch (_) {}
      }
      abortSet.clear();
    };

    const items = usCollectEditLinksOnUsersPage();

    // ⚡ Fast path: אם כבר למדנו UserID ל-username הזה בעבר – צובעים מיד בלי iframes
    try{
      const cache = Store.get(US.cache, {}) || {};
      const cached = cache[usNorm(targetUsername)];
      if (cached && cached.uid) {
        const hit = items.find(it => String(it.uid) === String(cached.uid));
        if (hit) {
          const label = `username=${targetUsername} | UserID=${hit.uid} (cache)`;
          usLogAppend(`⚡ נמצא מהקאש: ${label}`);
          usHighlightElement(hit.el, label);
          Store.set(US.last, { ts: Date.now(), found: true, label });
          usSetStatus('');
          Store.del(US.active);
          return { found:true };
        }
      }
    }catch{}

    if (!items.length) {
      usSetStatus('אין לינקים של "עריכה" בדף');
      Store.del(US.active);
      return { found:false };
    }

    const target = usNorm(targetUsername);
    let idx = 0;
    let found = false;
    let foundItem = null;

    const poolSize = Math.min(US_IFRAME_CONCURRENCY, items.length);
    const pool = Array.from({length: poolSize}, (_, i) => usMakeHiddenIframe(`bmbyUsHidden_${Date.now()}_${i}`));

    let scanned = 0;
    usSetStatus(`סריקה: 0/${items.length}`);

    const worker = async (iframe) => {
      while (!found && isActive()) {
        const my = idx++;
        if (my >= items.length) return;
        const it = items[my];

        scanned++;
        if (scanned === 1 || (scanned % 6 === 0) || scanned === items.length) {
          usSetStatus(`סריקה: ${Math.min(scanned, items.length)}/${items.length}`);
        }

        try {
          // 1) Fast path: fetch HTML (no iframe rendering)
          if (US_FETCH_FIRST) {
            const seenFetch = await usFetchUsernameFromEditUserUrl(it.url, abortSet);
            if (seenFetch) {
              if (seenFetch === target) {
                found = true;
                foundItem = it;
                // stop everyone else immediately
                try { Store.del(US.active); } catch (_) {}
                abortAll();
                return;
              }
              // got a definitive username from HTML and it's not ours → skip iframe
              continue;
            }
          }

          // 2) Fallback: iframe DOM
          await usLoadIframe(iframe, it.url, US_IFRAME_TIMEOUT_MS);

          // EditUser sometimes fills late – poll
          for (let t = 0; t < US_POST_LOAD_POLL_TRIES && !found && isActive(); t++) {
            const doc = iframe.contentDocument;
            if (!doc || !doc.documentElement || !doc.body || !doc.body.innerText) {
              await usSleep(US_POST_LOAD_POLL_MS);
              continue;
            }
            const seen = usExtractUsernameFromEditUserDoc(doc);
            if (seen && seen === target) {
              found = true;
              foundItem = it;
              // stop everyone else immediately
              try { Store.del(US.active); } catch (_) {}
              abortAll();
              return;
            }
            await usSleep(US_POST_LOAD_POLL_MS);
          }
        } catch (_) {
        }
      }
    };

    await Promise.allSettled(pool.map(worker));
    abortAll();
    pool.forEach(fr => {
      try { fr.src = 'about:blank'; } catch (_) {}
      try { if (fr && fr.remove) fr.remove(); } catch (_) {}
    });

    // if we already cleared active because we found the user, continue to paint.

    if (found && foundItem) {
      const label = `username=${targetUsername} | UserID=${foundItem.uid}`;
      usLogAppend(`✅ נמצא! ${label}`);
      try {
        const cache = Store.get(US.cache, {}) || {};
        cache[target] = { uid: foundItem.uid, ts: Date.now() };
        Store.set(US.cache, cache);
      } catch {}
      usHighlightElement(foundItem.el, label);
      // hide dashboard so the highlight is visible immediately
      try { closeDashboard(); } catch {}
      try { toast('✅ מצאתי וסימנתי בעמוד. סגרתי את הדשבורד כדי שתראה את הצביעה.', true); } catch {}
      Store.set(US.last, { ts: Date.now(), found: true, label });
      usSetStatus('');
      // active may already be cleared above; ensure it's cleared.
      try { Store.del(US.active); } catch (_) {}
      return { found:true };
    }

    usSetStatus('');
    usLogAppend('❌ לא נמצא בפרויקט הזה.');
    Store.set(US.last, { ts: Date.now(), found: false, label: '' });
    return { found:false };
  }

  function renderUsersPanel() {
    const u = String(Store.get(US.username, '') || '');
    const mode = String(Store.get(US.mode, 'single') || 'single');
    const logText = String(Store.get(US.log, '') || 'מוכן.');
    const companies = Store.get(US.companies, []) || [];
    const active = !!Store.get(US.active, false);

    const listHtml = (mode === 'single' && companies.length)
      ? `<div class="bmby-small" style="margin-top:12px;">בחר חברה (שם + CompanyID):</div>
         <div style="display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:10px; margin-top:8px;">
           ${companies.map((c,i)=>
             `<button class="bmby-chip" data-x="usPick" data-i="${i}" style="cursor:pointer; padding:12px 12px; text-align:right; border:1px solid rgba(0,0,0,.08); background:#fff; border-radius:12px; box-shadow:0 6px 18px rgba(0,0,0,.05);">
                <div style="font-weight:900;">${escapeHtml(c.name)}</div>
                <div class="bmby-small" style="opacity:.8; margin-top:4px;">CompanyID=${escapeHtml(String(c.cid||''))}</div>
              </button>`
           ).join('')}
         </div>`
      : '';

    return `
      <div style="font:900 14px/1.2 var(--bmby-font);">חיפוש משתמש (Username → חברות → משתמשים → צביעה)</div>
      <div class="bmby-small">הכפתור רק מפעיל מצב. ההרצה קורית אוטומטית לפי העמוד שאתה נמצא בו (Wizard/חברה/משתמשים) – בלי לשבור טאביים אחרים.</div>

      <div class="bmby-card" style="margin-top:10px;">
        <div class="bmby-row" style="margin-top:0;">
          <button class="bmby-btn primary" data-x="usStart">Start</button>
          <button class="bmby-btn secondary" data-x="usAll">Scan ALL</button>
          <input class="bmby-input" data-x="usUser" placeholder="username (e.g. nirchen)" value="${escapeHtml(u)}" />
        </div>
        <div class="bmby-row">
          <button class="bmby-btn secondary" data-x="usStop">Stop</button>
          <button class="bmby-btn secondary" data-x="usClear">Clear</button>
          <div class="bmby-small" style="margin-right:auto;">מצב: ${active ? 'רץ…' : 'מוכן'} | mode: ${escapeHtml(mode)}</div>
        </div>

        ${listHtml}

        <div class="bmby-small" style="margin-top:10px; display:flex; align-items:center; gap:10px;">
          <span style="font-weight:900;">סטטוס:</span>
          <span data-x="usstatus" style="opacity:.9;">${escapeHtml(String(Store.get(US.status,'')||''))}</span>
        </div>
        <div class="bmby-result" style="margin-top:8px; max-height:190px; overflow:auto;" data-x="uslog">${escapeHtml(logText)}</div>
      </div>
    `;
  }

  function bindUsersPanel(panel) {
    const inp = panel.querySelector('[data-x="usUser"]');
    const btnStart = panel.querySelector('[data-x="usStart"]');
    const btnAll = panel.querySelector('[data-x="usAll"]');
    const btnStop = panel.querySelector('[data-x="usStop"]');
    const btnClear = panel.querySelector('[data-x="usClear"]');

    const doStart = (mode) => {
      const u = String(inp.value || '').trim();
      if (!u) return toast('תכתוב username', 'err');

      Store.set(US.username, u);
      Store.set(US.mode, mode);
      Store.set(US.active, true);
      Store.del(US.queue);
      Store.del(US.cur);
      Store.del(US.companies);
      usLogClear();
      usSetStatus('פותח חיפוש חברות…');
      Store.set(US.runId, Date.now());

      const startUrl = `${location.origin}/nihul/Wizard.php?q=${encodeURIComponent(u)}&x=11&y=14`;
      Store.set('dash_open_on_load_v1', true);
      usGo(startUrl);
    };

    btnStart?.addEventListener('click', () => doStart('single'));
    btnAll?.addEventListener('click', () => doStart('all'));

    inp?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doStart(String(Store.get(US.mode,'single')||'single'));
    });

    btnStop?.addEventListener('click', () => {
      Store.del(US.active);
      toast('נעצר', 'ok');
    });

    btnClear?.addEventListener('click', () => {
      usReset(true);
      usLogClear();
      toast('נוקה', 'ok');
      setActiveTab('users');
    });

    panel.querySelectorAll('[data-x="usPick"]').forEach((b) => {
      b.addEventListener('click', () => {
        const i = Number(b.getAttribute('data-i') || '0');
        const companies = Store.get(US.companies, []) || [];
        const c = companies[i];
        if (!c) return;
        Store.set(US.cur, c);
        Store.set(US.active, true);
        usLogClear();
        usSetStatus('פותח פרויקטים בחברה…');
        Store.set('dash_open_on_load_v1', true);
        usGo(c.url);
      });
    });
  }

  async function runUsersFlowIfNeeded() {
    const active = !!Store.get(US.active, false);
    if (!active) return;

    // פתיחה אוטומטית של הדשבורד אחרי ניווט
    if (Store.get('dash_open_on_load_v1', false)) {
      Store.del('dash_open_on_load_v1');
      openDashboard();
      setActiveTab('users');
    }

    const url = new URL(location.href);
    const path = location.pathname;

    const isWizardSearch = /\/nihul\/Wizard\.php$/i.test(path) && url.searchParams.has('q') && !url.searchParams.has('CompanyID');
    const isCompanyPage  = /\/nihul\/Wizard\.php$/i.test(path) && url.searchParams.has('CompanyID');
    const isUsersPage    = /\/nihul\/AddProject2\.php$/i.test(path) && url.searchParams.has('ProjectID');

    await sleep(250);

    if (isWizardSearch) {
      const mode = String(Store.get(US.mode, 'single') || 'single');
      const companies = usExtractCompanyLinksFromWizard();
      Store.set(US.companies, companies);
      usLogClear();
      usSetStatus(`נמצאו ${companies.length} חברות`);

      if (!companies.length) {
        toast('לא נמצאו חברות', 'err');
        Store.del(US.active);
        return;
      }

      if (companies.length === 1) {
        Store.set(US.cur, companies[0]);
        usSetStatus('פותח חברה…');
        Store.set('dash_open_on_load_v1', true);
        usGo(companies[0].url);
        return;
      }

      if (mode === 'all') {
        Store.set(US.cur, companies[0]);
        Store.set(US.queue, companies.slice(1));
        usSetStatus('סורק חברות…');
        Store.set('dash_open_on_load_v1', true);
        usGo(companies[0].url);
        return;
      }

      // single: רק מציג ברשימה בתוך הדשבורד
      openDashboard();
      setActiveTab('users');
      return;
    }

    if (isCompanyPage) {
      const cur = Store.get(US.cur, null) || {};
      const cid = cur.cid || url.searchParams.get('CompanyID') || '';
      const pids = usGetFindedProjectsFromCompanyUrl();
      usSetStatus(`חברה ${cid}: ${pids.length ? 'פותח משתמשים…' : 'אין פרויקטים'}`);

      if (!pids.length) {
        const mode = String(Store.get(US.mode, 'single') || 'single');
        if (mode === 'all') {
          const q = Store.get(US.queue, []) || [];
          const next = q.shift();
          Store.set(US.queue, q);
          if (next) {
            Store.set(US.cur, next);
            usSetStatus('חברה הבאה…');
            Store.set("dash_open_on_load_v1", true);
            usGo(next.url);
          } else {
            usSetStatus('נגמרו חברות');
            Store.del(US.active);
          }
        }
        return;
      }

      usSetStatus('פותח מסך משתמשים…');
      Store.set('dash_open_on_load_v1', true);
      usGoUsersDirect(pids[0], cid);
      return;
    }

    if (isUsersPage) {
      const mode = String(Store.get(US.mode, 'single') || 'single');
      const { found } = await usScanUsersAndHighlightFast();
      if (found) return;

      if (mode === 'all') {
        const q = Store.get(US.queue, []) || [];
        const next = q.shift();
          Store.set(US.queue, q);
          if (next) {
            Store.set(US.cur, next);
            usSetStatus('חברה הבאה…');
            Store.set("dash_open_on_load_v1", true);
            usGo(next.url);
          } else {
            usSetStatus('נגמרו חברות');
            Store.del(US.active);
          }
      }
      return;
    }
  }

/*****************************************************************
   * Hotkey: Ctrl+Shift+V
   *****************************************************************/
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "V" || e.key === "v")) {
        e.preventDefault();
        openDashboard();
        setActiveTab("voip");
        const dash = document.getElementById(UI.dashId);
        dash?.querySelector('[data-x="pid"]')?.focus();
      }
    },
    true
  );

  /*****************************************************************
   * Boot
   *****************************************************************/
  injectCSS();
  runPasswordHighlightIfNeeded();
  ensureButton();
  highlightPasswordOnGridRemoteSite();
  try { runUsersFlowIfNeeded(); } catch(e){ log("users flow failed", e); }
})();


// === PATCH: Add Interfaces Page Link in Password Tab (DEV 12.3+) ===
(function(){
  function addInterfacesLink(){
    const pidInput = document.querySelector('#bmby-t3-pid');
    const card = pidInput?.closest('.bmby-card');
    if(!pidInput || !card) return;

    if(card.querySelector('#bmby-t3-open-interfaces')) return;

    const btn = document.createElement('button');
    btn.id = 'bmby-t3-open-interfaces';
    btn.textContent = 'פתח דף ממשקים';
    btn.style.cssText = 'margin-top:8px;padding:8px 10px;border-radius:10px;border:0;cursor:pointer;font-weight:900;background:#fff;color:#111';
    btn.onclick = () => {
      const v = (pidInput.value||'').trim();
      if(!v) return alert('הכנס מספר פרויקט');
      const id = String(v).replace(/^P/i,'');
      const pw = (document.querySelector('#bmby-t3-pw')?.value||'').trim();
      if(pw) savePwHighlight('P'+id, pw);
      const url = location.origin + '/nihul/GridRemoteSite.php?ProjectID=' + encodeURIComponent(id);
      window.open(url,'_blank','noopener,noreferrer');
    };

    card.appendChild(btn);
  }

  const obs = new MutationObserver(addInterfacesLink);
  obs.observe(document.body,{childList:true,subtree:true});
  addInterfacesLink();
})();
