// ==UserScript==
// @name         BMBY – Link Telephony Dashboard (DEV)
// @namespace    bmby-link-telephony-dashboard-dev
// @version      0.1.0-dev.1
// @description  DEV: Dashboard עם טאבים בעברית + 3 כלים. VOIP מציג תוצאה סופית בלבד (בלי פתיחת מסכי ביניים) באמצעות fetch. היסטוריות פר-כלי. גרירה לכפתור ולדשבורד.
// @match        https://bmby.com/nihul/*
// @match        https://www.bmby.com/nihul/*
// @match        https://bmby.com/*
// @match        https://www.bmby.com/*
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// ==/UserScript==

(() => {
  "use strict";

  /***********************
   * Storage (GM preferred)
   ***********************/
  const HasGM = typeof GM_getValue === "function" && typeof GM_setValue === "function";
  const Store = {
    getItem(k) {
      try { return HasGM ? GM_getValue(k, null) : localStorage.getItem(k); } catch { return null; }
    },
    setItem(k, v) {
      try { return HasGM ? GM_setValue(k, v) : localStorage.setItem(k, v); } catch {}
    },
    removeItem(k) {
      try { return HasGM ? GM_deleteValue(k) : localStorage.removeItem(k); } catch {}
    }
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /***********************
   * Keys / constants
   ***********************/
  const DASH_BTN_ID = "bmby-dash-btn";
  const DASH_ID = "bmby-dash";
  const DASH_HDR_ID = "bmby-dash-hdr";
  const DASH_BACKDROP_ID = "bmby-dash-backdrop";

  const POS_BTN_KEY = "bmby_dash_btn_pos_v2_dev";
  const POS_DASH_KEY = "bmby_dash_pos_v2_dev";

  const HIST_MAX = 10;
  const HIST_KEYS = {
    voip: "bmby_hist_voip_v2_dev",
    ext:  "bmby_hist_ext_v2_dev",
    pw:   "bmby_hist_pw_v2_dev",
  };

  const PW_STORAGE_KEY = "bmby_pw_req_v43_dev";

  const VOIP_SETTINGS_PATH = "/nihul/VoIP/Settings.php";
  const WIZARD_PATH = "/nihul/Wizard.php";
  const INTERFACES_URL_TEMPLATE = "/nihul/GridRemoteSite.php?ProjectID={id}";
  const VOIP_EXT_POST_PATH = "/nihul/VoIP/SettingsExt.php";

  const DEV_BADGE_KEY = "bmby_dev_badge_on_v1";
  const COMPACT_KEY = "bmby_dash_compact_v1";

  /***********************
   * UI helpers
   ***********************/
  const toast = (msg, ok = true) => {
    const d = document.createElement("div");
    d.textContent = msg;
    d.style.cssText = `
      position:fixed;left:16px;bottom:16px;z-index:2147483647;
      background:${ok ? "rgba(0,140,60,0.92)" : "rgba(180,40,40,0.92)"};
      color:#fff;padding:10px 14px;border-radius:10px;
      font:13px Arial;box-shadow:0 10px 30px rgba(0,0,0,.35);
      max-width:520px
    `;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 3000);
  };

  const copyToClipboard = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
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
      } catch { return false; }
    }
  };

  function normalizeProjectId(v) {
    const s = String(v || "").trim().toUpperCase();
    if (/^P\d+$/.test(s)) return s;
    if (/^\d+$/.test(s)) return "P" + s;
    return null;
  }
  const projectNum = (p) => String(p).replace(/^P/i, "");

  function fmtTime(ts) {
    if (!ts || !Number.isFinite(Number(ts))) return "—";
    const d = new Date(Number(ts));
    if (String(d) === "Invalid Date") return "—";
    return d.toLocaleString("he-IL", { hour12: false });
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /***********************
   * History (per feature)
   ***********************/
  function normalizeHistoryArray(raw) {
    const out = [];
    if (!Array.isArray(raw)) return out;

    for (const item of raw) {
      if (typeof item === "string") {
        out.push({ value: item, ts: Date.now() });
      } else if (item && typeof item === "object") {
        const value = item.value ?? item.v ?? item.pid ?? item.ext ?? item.pw;
        const ts = item.ts ?? item.t ?? item.time ?? item.date;
        if (value != null) out.push({ value: String(value), ts: Number(ts) || Date.now() });
      }
    }
    return out;
  }

  function pushHistory(type, value) {
    const key = HIST_KEYS[type];
    if (!key) return;
    try {
      const raw = Store.getItem(key);
      const arr = normalizeHistoryArray(raw ? JSON.parse(raw) : []);
      const e = { value: String(value), ts: Date.now() };
      const next = [e, ...arr.filter(x => String(x.value) !== String(e.value))].slice(0, HIST_MAX);
      Store.setItem(key, JSON.stringify(next));
    } catch {}
  }

  function getHistory(type) {
    const key = HIST_KEYS[type];
    if (!key) return [];
    try {
      const raw = Store.getItem(key);
      const arr = normalizeHistoryArray(raw ? JSON.parse(raw) : []);
      Store.setItem(key, JSON.stringify(arr.slice(0, HIST_MAX)));
      return arr.slice(0, HIST_MAX);
    } catch { return []; }
  }

  function clearAllHistory() {
    Object.values(HIST_KEYS).forEach(k => Store.removeItem(k));
  }

  /***********************
   * Draggable (fixed)
   ***********************/
  function makeDraggableFixed(el, handle, posKey, {
    zIndex = 2147483646,
    allowInteractive = false,
    ignoreSelector = null
  } = {}) {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    const loadPos = () => {
      try { const raw = Store.getItem(posKey); return raw ? JSON.parse(raw) : null; } catch { return null; }
    };
    const savePos = (pos) => {
      try { Store.setItem(posKey, JSON.stringify(pos)); } catch {}
    };

    el.style.setProperty("position", "fixed", "important");
    el.style.setProperty("z-index", String(zIndex), "important");
    el.style.userSelect = "none";
    el.style.touchAction = "none";

    const saved = loadPos();
    if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
      el.style.setProperty("left", `${saved.x}px`, "important");
      el.style.setProperty("top", `${saved.y}px`, "important");
      el.style.setProperty("right", "auto", "important");
      el.style.setProperty("bottom", "auto", "important");
      el.style.transform = "";
    }

    const dragHandle = handle || el;
    dragHandle.style.cursor = "grab";
    dragHandle.style.userSelect = "none";
    dragHandle.style.touchAction = "none";

    let dragging = false;
    let moved = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    let pointerId = null;

    const onDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (ignoreSelector && e.target?.closest?.(ignoreSelector)) return;

      if (!allowInteractive) {
        const t = e.target;
        if (t && (t.closest?.("button, input, textarea, select, a") || t.isContentEditable)) return;
      }

      dragging = true;
      moved = false;
      pointerId = e.pointerId;

      const rect = el.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      dragHandle.style.cursor = "grabbing";

      el.style.setProperty("left", `${rect.left}px`, "important");
      el.style.setProperty("top", `${rect.top}px`, "important");
      el.style.setProperty("right", "auto", "important");
      el.style.setProperty("bottom", "auto", "important");
      el.style.transform = "";

      e.preventDefault();
      e.stopPropagation();
      try { dragHandle.setPointerCapture(pointerId); } catch {}

      document.addEventListener("pointermove", onMove, true);
      document.addEventListener("pointerup", onUp, true);
      document.addEventListener("pointercancel", onUp, true);
    };

    const onMove = (e) => {
      if (!dragging) return;
      if (pointerId !== null && e.pointerId !== pointerId) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > 6) moved = true;

      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const maxX = window.innerWidth - w - 6;
      const maxY = window.innerHeight - h - 6;

      const x = clamp(startLeft + dx, 6, maxX);
      const y = clamp(startTop + dy, 6, maxY);

      el.style.setProperty("left", `${x}px`, "important");
      el.style.setProperty("top", `${y}px`, "important");

      e.preventDefault();
      e.stopPropagation();
    };

    const onUp = (e) => {
      if (!dragging) return;
      if (pointerId !== null && e.pointerId !== pointerId) return;

      dragging = false;
      dragHandle.style.cursor = "grab";

      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);

      const rect = el.getBoundingClientRect();
      savePos({ x: Math.round(rect.left), y: Math.round(rect.top) });

      pointerId = null;

      e.preventDefault();
      e.stopPropagation();
    };

    dragHandle.addEventListener("pointerdown", onDown, true);

    el.addEventListener("click", (e) => {
      if (moved) {
        e.preventDefault();
        e.stopImmediatePropagation();
        moved = false;
      }
    }, true);
  }

  function hasSavedPos(key) {
    try {
      const raw = Store.getItem(key);
      if (!raw) return false;
      const obj = JSON.parse(raw);
      return obj && typeof obj.x === "number" && typeof obj.y === "number";
    } catch { return false; }
  }

  /***********************
   * Styles
   ***********************/
  function ensureStyles() {
    if (document.getElementById("bmby-dash-style-dev")) return;
    const s = document.createElement("style");
    s.id = "bmby-dash-style-dev";
    s.textContent = `
      :root.bmby-dev-outline { outline:4px solid orange; outline-offset:-4px; }
      #${DASH_BTN_ID}{
        position:fixed;right:16px;bottom:16px;
        border:0;border-radius:999px;
        padding:12px 16px;
        background:#111;color:#fff;
        font:14px Arial;font-weight:800;
        box-shadow:0 10px 30px rgba(0,0,0,.35);
        cursor:pointer;
        z-index:2147483647;
        user-select:none;
        touch-action:none;
      }
      #${DASH_BTN_ID}.dev{ background:#ff8a00;color:#111; }

      #${DASH_BACKDROP_ID}{
        position:fixed;inset:0;
        background:rgba(0,0,0,.25);
        z-index:2147483645;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:16px;
      }

      #${DASH_ID}{
        width:520px;
        max-width:94vw;
        background:#111;
        color:#fff;
        border-radius:14px;
        box-shadow:0 16px 45px rgba(0,0,0,.45);
        overflow:hidden;
        font:13px Arial;
      }

      #${DASH_ID}.compact .bmby-card{ padding:8px; }
      #${DASH_ID}.compact .bmby-card .desc{ display:none; }
      #${DASH_ID}.compact .bmby-mini{ display:none; }
      #${DASH_ID}.compact .bmby-row{ margin-top:8px; }

      #${DASH_HDR_ID}{
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:10px 12px;
        background:rgba(255,255,255,.06);
        border-bottom:1px solid rgba(255,255,255,.08);
        user-select:none;
        touch-action:none;
        cursor:grab;
        gap:10px;
      }

      .bmby-dash-title{
        font-weight:900;
        letter-spacing:.2px;
        user-select:none;
        touch-action:none;
        white-space:nowrap;
      }

      .bmby-dash-actions{ display:flex;gap:8px;align-items:center; flex:0 0 auto; }

      .bmby-dash-iconbtn{
        border:0;
        background:rgba(255,255,255,.10);
        color:#fff;
        padding:8px 10px;
        border-radius:10px;
        cursor:pointer;
        font-weight:800;
      }
      .bmby-dash-iconbtn:hover{ background:rgba(255,255,255,.16); }

      .bmby-tabs{
        display:flex;
        gap:6px;
        flex:1 1 auto;
        align-items:center;
        overflow:auto;
        padding:4px 2px;
      }
      .bmby-tab{
        border:0;
        border-radius:999px;
        padding:7px 10px;
        font-weight:900;
        cursor:pointer;
        background:rgba(255,255,255,.08);
        color:#fff;
        white-space:nowrap;
      }
      .bmby-tab.active{ background:#fff; color:#111; }
      .bmby-search{
        flex:0 0 160px;
        max-width:30vw;
        padding:7px 10px;
        border-radius:999px;
        border:0;
        outline:none;
        font-size:13px;
      }

      .bmby-dash-body{ padding:12px; display:flex; flex-direction:column; gap:10px; }

      .bmby-card{
        background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.08);
        border-radius:12px;
        padding:10px;
      }

      .bmby-card .hdr{
        display:flex; align-items:center; justify-content:space-between;
        gap:10px;
        margin-bottom:6px;
      }
      .bmby-card .name{ font-weight:900; }
      .bmby-card .desc{ opacity:.82; font-size:12px; margin-top:2px; }

      .bmby-row{ display:flex; gap:8px; margin-top:10px; }
      .bmby-row input{
        flex:1; width:100%;
        padding:9px 10px;
        border-radius:10px;
        border:0;
        outline:none;
        font-size:13px;
      }
      .bmby-row button{
        padding:9px 10px;
        border-radius:10px;
        border:0;
        cursor:pointer;
        font-weight:900;
        background:#fff;
        color:#111;
        min-width:110px;
      }

      .bmby-mini{ opacity:.78;font-size:12px; margin-top:6px; line-height:1.35; }

      .bmby-history{
        max-height:120px;
        overflow:auto;
        margin-top:8px;
        border-radius:10px;
        border:1px solid rgba(255,255,255,.08);
      }
      .bmby-history .item{
        padding:8px 10px;
        border-bottom:1px solid rgba(255,255,255,.06);
        display:flex;
        justify-content:space-between;
        gap:10px;
        cursor:pointer;
      }
      .bmby-history .item:last-child{ border-bottom:0; }
      .bmby-history .item:hover{ background:rgba(255,255,255,.06); }
      .bmby-history .item .v{ opacity:.88; font-size:12px; }
      .bmby-history .item .time{ opacity:.6; font-size:11px; white-space:nowrap; }

      .bmby-overlay{
        position:fixed; inset:0;
        background:rgba(0,0,0,.35);
        z-index:2147483646;
        display:none;
        align-items:center;
        justify-content:center;
        padding:16px;
      }
      .bmby-overlay .box{
        background:#111;
        color:#fff;
        border-radius:14px;
        padding:14px 16px;
        box-shadow:0 16px 45px rgba(0,0,0,.45);
        width:420px;
        max-width:92vw;
        border:1px solid rgba(255,255,255,.10);
      }
      .bmby-overlay .ttl{ font-weight:900; font-size:14px; margin-bottom:6px; }
      .bmby-overlay .sub{ opacity:.85; white-space:pre-line; line-height:1.35; }
    `;
    document.head.appendChild(s);
  }

  /***********************
   * DEV visual badge (toggle)
   ***********************/
  function isDevBadgeOn() {
    const v = Store.getItem(DEV_BADGE_KEY);
    return v === null ? "1" : String(v) === "1"; // default ON in DEV
  }
  function setDevBadgeOn(on) {
    Store.setItem(DEV_BADGE_KEY, on ? "1" : "0");
    applyDevVisual();
  }
  function applyDevVisual() {
    ensureStyles();
    const on = isDevBadgeOn();
    document.documentElement.classList.toggle("bmby-dev-outline", on);
    const btn = document.getElementById(DASH_BTN_ID);
    if (btn) btn.classList.toggle("dev", on);
  }

  function isCompact() {
    return String(Store.getItem(COMPACT_KEY) || "0") === "1";
  }
  function setCompact(on) {
    Store.setItem(COMPACT_KEY, on ? "1" : "0");
    const panel = document.getElementById(DASH_ID);
    if (panel) panel.classList.toggle("compact", on);
  }

  /***********************
   * Overlay (for silent VOIP flow)
   ***********************/
  const overlay = (() => {
    let root, titleEl, subEl;
    const ensure = () => {
      if (root) return;
      root = document.createElement("div");
      root.className = "bmby-overlay";
      root.innerHTML = `
        <div class="box">
          <div class="ttl" id="bmby-ov-ttl">מחפש…</div>
          <div class="sub" id="bmby-ov-sub"></div>
        </div>
      `;
      document.body.appendChild(root);
      titleEl = root.querySelector("#bmby-ov-ttl");
      subEl = root.querySelector("#bmby-ov-sub");
    };
    const show = (ttl, sub="") => {
      ensure();
      titleEl.textContent = ttl || "מחפש…";
      subEl.textContent = sub || "";
      root.style.display = "flex";
    };
    const update = (sub="") => {
      if (!root) return;
      subEl.textContent = sub || "";
    };
    const hide = () => { if (root) root.style.display = "none"; };
    return { show, update, hide };
  })();

  /***********************
   * TOOL 1: VOIP (silent)
   * Goal: show final result only, no tabs, no intermediate navigation
   ***********************/
  function domFromHtml(html) {
    const p = new DOMParser();
    return p.parseFromString(String(html || ""), "text/html");
  }

  function getByLabelFromDoc(doc, label) {
    const want = (label || "").trim().toLowerCase();
    const tds = [...doc.querySelectorAll("td")];
    for (let i = 0; i < tds.length; i++) {
      const t = (tds[i].innerText || tds[i].textContent || "").trim().toLowerCase();
      if (t === want) {
        const next = tds[i + 1];
        const el = next?.querySelector("input,select,textarea");
        // Sometimes values are plain text, not inputs
        const text = (next?.innerText || next?.textContent || "").trim();
        return el?.value || text || "—";
      }
    }
    return "—";
  }

  async function fetchText(url) {
    const res = await fetch(url, { method: "GET", credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }

  function extractCidFromWizardHtml(html, numericPid) {
    // Look for CompanyID=... and FindedProjects=<pid> in onclick/href
    const re = /CompanyID=(\d+)[^'"]*FindedProjects=(\d+)/ig;
    let m;
    while ((m = re.exec(html)) !== null) {
      const cid = m[1];
      const pid = m[2];
      if (String(pid) === String(numericPid)) return cid;
    }
    // fallback: any CompanyID in page
    const m2 = html.match(/CompanyID=(\d+)/i);
    return m2 ? m2[1] : null;
  }

  async function runVoipSilent(pidP) {
    const pidNorm = normalizeProjectId(pidP);
    if (!pidNorm) { toast("❌ מספר פרויקט לא תקין", false); return; }
    const pid = projectNum(pidNorm);

    overlay.show("מחפש VOIP…", `פרויקט: ${pidNorm}\n(ללא פתיחת מסכי ביניים)`);

    try {
      // If currently on EditProject and has CompanyID/ProjectID, we can avoid wizard fetch
      const u = new URL(location.href);
      let cid = null;

      if (/\/nihul\/EditProject\.php$/i.test(u.pathname)) {
        const cid0 = u.searchParams.get("CompanyID");
        const pid0 = u.searchParams.get("ProjectID");
        if (cid0 && pid0 && String(pid0) === String(pid)) cid = cid0;
      }

      if (!cid) {
        overlay.update("מאתר CompanyID דרך Wizard…");
        const wizUrl = new URL(location.origin + WIZARD_PATH);
        wizUrl.searchParams.set("q", "P" + pid);
        const wizHtml = await fetchText(wizUrl.toString());
        cid = extractCidFromWizardHtml(wizHtml, pid);
      }

      if (!cid) {
        toast("❌ לא הצלחתי לאתר CompanyID (בדוק שהפרויקט קיים והרשאות)", false);
        return;
      }

      overlay.update(`נמצא CompanyID: ${cid}\nטוען VOIP Settings…`);

      const voipUrl = new URL(location.origin + VOIP_SETTINGS_PATH);
      voipUrl.searchParams.set("CompanyID", cid);
      voipUrl.searchParams.set("ProjectID", pid);

      const voipHtml = await fetchText(voipUrl.toString());
      const doc = domFromHtml(voipHtml);

      const domain = getByLabelFromDoc(doc, "domain");
      const account = getByLabelFromDoc(doc, "Account Code");
      const partition = getByLabelFromDoc(doc, "Partition");

      if (domain === "—" && account === "—" && partition === "—") {
        toast("❌ נטען VOIP Settings אבל לא זוהו Domain/Account/Partition", false);
        return;
      }

      const text =
        `VOIP SETTINGS\n\n` +
        `Project: P${pid}\n` +
        `CompanyID: ${cid}\n\n` +
        `Domain: ${domain}\n` +
        `Account Code: ${account}\n` +
        `Partition: ${partition}`;

      const copied = await copyToClipboard(account);
      alert(text + (copied ? `\n\n✅ הועתק ללוח (Account בלבד)` : `\n\n⚠️ לא הצלחתי להעתיק ללוח`));
      toast("✅ VOIP מוכן", true);
    } catch (e) {
      console.error(e);
      toast("❌ שגיאה ב-VOIP (ייתכן חסימה/timeout)", false);
    } finally {
      overlay.hide();
    }
  }

  /***********************
   * TOOL 2: Extension finder (unchanged)
   ***********************/
  const collectProjectIdsFromPage = () => {
    const ids = new Set();
    document.querySelectorAll("[onclick], a[href]").forEach(el => {
      const src = el.getAttribute("onclick") || el.getAttribute("href") || "";
      const m1 = src.match(/ProjectID=(\d+)/i);
      const m2 = src.match(/FindedProjects=(\d+)/i);
      if (m1) ids.add(m1[1]);
      if (m2) ids.add(m2[1]);
    });
    return [...ids].sort((a, b) => Number(a) - Number(b));
  };

  const fetchSettingsExt = async (projectId) => {
    const url = location.origin + VOIP_EXT_POST_PATH;
    const body =
      `ProjectID=${encodeURIComponent(projectId)}` +
      `&Ext=0&Del=0&ExtLite=0&Update=`;
    const res = await fetch(url, {
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
  };

  const extractExtensions = (html) => {
    const exts = new Set();
    const re = /\b(\d{2,6})\b/g;
    let m;
    while ((m = re.exec(html)) !== null) exts.add(m[1]);
    return [...exts];
  };

  const progressUI = (() => {
    let box, bar, text, sub, stopBtn, stopped = false;

    const ensure = () => {
      if (box) return;
      box = document.createElement("div");
      box.style.position = "fixed";
      box.style.right = "16px";
      box.style.bottom = "70px";
      box.style.width = "360px";
      box.style.background = "rgba(0,0,0,0.85)";
      box.style.color = "#fff";
      box.style.padding = "14px";
      box.style.borderRadius = "12px";
      box.style.zIndex = "2147483647";
      box.style.fontFamily = "Arial, sans-serif";
      box.style.boxShadow = "0 8px 30px rgba(0,0,0,0.35)";

      text = document.createElement("div");
      text.style.fontSize = "14px";
      text.style.fontWeight = "700";
      text.style.marginBottom = "8px";

      const barWrap = document.createElement("div");
      barWrap.style.width = "100%";
      barWrap.style.height = "10px";
      barWrap.style.background = "rgba(255,255,255,0.15)";
      barWrap.style.borderRadius = "999px";
      barWrap.style.overflow = "hidden";
      barWrap.style.marginBottom = "10px";

      bar = document.createElement("div");
      bar.style.height = "100%";
      bar.style.width = "0%";
      bar.style.background = "rgba(255,255,255,0.9)";
      bar.style.borderRadius = "999px";
      barWrap.appendChild(bar);

      sub = document.createElement("div");
      sub.style.fontSize = "12px";
      sub.style.opacity = "0.9";
      sub.style.whiteSpace = "pre-line";
      sub.style.marginBottom = "10px";

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "8px";
      actions.style.justifyContent = "flex-end";

      stopBtn = document.createElement("button");
      stopBtn.textContent = "עצור";
      stopBtn.style.cursor = "pointer";
      stopBtn.style.border = "0";
      stopBtn.style.borderRadius = "10px";
      stopBtn.style.padding = "8px 10px";
      stopBtn.style.fontWeight = "700";
      stopBtn.style.background = "rgba(255,255,255,0.15)";
      stopBtn.style.color = "#fff";

      const hideBtn = document.createElement("button");
      hideBtn.textContent = "הסתר";
      hideBtn.style.cursor = "pointer";
      hideBtn.style.border = "0";
      hideBtn.style.borderRadius = "10px";
      hideBtn.style.padding = "8px 10px";
      hideBtn.style.fontWeight = "700";
      hideBtn.style.background = "rgba(255,255,255,0.15)";
      hideBtn.style.color = "#fff";

      stopBtn.addEventListener("click", () => {
        stopped = true;
        stopBtn.textContent = "עוצר...";
        stopBtn.disabled = true;
        stopBtn.style.opacity = "0.7";
      });

      hideBtn.addEventListener("click", () => {
        box.remove();
        box = null; bar = null; text = null; sub = null; stopBtn = null;
      });

      actions.appendChild(stopBtn);
      actions.appendChild(hideBtn);

      box.appendChild(text);
      box.appendChild(barWrap);
      box.appendChild(sub);
      box.appendChild(actions);

      document.body.appendChild(box);
    };

    const start = (title) => {
      stopped = false;
      ensure();
      text.textContent = title;
      bar.style.width = "0%";
      sub.textContent = "";
      if (stopBtn) {
        stopBtn.style.display = "";
        stopBtn.disabled = false;
        stopBtn.textContent = "עצור";
        stopBtn.style.opacity = "1";
      }
      if (bar) bar.style.background = "rgba(255,255,255,0.9)";
    };

    const setSub = (t) => { ensure(); sub.textContent = t; };
    const setProgress = (pct) => { ensure(); bar.style.width = Math.max(0, Math.min(100, pct)) + "%"; };
    const isStopped = () => stopped;

    const done = (finalText, autoHideMs = 2000) => {
      ensure();
      setSub(finalText || "");
      setProgress(100);
      if (stopBtn) stopBtn.style.display = "none";
      if (autoHideMs) setTimeout(() => { if (box) box.remove(); box = null; }, autoHideMs);
    };

    const fail = (finalText, autoHideMs = 3500) => {
      ensure();
      setSub(finalText || "");
      if (bar) bar.style.background = "rgba(255,120,120,0.95)";
      if (autoHideMs) setTimeout(() => { if (box) box.remove(); box = null; }, autoHideMs);
    };

    return { start, setSub, setProgress, isStopped, done, fail };
  })();

  let extRunning = false;

  async function runExtensionSearch(targetExt) {
    if (extRunning) return;
    extRunning = true;

    try {
      const projectIds = collectProjectIdsFromPage();
      if (!projectIds.length) {
        alert("לא מצאתי ProjectID בדף הזה. עמוד במסך רשימת פרויקטים.");
        return;
      }

      progressUI.start(`מחפש שלוחה ${targetExt}...`);
      const total = projectIds.length;
      const t0 = Date.now();

      for (let i = 0; i < total; i++) {
        if (progressUI.isStopped()) {
          progressUI.fail(`נעצר.\nנבדקו ${i}/${total}`);
          return;
        }

        const pid = projectIds[i];
        const pct = Math.round((i / total) * 100);
        progressUI.setProgress(pct);

        const elapsed = (Date.now() - t0) / 1000;
        const rate = (i > 0) ? (elapsed / i) : 0;
        const eta = (i > 0) ? Math.max(0, Math.round((total - i) * rate)) : null;

        progressUI.setSub(
          `בודק פרויקט: ${pid}\n` +
          `התקדמות: ${i + 1}/${total}` +
          (eta !== null ? ` | ETA: ~${eta}s` : "")
        );

        try {
          const html = await fetchSettingsExt(pid);
          const exts = extractExtensions(html);
          if (exts.includes(targetExt)) {
            await copyToClipboard(pid);
            progressUI.done(`נמצא בפרויקט ${pid}\nהועתק ללוח`, 2500);
            alert(`שלוחה ${targetExt} נמצאה בפרויקט:\n\n${pid}\n\nהועתק ללוח`);
            return;
          }
        } catch {}

        await sleep(120);
      }

      progressUI.fail(`לא נמצאה שלוחה ${targetExt}\nנבדקו ${total} פרויקטים`, 3500);
      alert(`שלוחה ${targetExt} לא נמצאה באף פרויקט`);
    } finally {
      extRunning = false;
    }
  }

  /***********************
   * TOOL 3: Password Finder (unchanged)
   ***********************/
  function savePwReq(obj) { try { Store.setItem(PW_STORAGE_KEY, JSON.stringify(obj)); } catch {} }
  function loadPwReq() { try { const raw = Store.getItem(PW_STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
  function clearPwReq() { Store.removeItem(PW_STORAGE_KEY); }

  function openInterfacesTab(projectIdP, password) {
    const id = projectNum(projectIdP);
    const url = new URL(
      INTERFACES_URL_TEMPLATE.replace("{id}", encodeURIComponent(id)),
      window.location.origin
    ).toString();

    savePwReq({ project: projectIdP, password, ts: Date.now() });

    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) toast("❌ Chrome חסם Pop-up. אשר Pop-ups ל-bmby.com", false);
  }

  function findHeaderIndexExact(text) {
    return [...document.querySelectorAll("table th")]
      .findIndex(th => th.textContent.trim() === text);
  }

  function highlightRowCell(row, cell) {
    row.style.outline = "3px solid #ffe66d";
    cell.style.background = "#ffe66d";
    cell.style.fontWeight = "800";
    row.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function runPasswordSearchIfOnInterfaces() {
    if (!/\/nihul\/GridRemoteSite\.php/i.test(location.pathname)) return;
    const req = loadPwReq();
    if (!req?.password) return;

    await sleep(600);

    const idx = findHeaderIndexExact("סיסמא");
    if (idx === -1) {
      toast('❌ אין עמודה בשם "סיסמא"', false);
      clearPwReq();
      return;
    }

    const rows = document.querySelectorAll("table tbody tr");
    for (const r of rows) {
      const c = r.querySelectorAll("td")[idx];
      if (c && c.textContent.trim() === req.password) {
        highlightRowCell(r, c);
        toast(`✅ נמצאה הסיסמא עבור ${req.project}`, true);
        clearPwReq();
        return;
      }
    }

    toast(`❌ לא נמצאה הסיסמא עבור ${req.project}`, false);
    clearPwReq();
  }

  /***********************
   * Dashboard UI (Tabs)
   ***********************/
  function buildDashboard() {
    ensureStyles();
    if (document.getElementById(DASH_BACKDROP_ID)) return;

    const bd = document.createElement("div");
    bd.id = DASH_BACKDROP_ID;

    const panel = document.createElement("div");
    panel.id = DASH_ID;
    panel.classList.toggle("compact", isCompact());

    const hdr = document.createElement("div");
    hdr.id = DASH_HDR_ID;

    const title = document.createElement("div");
    title.className = "bmby-dash-title";
    title.textContent = "לינק טלפוניה (DEV)";

    const tabsWrap = document.createElement("div");
    tabsWrap.className = "bmby-tabs";

    const search = document.createElement("input");
    search.className = "bmby-search";
    search.placeholder = "חיפוש כלי…";

    const actions = document.createElement("div");
    actions.className = "bmby-dash-actions";

    const compactBtn = document.createElement("button");
    compactBtn.className = "bmby-dash-iconbtn";
    compactBtn.textContent = isCompact() ? "רגיל" : "קומפקטי";

    const devBadgeBtn = document.createElement("button");
    devBadgeBtn.className = "bmby-dash-iconbtn";
    devBadgeBtn.textContent = isDevBadgeOn() ? "DEV: ON" : "DEV: OFF";

    const clearBtn = document.createElement("button");
    clearBtn.className = "bmby-dash-iconbtn";
    clearBtn.textContent = "ניקוי";

    const xBtn = document.createElement("button");
    xBtn.className = "bmby-dash-iconbtn";
    xBtn.textContent = "✕";

    actions.appendChild(compactBtn);
    actions.appendChild(devBadgeBtn);
    actions.appendChild(clearBtn);
    actions.appendChild(xBtn);

    hdr.appendChild(title);
    hdr.appendChild(tabsWrap);
    hdr.appendChild(search);
    hdr.appendChild(actions);

    const body = document.createElement("div");
    body.className = "bmby-dash-body";

    panel.appendChild(hdr);
    panel.appendChild(body);
    bd.appendChild(panel);
    document.body.appendChild(bd);

    // Default center if no saved position
    if (!hasSavedPos(POS_DASH_KEY)) {
      panel.style.left = "50%";
      panel.style.top = "50%";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.transform = "translate(-50%, -50%)";
    }

    makeDraggableFixed(panel, hdr, POS_DASH_KEY, {
      zIndex: 2147483646,
      allowInteractive: true,
      ignoreSelector: ".bmby-dash-actions, .bmby-dash-actions *, .bmby-tabs, .bmby-tabs *, .bmby-search"
    });

    // Backdrop close
    bd.addEventListener("click", (e) => { if (e.target === bd) closeDashboard(); });
    xBtn.addEventListener("click", (e) => { e.preventDefault(); closeDashboard(); });

    compactBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const next = !isCompact();
      setCompact(next);
      compactBtn.textContent = next ? "רגיל" : "קומפקטי";
    });

    devBadgeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const next = !isDevBadgeOn();
      setDevBadgeOn(next);
      devBadgeBtn.textContent = next ? "DEV: ON" : "DEV: OFF";
    });

    /***************
     * Tools registry
     ***************/
    const tabs = [
      { id: "telephony", label: "טלפוניה" },
      { id: "projects", label: "פרויקטים" },
      { id: "security", label: "אבטחה" },
      { id: "tools", label: "כלים" },
    ];

    const tools = [
      {
        id: "voip",
        tab: "telephony",
        title: "1) לינק טלפוניה",
        desc: "חיפוש הגדרות מרכזיה (תוצאה סופית בלבד)",
        hotkey: "Ctrl+Shift+V",
        render(container) {
          container.innerHTML = `
            <div class="bmby-card" data-tool="voip">
              <div class="hdr">
                <div>
                  <div class="name">1) לינק טלפוניה</div>
                  <div class="desc">חיפוש VOIP – מציג תוצאה סופית בלבד (ללא פתיחת מסכי ביניים)</div>
                </div>
              </div>
              <div class="bmby-row">
                <input id="bmby-t1-pid" placeholder="פרויקט (9809 או P9809)" />
                <button id="bmby-t1-run">הפעל</button>
              </div>
              <div class="bmby-mini">קיצור: Ctrl+Shift+V</div>
              <div class="bmby-mini">אחרונים:</div>
              <div id="bmby-hist-voip" class="bmby-history"></div>
            </div>
          `;
          const t1pid = container.querySelector("#bmby-t1-pid");
          const t1run = container.querySelector("#bmby-t1-run");

          t1run.addEventListener("click", async () => {
            const pid = normalizeProjectId(t1pid.value);
            if (!pid) return toast("❌ מספר פרויקט לא תקין", false);
            pushHistory("voip", pid);
            renderAllHistories();
            await runVoipSilent(pid);
          });

          t1pid.addEventListener("keydown", (e) => { if (e.key === "Enter") t1run.click(); });
        }
      },
      {
        id: "ext",
        tab: "projects",
        title: "2) שלוחה",
        desc: "איתור שלוחה בפרויקטים בעמוד הנוכחי",
        hotkey: "Ctrl+Shift+E",
        render(container) {
          container.innerHTML = `
            <div class="bmby-card" data-tool="ext">
              <div class="hdr">
                <div>
                  <div class="name">2) שלוחה</div>
                  <div class="desc">איתור שלוחה בפרוייקט (דורש עמוד עם רשימת פרויקטים)</div>
                </div>
              </div>
              <div class="bmby-row">
                <input id="bmby-t2-ext" placeholder="שלוחה (למשל 201)" />
                <button id="bmby-t2-run">הפעל</button>
              </div>
              <div class="bmby-mini">קיצור: Ctrl+Shift+E</div>
              <div class="bmby-mini">אחרונים:</div>
              <div id="bmby-hist-ext" class="bmby-history"></div>
            </div>
          `;
          const t2ext = container.querySelector("#bmby-t2-ext");
          const t2run = container.querySelector("#bmby-t2-run");

          t2run.addEventListener("click", () => {
            const ext = String(t2ext.value || "").trim();
            if (!/^\d+$/.test(ext)) return toast("❌ שלוחה חייבת להיות מספר", false);
            pushHistory("ext", ext);
            renderAllHistories();
            runExtensionSearch(ext);
          });

          t2ext.addEventListener("keydown", (e) => { if (e.key === "Enter") t2run.click(); });
        }
      },
      {
        id: "pw",
        tab: "security",
        title: "3) סיסמא",
        desc: "איתור ממשק עם סיסמא קיימת",
        hotkey: "Alt+Shift+F",
        render(container) {
          container.innerHTML = `
            <div class="bmby-card" data-tool="pw">
              <div class="hdr">
                <div>
                  <div class="name">3) סיסמא</div>
                  <div class="desc">איתור ממשק עם סיסמא קיימת</div>
                </div>
              </div>
              <div class="bmby-row">
                <input id="bmby-t3-pid" placeholder="פרויקט (9809 או P9809)" />
                <input id="bmby-t3-pw" placeholder="סיסמא" />
              </div>
              <div class="bmby-row" style="margin-top:8px">
                <button id="bmby-t3-run">הפעל</button>
              </div>
              <div class="bmby-mini">קיצור: Alt+Shift+F</div>
              <div class="bmby-mini">אחרונים:</div>
              <div id="bmby-hist-pw" class="bmby-history"></div>
              <div class="bmby-mini">פתיחה/סגירה דשבורד: Alt+Shift+D</div>
            </div>
          `;
          const t3pid = container.querySelector("#bmby-t3-pid");
          const t3pw = container.querySelector("#bmby-t3-pw");
          const t3run = container.querySelector("#bmby-t3-run");

          t3run.addEventListener("click", () => {
            const pid = normalizeProjectId(t3pid.value);
            const pw = String(t3pw.value || "").trim();
            if (!pid) return toast("❌ מספר פרויקט לא תקין", false);
            if (!pw) return toast("❌ חסרה סיסמא", false);
            pushHistory("pw", `${pid}|${pw}`);
            renderAllHistories();
            openInterfacesTab(pid, pw);
          });

          t3pw.addEventListener("keydown", (e) => { if (e.key === "Enter") t3run.click(); });
        }
      },
      {
        id: "devinfo",
        tab: "tools",
        title: "כלי DEV",
        desc: "כלי עזר לפיתוח",
        hotkey: "",
        render(container) {
          container.innerHTML = `
            <div class="bmby-card" data-tool="devinfo">
              <div class="hdr">
                <div>
                  <div class="name">DEV</div>
                  <div class="desc">הגדרות לפיתוח ותצוגה</div>
                </div>
              </div>
              <div class="bmby-mini">
                • DEV Outline: מסגרת כתומה כדי לא להתבלבל<br/>
                • קומפקטי: מצמצם רווחים כשיש הרבה כלים
              </div>
            </div>
          `;
        }
      }
    ];

    // Tabs buttons
    let activeTabId = tabs[0].id;
    const tabBtns = new Map();

    function setActiveTab(id) {
      activeTabId = id;
      for (const t of tabs) {
        tabBtns.get(t.id)?.classList.toggle("active", t.id === id);
      }
      renderTab();
    }

    tabsWrap.innerHTML = "";
    for (const t of tabs) {
      const b = document.createElement("button");
      b.className = "bmby-tab";
      b.textContent = t.label;
      b.addEventListener("click", (e) => { e.preventDefault(); setActiveTab(t.id); });
      tabsWrap.appendChild(b);
      tabBtns.set(t.id, b);
    }

    function renderHistory(type, wrapId, onPick) {
      const wrap = panel.querySelector("#" + wrapId);
      if (!wrap) return;

      const items = getHistory(type);
      if (!items.length) {
        wrap.innerHTML = `<div class="item" style="cursor:default"><div class="v">אין היסטוריה</div><div class="time"></div></div>`;
        return;
      }

      wrap.innerHTML = "";
      for (const it of items) {
        const row = document.createElement("div");
        row.className = "item";
        row.innerHTML = `
          <div class="v">${escapeHtml(it.value ?? "—")}</div>
          <div class="time">${fmtTime(it.ts)}</div>
        `;
        row.addEventListener("click", () => onPick(it.value));
        wrap.appendChild(row);
      }
    }

    function renderHistoryPw() {
      const wrap = panel.querySelector("#bmby-hist-pw");
      if (!wrap) return;
      const items = getHistory("pw");
      if (!items.length) {
        wrap.innerHTML = `<div class="item" style="cursor:default"><div class="v">אין היסטוריה</div><div class="time"></div></div>`;
        return;
      }

      wrap.innerHTML = "";
      for (const it of items) {
        const [p, pw] = String(it.value || "").split("|");
        const row = document.createElement("div");
        row.className = "item";
        row.innerHTML = `
          <div class="v">${escapeHtml(`${p || ""} | ${pw || ""}`.trim() || "—")}</div>
          <div class="time">${fmtTime(it.ts)}</div>
        `;
        row.addEventListener("click", () => {
          const t3pid = panel.querySelector("#bmby-t3-pid");
          const t3pw = panel.querySelector("#bmby-t3-pw");
          if (t3pid) t3pid.value = p || "";
          if (t3pw) t3pw.value = pw || "";
          toast("הוזן לכלי 3", true);
        });
        wrap.appendChild(row);
      }
    }

    function renderAllHistories() {
      renderHistory("voip", "bmby-hist-voip", (v) => {
        const t1pid = panel.querySelector("#bmby-t1-pid");
        if (t1pid) t1pid.value = v;
        toast("הוזן לכלי 1", true);
      });
      renderHistory("ext", "bmby-hist-ext", (v) => {
        const t2ext = panel.querySelector("#bmby-t2-ext");
        if (t2ext) t2ext.value = v;
        toast("הוזן לכלי 2", true);
      });
      renderHistoryPw();
    }
    window.__bmbyRenderAllHistories = renderAllHistories;

    function toolMatchesSearch(tool, q) {
      if (!q) return true;
      const s = String(q).trim().toLowerCase();
      const hay = `${tool.title} ${tool.desc} ${tool.id}`.toLowerCase();
      return hay.includes(s);
    }

    function renderTab() {
      const q = String(search.value || "").trim().toLowerCase();
      body.innerHTML = "";

      const toolsInTab = tools.filter(t => t.tab === activeTabId).filter(t => toolMatchesSearch(t, q));
      if (!toolsInTab.length) {
        const empty = document.createElement("div");
        empty.className = "bmby-card";
        empty.innerHTML = `<div class="name">אין תוצאות</div><div class="desc">נסה לשנות חיפוש או טאבה.</div>`;
        body.appendChild(empty);
        return;
      }

      for (const t of toolsInTab) {
        const slot = document.createElement("div");
        t.render(slot);
        body.appendChild(slot);
      }
      renderAllHistories();
    }

    search.addEventListener("input", () => renderTab());

    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      clearAllHistory();
      Store.removeItem(PW_STORAGE_KEY);
      Store.removeItem(POS_BTN_KEY);
      Store.removeItem(POS_DASH_KEY);
      renderTab();
      toast("נוקה: היסטוריה + טוקנים + מיקומים (DEV)", true);
    });

    // Initial render
    setActiveTab(activeTabId);
    applyDevVisual();
  }

  function openDashboard() {
    buildDashboard();
    const bd = document.getElementById(DASH_BACKDROP_ID);
    if (bd) bd.style.display = "flex";
    window.__bmbyRenderAllHistories?.();
  }
  function closeDashboard() {
    const bd = document.getElementById(DASH_BACKDROP_ID);
    if (bd) bd.style.display = "none";
  }
  function toggleDashboard() {
    const bd = document.getElementById(DASH_BACKDROP_ID);
    if (!bd) return openDashboard();
    const isOpen = bd.style.display !== "none";
    bd.style.display = isOpen ? "none" : "flex";
    if (!isOpen) window.__bmbyRenderAllHistories?.();
  }

  /***********************
   * Floating button
   ***********************/
  function ensureDashButton() {
    ensureStyles();
    if (document.getElementById(DASH_BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = DASH_BTN_ID;
    btn.textContent = "Dashboard";
    btn.title = "Alt+Shift+D (אפשר לגרור)";
    document.body.appendChild(btn);

    makeDraggableFixed(btn, btn, POS_BTN_KEY, { zIndex: 2147483647, allowInteractive: true });
    applyDevVisual();

    btn.addEventListener("click", (e) => {
      toggleDashboard();
      e.preventDefault();
    });
  }

  /***********************
   * Hotkeys
   ***********************/
  // Dashboard toggle
  window.addEventListener("keydown", (e) => {
    const tag = e.target?.tagName?.toLowerCase() || "";
    if (tag === "input" || tag === "textarea") return;

    if (e.altKey && e.shiftKey && e.key.toLowerCase() === "d") {
      e.preventDefault();
      toggleDashboard();
    }
  }, true);

  // VOIP hotkey: Ctrl+Shift+V (silent result)
  document.addEventListener("keydown", async (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "V" || e.key === "v")) {
      e.preventDefault();

      // If user is on VOIP Settings page and just wants manual extract, do it from current DOM
      if (/\/nihul\/VoIP\/Settings\.php$/i.test(location.pathname)) {
        const domain = (() => {
          const v = (() => {
            const want = "domain";
            const tds = [...document.querySelectorAll("td")];
            for (let i = 0; i < tds.length; i++) {
              const t = (tds[i].innerText || "").trim().toLowerCase();
              if (t === want) {
                const next = tds[i + 1];
                const el = next?.querySelector("input,select,textarea");
                return el?.value || (next?.innerText || "").trim() || "—";
              }
            }
            return "—";
          })();
          return v;
        })();
        const account = (() => {
          const want = "account code";
          const tds = [...document.querySelectorAll("td")];
          for (let i = 0; i < tds.length; i++) {
            const t = (tds[i].innerText || "").trim().toLowerCase();
            if (t === want) {
              const next = tds[i + 1];
              const el = next?.querySelector("input,select,textarea");
              return el?.value || (next?.innerText || "").trim() || "—";
            }
          }
          return "—";
        })();
        const partition = (() => {
          const want = "partition";
          const tds = [...document.querySelectorAll("td")];
          for (let i = 0; i < tds.length; i++) {
            const t = (tds[i].innerText || "").trim().toLowerCase();
            if (t === want) {
              const next = tds[i + 1];
              const el = next?.querySelector("input,select,textarea");
              return el?.value || (next?.innerText || "").trim() || "—";
            }
          }
          return "—";
        })();

        const text =
          `VOIP SETTINGS\n\n` +
          `Domain: ${domain}\n` +
          `Account Code: ${account}\n` +
          `Partition: ${partition}`;

        const copied = await copyToClipboard(account);
        alert(text + (copied ? `\n\n✅ הועתק ללוח (Account בלבד)` : `\n\n⚠️ לא הצלחתי להעתיק ללוח`));
        return;
      }

      const q = prompt("הכנס חיפוש (למשל P9681 או 9681)");
      if (!q) return;
      const pidP = normalizeProjectId(q);
      if (!pidP) { alert("לא זוהה מספר פרויקט"); return; }

      pushHistory("voip", pidP);
      window.__bmbyRenderAllHistories?.();

      await runVoipSilent(pidP);
    }
  }, true);

  /***********************
   * Boot
   ***********************/
  ensureDashButton();
  runPasswordSearchIfOnInterfaces();
  applyDevVisual();

})();
