// @downloadURL  https://raw.githubusercontent.com/<avid-bmby>/<bmby-dashboard>/main/bmby-dashboard.user.js
// @updateURL    https://raw.githubusercontent.com/<avid-bmby>/<bmby-dashboard>/main/bmby-dashboard.user.js
// ==UserScript==
// @name         BMBY – Link Telephony Dashboard (VOIP + Ext + Password) – Perfect v6 (Wizard TD Click Flow + History)
// @namespace    bmby-link-telephony-dashboard
// @version      1.1.0
// @description  Dashboard עם 3 כלים + היסטוריות פר-כלי. Tool 1 מחזיר את הזרימה שעבדה: Wizard?q=P#### -> auto click td[onclick] -> Wizard?CompanyID..&FindedProjects.. -> VOIP Settings בטאב חדש -> Alert+Copy (רק מה-flow). ללא submit, ללא לופים.
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

  /* -----------------------------
     Unified Storage (GM_* preferred)
  ------------------------------ */
  const HasGM = typeof GM_getValue === "function" && typeof GM_setValue === "function";

  const Store = {
    getRaw(k) {
      try { return HasGM ? GM_getValue(k, null) : localStorage.getItem(k); } catch { return null; }
    },
    setRaw(k, v) {
      try { return HasGM ? GM_setValue(k, v) : localStorage.setItem(k, String(v)); } catch {}
    },
    removeItem(k) {
      try { return HasGM ? GM_deleteValue(k) : localStorage.removeItem(k); } catch {}
    },
    getJSON(k, fallback) {
      const raw = Store.getRaw(k);
      if (raw == null) return fallback;
      if (typeof raw === "object") return raw; // GM יכול להחזיר אובייקט
      if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return fallback; } }
      return fallback;
    },
    setJSON(k, obj) {
      try { return HasGM ? Store.setRaw(k, obj) : localStorage.setItem(k, JSON.stringify(obj)); } catch {}
    },
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* -----------------------------
     Constants / Keys
  ------------------------------ */
  const DASH_BTN_ID = "bmby-dash-btn";
  const DASH_ID = "bmby-dash";
  const DASH_HDR_ID = "bmby-dash-hdr";
  const DASH_BACKDROP_ID = "bmby-dash-backdrop";

  const POS_BTN_KEY = "bmby_dash_btn_pos_v1";
  const POS_DASH_KEY = "bmby_dash_pos_v1";

  const HIST_MAX = 10;
  const HIST_KEYS = {
    voip: "bmby_hist_voip_v3",
    ext:  "bmby_hist_ext_v3",
    pw:   "bmby_hist_pw_v3",
  };

  // Tool 1 flow token (כמו הגרסה שעבדה אצלך)
  const VOIP_FLOW_KEY = "bmby_voip_popup_ctx";   // שמרתי אותו שם כדי לשמור תאימות
  const VOIP_FLOW_TTL = 60_000;

  // per-tab helper (כמו הקוד שעבד)
  const KEY_PID_TAB = "bmby_target_pid";

  const PW_STORAGE_KEY = "bmby_pw_req_v42";

  const VOIP_SETTINGS_PATH = "/nihul/VoIP/Settings.php";
  const WIZARD_PATH = "/nihul/Wizard.php";
  const INTERFACES_URL_TEMPLATE = "/nihul/GridRemoteSite.php?ProjectID={id}";
  const VOIP_EXT_POST_PATH = "/nihul/VoIP/SettingsExt.php";

  /* -----------------------------
     Helpers
  ------------------------------ */
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

  /* -----------------------------
     History
  ------------------------------ */
  function normalizeHistoryArray(raw) {
    const out = [];
    if (!Array.isArray(raw)) return out;
    for (const item of raw) {
      if (typeof item === "string") out.push({ value: item, ts: Date.now() });
      else if (item && typeof item === "object") {
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
      const arr = normalizeHistoryArray(Store.getJSON(key, []));
      const e = { value: String(value), ts: Date.now() };
      const next = [e, ...arr.filter(x => String(x.value) !== String(e.value))].slice(0, HIST_MAX);
      Store.setJSON(key, next);
    } catch {}
  }

  function getHistory(type) {
    const key = HIST_KEYS[type];
    if (!key) return [];
    try {
      const arr = normalizeHistoryArray(Store.getJSON(key, []));
      const cut = arr.slice(0, HIST_MAX);
      Store.setJSON(key, cut);
      return cut;
    } catch { return []; }
  }

  function clearAllHistory() {
    Object.values(HIST_KEYS).forEach(k => Store.removeItem(k));
  }

  /* -----------------------------
     Draggable
  ------------------------------ */
  function makeDraggableFixed(el, handle, posKey, {
    zIndex = 2147483646,
    allowInteractive = false,
    ignoreSelector = null
  } = {}) {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    const loadPos = () => {
      try {
        const raw = Store.getRaw(posKey);
        if (!raw) return null;
        return (typeof raw === "object") ? raw : JSON.parse(raw);
      } catch { return null; }
    };

    const savePos = (pos) => {
      try { Store.setRaw(posKey, HasGM ? pos : JSON.stringify(pos)); } catch {}
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
      const raw = Store.getRaw(key);
      if (!raw) return false;
      const obj = (typeof raw === "object") ? raw : JSON.parse(raw);
      return obj && typeof obj.x === "number" && typeof obj.y === "number";
    } catch { return false; }
  }

  /* -----------------------------
     Styles
  ------------------------------ */
  function ensureStyles() {
    if (document.getElementById("bmby-dash-style")) return;
    const s = document.createElement("style");
    s.id = "bmby-dash-style";
    s.textContent = `
      #${DASH_BTN_ID}{
        position:fixed;right:16px;bottom:16px;border:0;border-radius:999px;padding:12px 16px;
        background:#111;color:#fff;font:14px Arial;font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.35);
        cursor:pointer;z-index:2147483647;user-select:none;touch-action:none;
      }
      #${DASH_BACKDROP_ID}{
        position:fixed;inset:0;background:rgba(0,0,0,.25);z-index:2147483645;display:flex;
        align-items:center;justify-content:center;padding:16px;
      }
      #${DASH_ID}{
        width:440px;max-width:92vw;background:#111;color:#fff;border-radius:14px;box-shadow:0 16px 45px rgba(0,0,0,.45);
        overflow:hidden;font:13px Arial;
      }
      #${DASH_HDR_ID}{
        display:flex;align-items:center;justify-content:space-between;padding:12px 12px;background:rgba(255,255,255,.06);
        border-bottom:1px solid rgba(255,255,255,.08);user-select:none;touch-action:none;cursor:grab;
      }
      .bmby-dash-title{font-weight:900;letter-spacing:.2px;user-select:none;touch-action:none;}
      .bmby-dash-actions{display:flex;gap:8px;align-items:center;}
      .bmby-dash-iconbtn{
        border:0;background:rgba(255,255,255,.10);color:#fff;padding:8px 10px;border-radius:10px;cursor:pointer;font-weight:800;
      }
      .bmby-dash-iconbtn:hover{background:rgba(255,255,255,.16);}
      .bmby-dash-body{padding:12px;display:flex;flex-direction:column;gap:10px;}
      .bmby-card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px;}
      .bmby-card .hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;}
      .bmby-card .name{font-weight:900;}
      .bmby-card .desc{opacity:.82;font-size:12px;margin-top:2px;}
      .bmby-row{display:flex;gap:8px;margin-top:10px;}
      .bmby-row input{flex:1;width:100%;padding:9px 10px;border-radius:10px;border:0;outline:none;font-size:13px;}
      .bmby-row button{padding:9px 10px;border-radius:10px;border:0;cursor:pointer;font-weight:900;background:#fff;color:#111;min-width:110px;}
      .bmby-mini{opacity:.78;font-size:12px;margin-top:6px;line-height:1.35;}
      .bmby-history{max-height:120px;overflow:auto;margin-top:8px;border-radius:10px;border:1px solid rgba(255,255,255,.08);}
      .bmby-history .item{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;justify-content:space-between;gap:10px;cursor:pointer;}
      .bmby-history .item:last-child{border-bottom:0;}
      .bmby-history .item:hover{background:rgba(255,255,255,.06);}
      .bmby-history .v{opacity:.88;font-size:12px;}
      .bmby-history .time{opacity:.6;font-size:11px;white-space:nowrap;}
    `;
    document.head.appendChild(s);
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* -----------------------------
     TOOL 1 (VOIP) — RESTORED WORKING FLOW ✅
  ------------------------------ */
  const setFlowToken = (pidDigits) => Store.setJSON(VOIP_FLOW_KEY, { pid: String(pidDigits), ts: Date.now() });

  const hasValidFlowToken = (pidDigits) => {
    const ctx = Store.getJSON(VOIP_FLOW_KEY, null);
    if (!ctx || typeof ctx !== "object") return false;
    const fresh = (Date.now() - Number(ctx.ts || 0)) < VOIP_FLOW_TTL;
    const match = pidDigits && String(pidDigits) === String(ctx.pid);
    if (!fresh) Store.removeItem(VOIP_FLOW_KEY);
    return fresh && match;
  };

  const consumeFlowTokenIfMatch = (pidDigits) => {
    const ok = hasValidFlowToken(pidDigits);
    if (ok) Store.removeItem(VOIP_FLOW_KEY);
    return ok;
  };

  const openVoipInNewTab = (cid, pidDigits) => {
    if (!cid || !pidDigits) return;
    const v = new URL(location.origin + VOIP_SETTINGS_PATH);
    v.searchParams.set("CompanyID", cid);
    v.searchParams.set("ProjectID", pidDigits);
    window.open(v.toString(), "_blank", "noopener,noreferrer");
  };

  const getByLabel = (label) => {
    const want = (label || "").trim().toLowerCase();
    const tds = [...document.querySelectorAll("td")];
    for (let i = 0; i < tds.length; i++) {
      const t = (tds[i].innerText || "").trim().toLowerCase();
      if (t === want) {
        const next = tds[i + 1];
        const el = next?.querySelector("input,select,textarea");
        return el?.value || "—";
      }
    }
    return "—";
  };

  const showVoipAlertAndCopy = async () => {
    for (let i = 0; i < 60; i++) {
      const domain = getByLabel("domain");
      const account = getByLabel("Account Code");
      const partition = getByLabel("Partition");

      if (domain !== "—" || account !== "—" || partition !== "—") {
        const text =
          `VOIP SETTINGS\n\n` +
          `Domain: ${domain}\n` +
          `Account Code: ${account}\n` +
          `Partition: ${partition}`;
        const copied = await copyToClipboard(account);
        alert(text + (copied ? `\n\n✅ הועתק ללוח (Account בלבד)` : `\n\n⚠️ לא הצלחתי להעתיק ללוח`));
        return;
      }
      await sleep(250);
    }
    alert("נכנסתי ל-VOIP Settings אבל לא מצאתי Domain/Account/Partition (אולי מבנה הדף השתנה).");
  };

  function startVoipFlowFromAnywhere(pidP) {
    const pidDigits = projectNum(pidP);
    sessionStorage.setItem(KEY_PID_TAB, pidDigits);
    setFlowToken(pidDigits);
    // בדיוק כמו הגרסה שעבדה: מעבר ל-Wizard?q=P####
    location.href = location.origin + `${WIZARD_PATH}?q=` + encodeURIComponent("P" + pidDigits);
  }

  // A) Wizard.php?q=P#### -> auto click td[onclick] מתאים (כמו אצלך)
  function wizardAutoClickFromQ() {
    const u = new URL(location.href);
    if (!/\/nihul\/Wizard\.php$/i.test(u.pathname)) return;
    const q = u.searchParams.get("q");
    if (!q) return;

    const pidDigits = (String(q).match(/\d+/) || [])[0];
    if (!pidDigits) return;

    // רק אם באנו מה-flow (token תקף)
    if (!hasValidFlowToken(pidDigits)) return;

    sessionStorage.setItem(KEY_PID_TAB, pidDigits);

    let tries = 0;
    const timer = setInterval(() => {
      tries++;

      const tds = [...document.querySelectorAll("td[onclick]")];
      const td = tds.find(x => {
        const oc = x.getAttribute("onclick") || "";
        return oc.includes("Wizard.php") &&
               oc.includes("CompanyID=") &&
               oc.includes("FindedProjects=" + pidDigits);
      });

      if (td) {
        clearInterval(timer);
        td.click();
      } else if (tries > 50) {
        clearInterval(timer);
        // לא מנקים טוקן כאן — אולי המשתמש יקליק ידנית לתוצאה
        toast("⚠️ לא מצאתי תוצאה אוטומטית ב-Wizard (תוכל להקליק ידנית על הפרויקט)", false);
      }
    }, 250);
  }

  // B) Wizard.php?CompanyID=...&FindedProjects=... -> open VOIP (רק אם token תקף)
  function wizardOpenVoipIfHasCidPid() {
    const u = new URL(location.href);
    if (!/\/nihul\/Wizard\.php$/i.test(u.pathname)) return;

    const cid = u.searchParams.get("CompanyID");
    const pid = u.searchParams.get("FindedProjects") || sessionStorage.getItem(KEY_PID_TAB);

    if (cid && pid && hasValidFlowToken(pid)) {
      sessionStorage.removeItem(KEY_PID_TAB);
      // פותח VOIP בטאב חדש (כמו הגרסה שעבדה)
      openVoipInNewTab(cid, pid);
    }
  }

  // C) EditProject.php -> open VOIP (רק אם token תקף)
  function editProjectOpenVoipIfPossible() {
    const u = new URL(location.href);
    if (!/\/nihul\/EditProject\.php$/i.test(u.pathname)) return;

    const cid = u.searchParams.get("CompanyID");
    const pid = u.searchParams.get("ProjectID");

    if (cid && pid && hasValidFlowToken(pid)) {
      sessionStorage.removeItem(KEY_PID_TAB);
      openVoipInNewTab(cid, pid);
    }
  }

  // D) VOIP Settings -> popup+copy רק אם token תקף ומתאים (חד פעמי)
  function voipSettingsPopupIfFromFlow() {
    const u = new URL(location.href);
    if (!/\/nihul\/VoIP\/Settings\.php$/i.test(u.pathname)) return;
    const currentPid = u.searchParams.get("ProjectID");
    if (consumeFlowTokenIfMatch(currentPid)) {
      setTimeout(() => { showVoipAlertAndCopy(); }, 400);
    }
  }

  /* -----------------------------
     TOOL 3: Password Finder
  ------------------------------ */
  function savePwReq(obj) { try { Store.setRaw(PW_STORAGE_KEY, HasGM ? obj : JSON.stringify(obj)); } catch {} }
  function loadPwReq() {
    try {
      const raw = Store.getRaw(PW_STORAGE_KEY);
      if (!raw) return null;
      if (typeof raw === "object") return raw;
      return JSON.parse(raw);
    } catch { return null; }
  }
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

  /* -----------------------------
     TOOL 2: Extension finder (unchanged)
  ------------------------------ */
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
    const body = `ProjectID=${encodeURIComponent(projectId)}&Ext=0&Del=0&ExtLite=0&Update=`;
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

  /* -----------------------------
     Dashboard build
  ------------------------------ */
  function buildDashboard() {
    ensureStyles();
    if (document.getElementById(DASH_BACKDROP_ID)) return;

    const bd = document.createElement("div");
    bd.id = DASH_BACKDROP_ID;

    const panel = document.createElement("div");
    panel.id = DASH_ID;

    const hdr = document.createElement("div");
    hdr.id = DASH_HDR_ID;

    const title = document.createElement("div");
    title.className = "bmby-dash-title";
    title.textContent = "לינק טלפוניה";

    const actions = document.createElement("div");
    actions.className = "bmby-dash-actions";

    const closeAllBtn = document.createElement("button");
    closeAllBtn.className = "bmby-dash-iconbtn";
    closeAllBtn.textContent = "סגור הכל";

    const clearBtn = document.createElement("button");
    clearBtn.className = "bmby-dash-iconbtn";
    clearBtn.textContent = "ניקוי";

    const xBtn = document.createElement("button");
    xBtn.className = "bmby-dash-iconbtn";
    xBtn.textContent = "✕";

    actions.appendChild(clearBtn);
    actions.appendChild(closeAllBtn);
    actions.appendChild(xBtn);

    hdr.appendChild(title);
    hdr.appendChild(actions);

    const body = document.createElement("div");
    body.className = "bmby-dash-body";

    const t1 = document.createElement("div");
    t1.className = "bmby-card";
    t1.innerHTML = `
      <div class="hdr">
        <div>
          <div class="name">1) לינק טלפוניה</div>
          <div class="desc">חיפוש הגדרות מרכזיה (ה-flow שעבד: Wizard TD click)</div>
        </div>
      </div>
      <div class="bmby-row">
        <input id="bmby-t1-pid" placeholder="פרויקט (9809 או P9809)" />
        <button id="bmby-t1-run">הפעל</button>
      </div>
      <div class="bmby-mini">קיצור: Ctrl+Shift+V</div>
      <div class="bmby-mini">אחרונים:</div>
      <div id="bmby-hist-voip" class="bmby-history"></div>
    `;

    const t2 = document.createElement("div");
    t2.className = "bmby-card";
    t2.innerHTML = `
      <div class="hdr">
        <div>
          <div class="name">2) שלוחה</div>
          <div class="desc">איתור שלוחה בפרוייקט</div>
        </div>
      </div>
      <div class="bmby-row">
        <input id="bmby-t2-ext" placeholder="שלוחה (למשל 201)" />
        <button id="bmby-t2-run">הפעל</button>
      </div>
      <div class="bmby-mini">קיצור: Ctrl+Shift+E</div>
      <div class="bmby-mini">אחרונים:</div>
      <div id="bmby-hist-ext" class="bmby-history"></div>
    `;

    const t3 = document.createElement("div");
    t3.className = "bmby-card";
    t3.innerHTML = `
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
    `;

    body.appendChild(t1);
    body.appendChild(t2);
    body.appendChild(t3);

    panel.appendChild(hdr);
    panel.appendChild(body);
    bd.appendChild(panel);
    document.body.appendChild(bd);

    bd.addEventListener("click", (e) => { if (e.target === bd) closeDashboard(); });
    xBtn.addEventListener("click", (e) => { e.preventDefault(); closeDashboard(); });
    closeAllBtn.addEventListener("click", (e) => { e.preventDefault(); closeDashboard(); });

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
      ignoreSelector: ".bmby-dash-actions, .bmby-dash-actions *"
    });

    const t1pid = panel.querySelector("#bmby-t1-pid");
    const t1run = panel.querySelector("#bmby-t1-run");
    const t2ext = panel.querySelector("#bmby-t2-ext");
    const t2run = panel.querySelector("#bmby-t2-run");
    const t3pid = panel.querySelector("#bmby-t3-pid");
    const t3pw = panel.querySelector("#bmby-t3-pw");
    const t3run = panel.querySelector("#bmby-t3-run");

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
          t3pid.value = p || "";
          t3pw.value = pw || "";
          toast("הוזן לכלי 3", true);
        });
        wrap.appendChild(row);
      }
    }

    function renderAllHistories() {
      renderHistory("voip", "bmby-hist-voip", (v) => { t1pid.value = v; toast("הוזן לכלי 1", true); });
      renderHistory("ext", "bmby-hist-ext", (v) => { t2ext.value = v; toast("הוזן לכלי 2", true); });
      renderHistoryPw();
    }

    window.__bmbyRenderAllHistories = renderAllHistories;
    renderAllHistories();

    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      t1pid.value = "";
      t2ext.value = "";
      t3pid.value = "";
      t3pw.value = "";

      clearAllHistory();
      Store.removeItem(VOIP_FLOW_KEY);
      Store.removeItem(PW_STORAGE_KEY);

      Store.removeItem(POS_BTN_KEY);
      Store.removeItem(POS_DASH_KEY);

      renderAllHistories();
      toast("נוקה: ערכים + היסטוריה + טוקנים + מיקומים", true);
    });

    t1run.addEventListener("click", () => {
      const pid = normalizeProjectId(t1pid.value);
      if (!pid) return toast("❌ מספר פרויקט לא תקין", false);
      pushHistory("voip", pid);
      renderAllHistories();
      startVoipFlowFromAnywhere(pid);
    });

    t2run.addEventListener("click", () => {
      const ext = String(t2ext.value || "").trim();
      if (!/^\d+$/.test(ext)) return toast("❌ שלוחה חייבת להיות מספר", false);
      pushHistory("ext", ext);
      renderAllHistories();
      runExtensionSearch(ext);
    });

    t3run.addEventListener("click", () => {
      const pid = normalizeProjectId(t3pid.value);
      const pw = String(t3pw.value || "").trim();
      if (!pid) return toast("❌ מספר פרויקט לא תקין", false);
      if (!pw) return toast("❌ חסרה סיסמא", false);
      pushHistory("pw", `${pid}|${pw}`);
      renderAllHistories();
      openInterfacesTab(pid, pw);
    });

    t1pid.addEventListener("keydown", (e) => { if (e.key === "Enter") t1run.click(); });
    t2ext.addEventListener("keydown", (e) => { if (e.key === "Enter") t2run.click(); });
    t3pw.addEventListener("keydown", (e) => { if (e.key === "Enter") t3run.click(); });
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

  function ensureDashButton() {
    ensureStyles();
    if (document.getElementById(DASH_BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = DASH_BTN_ID;
    btn.textContent = "Dashboard";
    btn.title = "Alt+Shift+D (אפשר לגרור)";
    document.body.appendChild(btn);

    makeDraggableFixed(btn, btn, POS_BTN_KEY, { zIndex: 2147483647, allowInteractive: true });

    btn.addEventListener("click", (e) => {
      toggleDashboard();
      e.preventDefault();
    });
  }

  /* -----------------------------
     Hotkeys
  ------------------------------ */
  // Ctrl+Shift+V — בדיוק כמו הקוד שעבד אצלך: מפעיל Flow
  document.addEventListener("keydown", async (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "V" || e.key === "v")) {
      e.preventDefault();

      const u = new URL(location.href);

      // אם כבר ב-VOIP Settings -> alert+copy (ידני)
      if (/\/nihul\/VoIP\/Settings\.php$/i.test(u.pathname)) {
        await showVoipAlertAndCopy();
        return;
      }

      // אם בדף פרויקט -> פתח VOIP בטאב חדש + token
      if (/\/nihul\/EditProject\.php$/i.test(u.pathname)) {
        const cid = u.searchParams.get("CompanyID");
        const pid = u.searchParams.get("ProjectID");
        if (!cid || !pid) return;
        setFlowToken(pid);
        pushHistory("voip", "P" + pid);
        window.__bmbyRenderAllHistories?.();
        openVoipInNewTab(cid, pid);
        return;
      }

      // אם ב-Wizard עם CompanyID+FindedProjects -> פתח VOIP בטאב חדש + token
      if (/\/nihul\/Wizard\.php$/i.test(u.pathname)) {
        const cid = u.searchParams.get("CompanyID");
        const pid = u.searchParams.get("FindedProjects");
        if (cid && pid) {
          setFlowToken(pid);
          pushHistory("voip", "P" + pid);
          window.__bmbyRenderAllHistories?.();
          openVoipInNewTab(cid, pid);
          return;
        }
      }

      // אחרת: בקש P#### והתחל זרימה (Wizard?q=P####)
      const q = prompt("הכנס חיפוש (למשל P9681 או 9681)");
      if (!q) return;
      const pidP = normalizeProjectId(q);
      if (!pidP) { alert("לא זוהה מספר פרויקט"); return; }

      pushHistory("voip", pidP);
      window.__bmbyRenderAllHistories?.();
      startVoipFlowFromAnywhere(pidP);
    }
  }, true);

  window.addEventListener("keydown", (e) => {
    const tag = e.target?.tagName?.toLowerCase() || "";
    if (tag === "input" || tag === "textarea") return;

    if (e.altKey && e.shiftKey && e.key.toLowerCase() === "d") {
      e.preventDefault();
      toggleDashboard();
    }
  }, true);

  /* -----------------------------
     Boot
  ------------------------------ */
  ensureDashButton();
  runPasswordSearchIfOnInterfaces();

  // Tool 1 flow handlers (כמו הגרסה שעבדה)
  wizardAutoClickFromQ();
  wizardOpenVoipIfHasCidPid();
  editProjectOpenVoipIfPossible();
  voipSettingsPopupIfFromFlow();

})();
