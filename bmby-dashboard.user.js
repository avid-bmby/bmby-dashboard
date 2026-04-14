// ==UserScript==
// @name         BMBY Dashboard (PROD) v1.4.46 – Nihul + IPBX MAINWORKING + Dictionary + Partition Prefix + IPBX HUB
// @namespace    https://bmby.com/
// @version      1.4.47
// @description  Unified PROD: full dashboard + IPBX DID Helper + Dictionary Search + Partition Prefix + main HUB on partition page and USERS/AGENTS scan panels, preserving existing USERS logic. Removed PIN column; kept AUTO IN REC/AUTO OUT REC fields. Added AGENTS CF Always/No Answer and fixed HUB navigation back to USERS. Added initial IVR MENU module and scanner.
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/avid-bmby/bmby-dashboard/main/bmby-dashboard.user.js
// @downloadURL  https://raw.githubusercontent.com/avid-bmby/bmby-dashboard/main/bmby-dashboard.user.js
// @match        https://www.bmby.com/nihul/*
// @match        https://bmby.com/nihul/*
// @match        https://www.bmby.com/nihul/ProjectsBoards.php*
// @match        https://bmby.com/nihul/ProjectsBoards.php*
// @match        http://voip.bmby.com/ipbx/dialplan_edit.php*
// @match        http://voip2.bmby.com/ipbx/dialplan_edit.php*
// @match        http://82.166.228.179/ipbx/dialplan_edit.php*
// @match        http://82.166.228.180/ipbx/dialplan_edit.php*
// @match        http://voip.bmby.com/ipbx/partition_selection.php*
// @match        http://voip2.bmby.com/ipbx/partition_selection.php*
// @match        http://82.166.228.179/ipbx/partition_selection.php*
// @match        http://82.166.228.180/ipbx/partition_selection.php*
// @match        http://voip.bmby.com/ipbx/users_edit.php*
// @match        http://voip2.bmby.com/ipbx/users_edit.php*
// @match        http://82.166.228.179/ipbx/users_edit.php*
// @match        http://82.166.228.180/ipbx/users_edit.php*
// @match        http://voip.bmby.com/ipbx/users.php*
// @match        http://voip2.bmby.com/ipbx/users.php*
// @match        http://82.166.228.179/ipbx/users.php*
// @match        http://82.166.228.180/ipbx/users.php*
// @match        http://voip.bmby.com/ipbx/agents_list.php*
// @match        http://voip2.bmby.com/ipbx/agents_list.php*
// @match        http://82.166.228.179/ipbx/agents_list.php*
// @match        http://82.166.228.180/ipbx/agents_list.php*
// @match        http://voip.bmby.com/ipbx/agents.php*
// @match        http://voip2.bmby.com/ipbx/agents.php*
// @match        http://82.166.228.179/ipbx/agents.php*
// @match        http://82.166.228.180/ipbx/agents.php*
// @match        http://voip.bmby.com/ipbx/ivr_edit.php*
// @match        http://voip2.bmby.com/ipbx/ivr_edit.php*
// @match        http://82.166.228.179/ipbx/ivr_edit.php*
// @match        http://82.166.228.180/ipbx/ivr_edit.php*
// @connect      www.bmby.com
// @connect      bmby.com
// @connect      voip.bmby.com
// @connect      voip2.bmby.com
// @connect      82.166.228.179
// @connect      82.166.228.180
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @require      https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js
// ==/UserScript==

// Global CSS.escape polyfill (shared across NIHUL + parsers)
var cssEscape = (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function')
  ? CSS.escape.bind(CSS)
  : function (value) {
      var str = String(value);
      return str.replace(/[^a-zA-Z0-9_-]/g, function (ch) {
        var hex = ch.codePointAt(0).toString(16).toUpperCase();
        return "\\" + hex + " ";
      });
    };


function __bootNIHUL_DASHBOARD__(){
  // -------------------- ProjectsBoards Auto-Highlight (embedded helper) --------------------
  (function bmbyProjectsBoardsAutoHighlight() {
    const PB_TAG = "[PB-AUTO 0.1.8]";
    const log = (...a) => { try { console.log(PB_TAG, ...a); } catch {} };

    try {
      if (!/\/nihul\/ProjectsBoards\.php/i.test(location.pathname)) return;

      const norm = (s) => String(s ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/[\s\u200e\u200f]+/g, " ")
        .trim();

      const normalizePid = (input) => {
        const m = String(input || "").trim().match(/\d+/);
        return m ? m[0] : null;
      };

      const getPidFromUrl = () => {
        try {
          const u = new URL(location.href);
          return u.searchParams.get("BoardProjectID") || u.searchParams.get("ProjectID");
        } catch { return null; }
      };

      const ensureStyles = () => {
        if (document.getElementById("bmbyPBHLStyle")) return;
        const st = document.createElement("style");
        st.id = "bmbyPBHLStyle";
        st.textContent = `
          .bmbyPBHL_auto{
            outline:3px solid rgba(0,140,255,.9) !important;
            box-shadow:0 0 0 6px rgba(0,140,255,.18) !important;
            background:rgba(255, 235, 140, .65) !important;
          }
          .bmbyPBHL_auto td, .bmbyPBHL_auto th{ background:transparent !important; }
          #bmbyPBToast{
            position:fixed;right:16px;bottom:16px;z-index:2147483647;
            padding:8px 10px;border-radius:12px;border:1px solid rgba(0,0,0,.12);
            background:rgba(255,255,255,.97);font:900 12px Arial;
            box-shadow:0 10px 25px rgba(0,0,0,.18);
            display:none;
          }
        `;
        (document.head || document.documentElement).appendChild(st);
      };

      function toast(msg) {
        ensureStyles();
        let el = document.getElementById("bmbyPBToast");
        if (!el) {
          el = document.createElement("div");
          el.id = "bmbyPBToast";
          (document.body || document.documentElement).appendChild(el);
        }
        el.textContent = msg;
        el.style.display = "block";
        clearTimeout(toast._t);
        toast._t = setTimeout(() => (el.style.display = "none"), 2200);
      }

      function clearHL() {
        document.querySelectorAll(".bmbyPBHL_auto").forEach((tr) => tr.classList.remove("bmbyPBHL_auto"));
      }

      function findHeaderCell(table) {
        const rows = Array.from(table.querySelectorAll("tr"));
        for (const tr of rows) {
          const ths = Array.from(tr.querySelectorAll("th"));
          for (const th of ths) {
            if (norm(th.textContent).toLowerCase().includes("boardproject")) return { tr, th };
          }
        }
        return null;
      }

      function findRow(pid) {
        const tables = Array.from(document.querySelectorAll("table"));
        for (const table of tables) {
          const hdr = findHeaderCell(table);
          if (!hdr) continue;

          const colIndex = hdr.th.cellIndex;
          const allRows = Array.from(table.querySelectorAll("tr"));
          const startIdx = allRows.indexOf(hdr.tr) + 1;

          for (let i = Math.max(0, startIdx); i < allRows.length; i++) {
            const tr = allRows[i];
            const kids = Array.from(tr.children).filter((el) => el && (el.tagName === "TD" || el.tagName === "TH"));
            const cell = kids[colIndex] || tr.children[colIndex];
            if (cell && norm(cell.textContent) === String(pid)) return tr;
          }
        }
        return null;
      }

      function highlight(pid) {
        const p = normalizePid(pid);
        if (!p) return false;
        ensureStyles();
        clearHL();
        const row = findRow(p);
        if (!row) return false;
        row.classList.add("bmbyPBHL_auto");
        try { row.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
        return true;
      }


      function addParamToUrl(url, key, val) {
        try {
          const u = new URL(url, location.origin);
          u.searchParams.set(key, String(val));
          return u.toString();
        } catch {
          try {
            // fallback: if it's a relative query string like "?Page=2..."
            if (String(url || "").trim().startsWith("?")) {
              const u = new URL(location.origin + location.pathname + url);
              u.searchParams.set(key, String(val));
              return u.toString();
            }
          } catch {}
          return String(url || "");
        }
      }

      function getPaginationUrls() {
        const urls = [];
        // pattern: "עבור לדף:" select onchange="window.location=this.value;"
        const selects = Array.from(document.querySelectorAll('select[onchange*="window.location"]'));
        for (const sel of selects) {
          for (const opt of Array.from(sel.options || [])) {
            const v = String(opt.value || "").trim();
            if (!v) continue;
            if (v.includes("Page=") || v.startsWith("?")) urls.push(v);
          }
        }
        // next link "הדף הבא"
        const nextA = Array.from(document.querySelectorAll('a[href*="Page="]')).find(a => norm(a.textContent).includes("הדף הבא"));
        if (nextA) urls.push(nextA.getAttribute("href") || "");
        // normalize & unique
        const out = [];
        for (const u of urls) {
          const uu = String(u || "").trim();
          if (!uu) continue;
          const abs = uu.startsWith("http") ? uu : (uu.startsWith("?") ? (location.origin + location.pathname + uu) : new URL(uu, location.href).toString());
          if (!out.includes(abs)) out.push(abs);
        }
        return out;
      }

      function maybeAdvanceToNextPage(pid) {
        try {
          const p = normalizePid(pid);
          if (!p) return false;

          const key = "bmby_pb_tried_" + p;
          const tried = (() => {
            try { return JSON.parse(sessionStorage.getItem(key) || "[]"); } catch { return []; }
          })();

          const pages = getPaginationUrls();
          if (!pages.length) return false;

          // mark current page tried
          const cur = addParamToUrl(location.href, "BoardProjectID", p);
          if (!tried.includes(cur)) tried.push(cur);

          // choose first untried page
          const next = pages
            .map(u => addParamToUrl(u, "BoardProjectID", p))
            .find(u => !tried.includes(u));

          sessionStorage.setItem(key, JSON.stringify(tried));

          if (!next) {
            toast("⚠️ לא נמצא בשום עמוד (בדוק פילטרים/סטטוס)");
            // cleanup
            try { sessionStorage.removeItem(key); } catch {}
            return false;
          }

          toast("➡️ עובר לעמוד הבא לחיפוש...");
          log("Advancing page. next:", next);
          setTimeout(() => { try { location.href = next; } catch {} }, 350);
          return true;
        } catch (e) {
          log("maybeAdvanceToNextPage error", e);
          return false;
        }
      }

      function tryApplyTableSearch(pid) {
        const candidates = [
          "#DataTables_Table_0_filter input",
          "div.dataTables_filter input",
          "input[type='search']",
          "input[aria-controls*='Table']",
        ];
        for (const sel of candidates) {
          const inp = document.querySelector(sel);
          if (!inp) continue;
          inp.focus();
          inp.value = String(pid);
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          inp.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
          log("Applied table search via", sel);
          toast("מסנן טבלה: " + pid);
          return true;
        }
        return false;
      }

      async function run() {
        const pid = normalizePid(getPidFromUrl());
        if (!pid) return;

        log("Start auto highlight for", pid, "url:", location.href);
        toast("מחפש BoardProjectID=" + pid + "...");

        // Phase 1
        for (let i = 0; i < 80; i++) {
          if (highlight(pid)) {
            toast("✅ נצבע: " + pid);
            log("Highlighted in phase1 try", i + 1);
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }

        // Phase 2 (pagination/filter)
        if (!document.querySelector(".bmbyPBHL_auto")) {
          const applied = tryApplyTableSearch(pid);
          if (applied) {
            for (let i = 0; i < 60; i++) {
              if (highlight(pid)) {
                toast("✅ נצבע אחרי סינון: " + pid);
                log("Highlighted after filter try", i + 1);
                break;
              }
              await new Promise((r) => setTimeout(r, 250));
            }
          }
        }

        // Phase 3 (replacement)
        const until = Date.now() + 20000;
        const obs = new MutationObserver(() => {
          if (Date.now() > until) { try { obs.disconnect(); } catch {} return; }
          if (document.querySelector(".bmbyPBHL_auto")) return;
          highlight(pid);
        });

        try { obs.observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch {}
        setTimeout(() => { try { obs.disconnect(); } catch {} }, 20200);

        // Phase 4 (classic pagination: go to next page until found)
        if (!document.querySelector(".bmbyPBHL_auto")) {
          const didNav = maybeAdvanceToNextPage(pid);
          if (didNav) return; // navigation started
        }

        if (!document.querySelector(".bmbyPBHL_auto")) {
          log("Not highlighted yet. tables:", document.querySelectorAll("table").length);
          toast("⚠️ לא מצאתי עדיין (בדוק קונסול)");
        }
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run, { once: true });
      } else {
        run();
      }
    } catch (e) {
      try { console.error(PB_TAG, e); } catch {}
    }
  })();


  (() => {
    "use strict";



  // --- SAFETY: remove any leftover GLOBAL ADMIN UI (from old scripts) ---
  try {
    const ids = ["bmby-admin-controls", "bmby-admin-run-btn", "bmby-admin-status-box"];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
  } catch (e) {}
const BMBY_GLOBAL_UID_TO_HIGHLIGHT = "BMBY_GLOBAL_UID_TO_HIGHLIGHT";

    function getGlobalUidToHighlight(){
      try{
        const raw = localStorage.getItem(BMBY_GLOBAL_UID_TO_HIGHLIGHT);
        const m = String(raw||"").match(/\d+/);
        return m ? m[0] : null;
      }catch(e){ return null; }
    }

    function clearGlobalUidToHighlight(){
      try{ localStorage.removeItem(BMBY_GLOBAL_UID_TO_HIGHLIGHT); }catch(e){}
    }

    function highlightUserRowByUserId(uid){
      uid = normDigits(uid);
      if (!uid) return false;

      // Ensure highlight CSS exists even if the dashboard UI/CSS wasn't injected on this page
      try { if (typeof usEnsureHLStyle === "function") usEnsureHLStyle(); } catch(e) {}

      // Clear previous highlights
      try { document.querySelectorAll("tr.bmbyUserHL").forEach(tr => tr.classList.remove("bmbyUserHL")); } catch {}

      const needle1 = "UserID=" + uid;
      const needle2 = "UserID%3D" + uid; // defensive (rare encoding)
      const needle3 = "userid=" + uid;   // defensive casing

      const candidates = Array.from(document.querySelectorAll("[href],[onclick]"));
      let bestEl = null;

      for (const el of candidates){
        const h = ((el.getAttribute("href")||"") + " " + (el.getAttribute("onclick")||"")).replace(/\s+/g," ");
        if (!h) continue;

        // Prefer explicit EditUser links
        if ((/EditUser\.php/i.test(h) || /preferences\/EditUser\.php/i.test(h)) &&
            (h.includes(needle1) || h.includes(needle2) || h.toLowerCase().includes(needle3))) {
          bestEl = el;
          break;
        }

        // Fallback: any appearance of the uid in a "UserID=" pattern
        if (h.includes(needle1) || h.includes(needle2) || h.toLowerCase().includes(needle3)) {
          bestEl = bestEl || el;
        }
      }

      if (!bestEl) return false;

      let row = bestEl.bmbyGetRowFromAny() || (bestEl.closest ? (bestEl.closest('td')?.parentElement || bestEl.closest('tr')) : null);
      if (!row) return false;
      try {
        row.classList.add("bmbyUserHL");
        // Belt-and-suspenders: force visible even if page CSS is weird
        row.style.outline = "4px solid rgba(0,255,140,0.95)";
        row.style.background = "rgba(0,255,140,0.12)";
      } catch {
        // ultra fallback
        try {
          row.style.outline = "4px solid rgba(0,255,140,0.95)";
          row.style.background = "rgba(0,255,140,0.12)";
        } catch {}
      }

      try { row.scrollIntoView({behavior:"smooth", block:"center"}); } catch {}
      return true;
    }

    // Fallback: if UserID is not present in live DOM attributes, fetch raw HTML of this page,
    // locate the matching row in the parsed HTML, then highlight the same row index in the live DOM.
    async function fetchAndHighlightUserRowByUserId(uid){
      uid = normDigits(uid);
      if (!uid) return false;

      const needleRe = new RegExp("(?:UserID\\s*=\\s*|userid\\s*=\\s*)"+uid, "i");

      let html = "";
      try{
        const r = await fetch(location.href, {credentials:"include", cache:"no-store"});
        if (!r.ok) return false;
        html = await r.text();
      }catch(e){ return false; }

      // Quick reject
      if (!needleRe.test(html)) return false;

      // Parse HTML to find the TR index inside the largest table
      let doc;
      try{
        doc = new DOMParser().parseFromString(html, "text/html");
      }catch(e){ return false; }

      const tables = Array.from(doc.querySelectorAll("table"));
      if (!tables.length) return false;

      const scored = tables.map(t => {
        const trs = Array.from(t.querySelectorAll("tr"));
        const score = trs.length;
        return {t, trs, score};
      }).sort((a,b)=>b.score-a.score);

      const best = scored[0];
      const trs = best.trs;

      let hitIndex = -1;
      for (let i=0;i<trs.length;i++){
        const tr = trs[i];
        const blob = tr.outerHTML || "";
        if (needleRe.test(blob) || /EditUser\.php/i.test(blob) && needleRe.test(blob)){
          hitIndex = i;
          break;
        }
      }
      if (hitIndex < 0) return false;

      // Find the matching live table (largest table) and highlight same index
      const liveTables = Array.from(document.querySelectorAll("table"));
      if (!liveTables.length) return false;

      const liveBest = liveTables
        .map(t => ({t, trs: Array.from(t.querySelectorAll("tr")), score: t.querySelectorAll("tr").length}))
        .sort((a,b)=>b.score-a.score)[0];

      const liveTrs = liveBest.trs;
      if (hitIndex >= liveTrs.length) return false;

      const liveRow = liveTrs[hitIndex];
      if (!liveRow) return false;

      try { if (typeof usEnsureHLStyle === "function") usEnsureHLStyle(); } catch(e) {}

      try { document.querySelectorAll("tr.bmbyUserHL").forEach(tr => tr.classList.remove("bmbyUserHL")); } catch {}

      try{
        liveRow.classList.add("bmbyUserHL");
        liveRow.style.outline = "4px solid rgba(0,255,140,0.95)";
        liveRow.style.background = "rgba(0,255,140,0.12)";
        try { liveRow.scrollIntoView({behavior:"smooth", block:"center"}); } catch {}
        return true;
      }catch(e){
        return false;
      }
    }


    function maybeAutoHighlightGlobalUid(){
      try{
        if (!/\/nihul\/AddProject2\.php/i.test(location.pathname)) return;

        const uid = getGlobalUidToHighlight();
        if (!uid) return;

        // Keep trying longer + observe DOM mutations (Users page often renders late / via scripts)
        const startedAt = Date.now();
        const TIME_LIMIT_MS = 25000;

        let done = false;
        let fetchTried = false;

        const attempt = () => {
          if (done) return true;
          const ok = highlightUserRowByUserId(uid);
          if (ok){
            done = true;
            toast("✅ סומן UserID=" + uid, "ok", 5000);
            clearGlobalUidToHighlight();
            try { obs.disconnect(); } catch {}
            return true;
          }
  // Fallback once: fetch raw HTML and map row index to live DOM
          if (!done && !fetchTried){
            fetchTried = true;
            fetchAndHighlightUserRowByUserId(uid).then((ok2)=>{
              if (ok2 && !done){
                done = true;
                toast("✅ סומן UserID=" + uid, "ok", 5000);
                clearGlobalUidToHighlight();
                try { obs.disconnect(); } catch {}
              }
            }).catch(()=>{});
          }
          return false;
        };

        // Fast initial tries
        let tries = 0;
        const tick = () => {
          if (done) return;
          tries++;
          attempt();

          // Stop conditions
          if (done) return;
          if (Date.now() - startedAt > TIME_LIMIT_MS) {
            toast("⚠️ לא הצלחתי לסמן אוטומטית UserID=" + uid + " (הטבלה לא נטענה / מבנה שונה).", "warn", 7000);
            try { obs.disconnect(); } catch {}
            return;
          }

          // keep polling
          setTimeout(tick, tries < 30 ? 200 : 450);
        };

        // Mutation observer for late DOM
        const obs = new MutationObserver(() => {
          if (done) return;
          attempt();
          if (Date.now() - startedAt > TIME_LIMIT_MS) {
            try { obs.disconnect(); } catch {}
          }
        });

        try { obs.observe(document.body || document.documentElement, { childList:true, subtree:true }); } catch {}

        // kick off
        setTimeout(tick, 150);
      }catch(e){}
    }


    // Safety shim: some builds reference this; never allow it to crash the script.
    function pbAutoHighlightFromStore(){ return; }


    // PROD default: quiet. To debug, set Store.set('DBG', true) from console.
    const DBG = false;
    const log = (...a) => { if (DBG) console.log('[BMBY-DASH]', ...a); };

  // ===== Row helper: reliably climb to the <tr> from any element (used by username/userId flows) =====
  try {
    if (typeof Element !== "undefined" && Element.prototype && !Element.prototype.bmbyGetRowFromAny) {
      Element.prototype.bmbyGetRowFromAny = function() {
        const el = this;
        try {
          if (!el) return null;
          if (el.tagName && el.tagName.toUpperCase() === "TR") return el;
          if (el.closest) {
            const tr = el.closest("tr");
            if (tr) return tr;
            // common BMBY tables: sometimes the clickable element sits in <td> (or nested div) – climb via td -> tr
            const td = el.closest("td");
            if (td && td.parentElement && td.parentElement.tagName && td.parentElement.tagName.toUpperCase() === "TR") {
              return td.parentElement;
            }
          }
          // brute climb
          let p = el.parentElement;
          while (p && p !== document.body) {
            if (p.tagName && p.tagName.toUpperCase() === "TR") return p;
            p = p.parentElement;
          }
          return null;
        } catch { return null; }
      };
    }
  } catch {}



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
    const PROD_PREFIX = "BMBY__";
    const HasGM =
      typeof GM_getValue === "function" &&
      typeof GM_setValue === "function" &&
      typeof GM_deleteValue === "function";

    const Store = {
      get(k, fallback = null) {
        const key = PROD_PREFIX + k;
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
        const key = PROD_PREFIX + k;
        try {
          if (HasGM) return GM_setValue(key, v);
          localStorage.setItem(key, JSON.stringify(v));
        } catch {}
      },
      del(k) {
        const key = PROD_PREFIX + k;
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
      dashId: "bmby-prod-dash",
      backdropId: "bmby-prod-backdrop",
      btnId: "bmby-prod-openbtn",
      cssId: "bmby-prod-style",
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
  .bmby-pill.prod{ border-color: rgba(124,58,237,.35); background: rgba(124,58,237,.08); color:#3b1d9a; }

  .bmby-tabs, .bmby-cats{
    display:flex; gap:8px; padding:10px 14px; flex-wrap:wrap;
  }
  .bmby-cats{
    padding-bottom:6px;
    border-bottom:1px solid var(--bmby-border);
    background:linear-gradient(180deg,#fafbff 0%, #f7f8fb 100%);
  }
  .bmby-tabs{
    padding-top:8px;
  }
  .bmby-tab{
    padding:8px 10px; border-radius:999px;
    border:1px solid var(--bmby-border);
    background:#fff; cursor:pointer;
    font:800 12px/1 var(--bmby-font);
  }
  .bmby-tab.active{ border-color: rgba(37,99,235,.35); background: rgba(37,99,235,.08); color:#0b3aa6; }
  .bmby-tab.group{
    font-weight:900;
    background:rgba(124,58,237,.06);
    border-color:rgba(124,58,237,.18);
    color:#4c1d95;
  }
  .bmby-tab.group.active{
    background:rgba(124,58,237,.12);
    border-color:rgba(124,58,237,.34);
    color:#3b1d9a;
  }

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
      b.textContent = "BMBY PROD";
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
      { id: "voip", label: "VOIP", group: "telephony" },
      { id: "extensions", label: "שלוחות", group: "telephony" },
      { id: "passwords", label: "סיסמאות", group: "interfaces" },
      { id: "boards", label: "Boards", group: "interfaces" },
      { id: "dictionary", label: "מילון", group: "interfaces" },
      { id: "users", label: "משתמשים", group: "general" },
      { id: "editproject", label: "פרויקט", group: "general" },
    ];

    const TAB_GROUPS = [
      { id: "telephony", label: "טלפוניה" },
      { id: "interfaces", label: "ממשקים" },
      { id: "general", label: "כללי" },
    ];

    function getTabDef(tabId) {
      return TABS.find(t => t.id === tabId) || null;
    }

    function getGroupForTab(tabId) {
      return getTabDef(tabId)?.group || "telephony";
    }

    function getTabsForGroup(groupId) {
      return TABS.filter(t => t.group === groupId);
    }

    function renderGroupTabs(activeGroup, activeTabId) {
      const dash = document.getElementById(UI.dashId);
      if (!dash) return;

      const catsEl = dash.querySelector('[data-x="categories"]');
      const tabsEl = dash.querySelector('[data-x="tabs"]');
      if (!catsEl || !tabsEl) return;

      catsEl.innerHTML = "";
      for (const g of TAB_GROUPS) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "bmby-tab group" + (g.id === activeGroup ? " active" : "");
        btn.textContent = g.label;
        btn.dataset.group = g.id;
        btn.addEventListener("click", () => {
          const firstTab = getTabsForGroup(g.id)[0]?.id || "voip";
          setActiveTab(firstTab);
        });
        catsEl.appendChild(btn);
      }

      tabsEl.innerHTML = "";
      for (const t of getTabsForGroup(activeGroup)) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "bmby-tab" + (t.id === activeTabId ? " active" : "");
        btn.textContent = t.label;
        btn.dataset.tab = t.id;
        btn.addEventListener("click", () => setActiveTab(t.id));
        tabsEl.appendChild(btn);
      }
    }

    function buildDashboard() {
      if (document.getElementById(UI.dashId)) return;

      ensureBackdrop();

      const dash = document.createElement("div");
      dash.id = UI.dashId;

      dash.innerHTML = `
        <div class="bmby-header">
          <span class="bmby-pill prod">PROD</span>
          <span class="bmby-pill">דשבורד טלפוניה (PROD)</span>
          <span style="margin-right:auto"></span>
          <button class="bmby-btn secondary" data-x="close">סגור</button>
        </div>
        <div class="bmby-cats" data-x="categories"></div>
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

      const saved = Store.get("activeTab", "voip");
      setActiveTab(saved);

      // (PROD) no dev-mode outline
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
      const safeTabId = getTabDef(tabId)?.id || "voip";
      Store.set("activeTab", safeTabId);

      const dash = document.getElementById(UI.dashId);
      if (!dash) return;

      const activeGroup = getGroupForTab(safeTabId);
      renderGroupTabs(activeGroup, safeTabId);

      const panel = dash.querySelector('[data-x="panel"]');
      if (!panel) return;

      if (safeTabId === "voip") panel.innerHTML = renderVoipPanel();
      else if (safeTabId === "passwords") panel.innerHTML = renderPasswordsPanel();
      else if (safeTabId === "extensions") panel.innerHTML = renderExtensionsPanel();
      else if (safeTabId === "users") panel.innerHTML = renderUsersPanel();
      else if (safeTabId === "editproject") panel.innerHTML = renderEditProjectPanel();
      else if (safeTabId === "boards") panel.innerHTML = renderBoardsPanel();
      else if (safeTabId === "dictionary") panel.innerHTML = renderDictionaryPanel();
      else panel.innerHTML = renderComingSoon(safeTabId);

      if (safeTabId === "voip") bindVoipPanel(panel);
      if (safeTabId === "passwords") bindPasswordsPanel(panel);
      if (safeTabId === "extensions") bindExtensionsPanel(panel);
      if (safeTabId === "users") bindUsersPanel(panel);
      if (safeTabId === "editproject") bindEditProjectPanel(panel);
      if (safeTabId === "boards") bindBoardsPanel(panel);
      if (safeTabId === "dictionary") bindDictionaryPanel(panel);
    }


  /*****************************************************************
   * PROJECT: EditProject Extractor (background fetch)
   *****************************************************************/
  function renderEditProjectPanel() {
    return `
      <div style="font:900 14px/1.2 var(--bmby-font);">חילוץ נתונים מפרויקט (EditProject)</div>
      <div class="bmby-small">מזינים מספר פרויקט (P1234 / 1234) ➜ שליפה ברקע ➜ שם פרויקט / סטטוס / איש מכירות (Bmby)</div>

      <div class="bmby-row" style="margin-top:10px; gap:8px; align-items:center;">
        <input class="bmby-input" data-x="pid" placeholder="מספר פרויקט (P1234 או 1234)" style="flex:1; min-width:160px;">
        <button class="bmby-btn" data-x="run">חפש</button>
        <button class="bmby-btn secondary" data-x="copyLine" title="העתק שורה קצרה">Copy</button>
      </div>

      <div class="bmby-row" style="margin-top:8px; gap:8px; align-items:center;">
        <input class="bmby-input" data-x="cid" placeholder="CompanyID (לסריקה)" style="flex:1; min-width:140px;">
        <button class="bmby-btn" data-x="scanCompany" title="סרוק את כל הפרויקטים של החברה">סרוק חברה</button>
        <button class="bmby-btn danger" data-x="stopCompany" title="עצור סריקה" disabled>STOP</button>
        <button class="bmby-btn secondary" data-x="exportCompany" title="ייצוא לאקסל (XLSX)" disabled>Export XLSX</button>
      </div>

      <div class="bmby-card" style="margin-top:10px; padding:10px;">
        <div class="bmby-small muted" style="margin-bottom:6px;">תוצאות סריקת חברה</div>
        <div data-x="scanWrap" style="max-height:220px; overflow:auto; border:1px solid rgba(255,255,255,.08); border-radius:10px;">
          <table data-x="scanTable" style="width:100%; border-collapse:collapse; font:700 12px/1.35 var(--bmby-font);">
            <thead>
              <tr style="position:sticky; top:0; background:rgba(0,0,0,.25); backdrop-filter: blur(6px);">
                <th style="text-align:right; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,.08);">Project</th>
                <th style="text-align:right; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,.08);">שם פרויקט</th>
                <th style="text-align:right; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,.08);">רשיונות</th>
                <th style="text-align:right; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,.08);">משתמשים</th>
                <th style="text-align:right; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,.08);">מצב</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      </div>

      <div class="bmby-card" style="margin-top:10px; padding:10px;">
        <div class="bmby-small muted" data-x="status">מוכן.</div>
        <div style="margin-top:8px; display:grid; grid-template-columns:140px 1fr; gap:6px 10px;">
          <div class="bmby-small muted">ProjectID</div><div data-x="outPid" style="font-weight:900;">—</div>
          <div class="bmby-small muted">CompanyID</div><div data-x="outCid" style="font-weight:900;">—</div>
          <div class="bmby-small muted">שם חברה</div><div data-x="outCompany" style="font-weight:900;">—</div>
          <div class="bmby-small muted">שם הפרויקט</div><div data-x="outName" style="font-weight:900;">—</div>
          <div class="bmby-small muted">סטאטוס</div><div data-x="outStatus" style="font-weight:900;">—</div>
          <div class="bmby-small muted">איש מכירות (Bmby)</div><div data-x="outSales" style="font-weight:900;">—</div>
          <div class="bmby-small muted">תאריך סיום</div><div data-x="outDue" style="font-weight:900;">—</div>
          <div class="bmby-small muted">רשיונות</div><div data-x="outLic" style="font-weight:900;">—</div>
          <div class="bmby-small muted">משתמשים</div><div data-x="outUsers" style="font-weight:900;">—</div>
          <div class="bmby-small muted">EditProject</div><div><a href="#" data-x="outLink">Link</a></div>
        </div>
      </div>
    `;
  }

  function normalizePidLite(input) {
    const m = String(input || "").trim().match(/\d+/);
    return m ? m[0] : null;
  }


    // === Global UserID scan helpers (Wizard Company paging) ===
    function normDigits(s){ const m = String(s||"").match(/\d+/); return m?m[0]:null; }

    function parseProjectIdsFromWizardHtml(html){
      const ids = new Set();
      if (!html) return [];
      const s = String(html);

      // Direct ProjectID
      for (const mm of s.matchAll(/ProjectID=(\d+)/gi)) ids.add(mm[1]);

      // FindedProjects list (single or csv, sometimes encoded)
      for (const mm of s.matchAll(/FindedProjects=([^&"'<> \t\r\n]+)/gi)) {
        let raw = mm[1] || "";
        try { raw = decodeURIComponent(raw); } catch(e) {}
        for (const n of raw.split(/[^0-9]+/).filter(Boolean)) ids.add(n);
      }
      return [...ids];
    }

    function parseWizardPageOptions(html){
      try{
        const doc = new DOMParser().parseFromString(String(html||""), "text/html");
        const sel = Array.from(doc.querySelectorAll("select[onchange*='window.location']")).find(x=> (x.innerHTML||"").includes("Page="));
        if (!sel) return [];
        const vals = Array.from(sel.querySelectorAll("option[value]")).map(o => o.getAttribute("value")||"").filter(Boolean);
        const abs = [];
        for (const v of vals){
          try{
            const u = new URL(v, location.href);
            abs.push(u.href);
          }catch(e){}
        }
        return [...new Set(abs)];
      }catch(e){
        return [];
      }
    }

    async function getProjectIdsForCompany(companyId){
      const cid = normDigits(companyId);
      if (!cid) return [];
      const baseUrl = `${location.origin}/nihul/Wizard.php?CompanyID=${encodeURIComponent(cid)}`;
      const res = await fetch(baseUrl, {credentials:"include"});
      if (!res.ok) throw new Error("Wizard company fetch failed: " + res.status);
      const html1 = await res.text();

      const pages = parseWizardPageOptions(html1);
      const allPages = (pages && pages.length) ? pages : [baseUrl];
      const seenIds = new Set();

      // include first page
      parseProjectIdsFromWizardHtml(html1).forEach(id=>seenIds.add(id));

      for (const url of allPages){
        if (url === baseUrl) continue;
        try{
          const r = await fetch(url, {credentials:"include"});
          if (!r.ok) continue;
          const h = await r.text();
          parseProjectIdsFromWizardHtml(h).forEach(id=>seenIds.add(id));
        }catch(e){}
      }
      return [...seenIds];
    }

    async function findUserIdInCompanyProjects(companyId, userId, onProgress){
      const cid = normDigits(companyId);
      const uid = normDigits(userId);
      if (!cid || !uid) return {found:false};

      const projectIds = await getProjectIdsForCompany(cid);
      if (onProgress) onProgress({phase:"projects", count: projectIds.length});

      for (let i=0;i<projectIds.length;i++){
        const pid = projectIds[i];
        if (onProgress) onProgress({phase:"scan", index:i+1, total:projectIds.length, pid});
        const url = `${location.origin}/nihul/AddProject2.php?ProjectID=${encodeURIComponent(pid)}&CompanyID=${encodeURIComponent(cid)}&BrokerageProject=no`;
        try{
          const r = await fetch(url, {credentials:"include"});
          if (!r.ok) continue;
          const html = await r.text();
          if (html.includes("UserID=" + uid) || html.includes("EditUser.php?UserID=" + uid)){
            return {found:true, companyId: cid, projectId: pid, usersUrl: url};
          }
        }catch(e){}
      }
      return {found:false, companyId: cid, projectCount: projectIds.length};
    }


  function normTextLite(s) {
    return String(s || "")
      .replace(/\u00a0/g, " ")
      .replace(/[\s\u200e\u200f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }



async function fetchCompanyIdForPid_Wizard(pid) {
    const q = "P" + String(pid);
    const url = location.origin + "/nihul/Wizard.php?q=" + encodeURIComponent(q);
    const html = await fetchTextSmart(url);
    const doc = new DOMParser().parseFromString(html, "text/html");

    const norm = (s) => String(s || "")
      .replace(/[\s\u00a0\u200e\u200f]+/g, " ")
      .trim();

    // There may be multiple TDs with the same onclick (name cell + icon cells).
    const tds = Array.from(doc.querySelectorAll("td[onclick]"));
    const matches = tds.filter((x) => {
      const oc = x.getAttribute("onclick") || "";
      return oc.includes("Wizard.php") &&
             oc.includes("CompanyID=") &&
             oc.includes("FindedProjects=") &&
             oc.includes(String(pid));
    });

    if (!matches.length) return { companyId: null, companyName: null };

    // CompanyID from any matched onclick
    const oc0 = matches[0].getAttribute("onclick") || "";
    const mm = oc0.match(/CompanyID=(\d+)/i);
    const companyId = mm ? mm[1] : null;

    // Choose the best cell for company name: prefer Hebrew letters, then longest meaningful text.
    const scoreCell = (td) => {
      const raw = norm(td.textContent);
      if (!raw) return -1e9;
      if (/^\d+$/.test(raw)) return -1e6; // pure index
      const heb = (raw.match(/[\u0590-\u05FF]/g) || []).length;
      return heb * 20 + raw.length; // heb dominates
    };

    const bestTd = matches.slice().sort((a,b)=>scoreCell(b)-scoreCell(a))[0];
    const bestText = norm(bestTd?.textContent);
    const companyName = (bestText && !/^\d+$/.test(bestText)) ? bestText : null;

    return { companyId, companyName };
  }

function extractFromEditProjectHtml(html) {
  // Compatibility: in some builds bmbyGetRowFromAny is not attached to parser window (c.*)
  const __getRowFromAny = (typeof window !== 'undefined' && typeof window.bmbyGetRowFromAny === 'function')
    ? function(root, label){ return window.bmbyGetRowFromAny(root, label); }
    : (typeof bmbyGetRowFromAny === 'function' ? bmbyGetRowFromAny : function(root, label){
        // Fallback: search for a TR that contains the label (Heb/Eng) and return it
        try {
          const trs = root.querySelectorAll('tr');
          const needle = String(label||'').trim();
          for (const tr of trs) {
            const tx = (tr.textContent || '').replace(/\s+/g,' ').trim();
            if (needle && tx.includes(needle)) return tr;
          }
        } catch(e){}
        return null;
      });

  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");

  function getInputValueByNames(names){
    for (const n of names) {
      const el = doc.querySelector(`input[name="${cssEscape(n)}"], textarea[name="${cssEscape(n)}"]`);
      if (el && normTextLite(el.value)) return normTextLite(el.value);
      const sel = doc.querySelector(`select[name="${cssEscape(n)}"]`);
      if (sel) {
        const v = normTextLite(sel.options?.[sel.selectedIndex]?.textContent || sel.value);
        if (v) return v;
      }
    }
    return null;
  }

  function getValueFromRow(row){
    if (!row) return null;
    // Prefer readonly input
    const ro = row.querySelector('input[readonly]');
    if (ro && normTextLite(ro.value)) return normTextLite(ro.value);

    // Prefer normal input/select/textarea in the row (but skip hidden)
    const any = row.querySelector('input:not([type="hidden"]), select, textarea');
    if (any) {
      const v = any.tagName === 'SELECT'
        ? normTextLite(any.options?.[any.selectedIndex]?.textContent || any.value)
        : normTextLite(any.value);
      if (v) return v;
    }

    // Fallback: take text from the next TD
    const tds = row.querySelectorAll('td,th');
    if (tds && tds.length >= 2) {
      // Usually label is first cell, value is second/third
      for (let i=1;i<tds.length;i++){
        const tx = normTextLite(tds[i].textContent);
        if (tx) return tx;
      }
    }
    return null;
  }

  function findValueByLabels(labels){
    // Try direct row finder
    for (const lab of labels) {
      const row = __getRowFromAny(doc, lab);
      const v = getValueFromRow(row);
      if (v) return v;
    }

    // Try scanning cells and reading their row
    const cells = Array.from(doc.querySelectorAll('td,th'));
    for (const c of cells) {
      const t = normTextLite(c.textContent);
      if (!t) continue;
      for (const lab of labels) {
        if (t.includes(lab)) {
          const row = c.closest('tr') || __getRowFromAny(doc, lab);
          const v = getValueFromRow(row);
          if (v) return v;
        }
      }
    }
    return null;
  }

  // Project name (multiple fallbacks)
  const projectName =
    getInputValueByNames(['Project', 'ProjectName', 'Title', 'ProjectTitle']) ||
    normTextLite(doc.querySelector('input[name="Project"]')?.value) ||
    normTextLite(doc.querySelector('input[name="Title"]')?.value) ||
    normTextLite(doc.querySelector('h1')?.textContent) ||
    null;

  // Status (Active select)
  const statusSelect = doc.querySelector('select[name="Active"]');
  const status = statusSelect
    ? normTextLite(statusSelect.options?.[statusSelect.selectedIndex]?.textContent || statusSelect.value)
    : (getInputValueByNames(['Active']) || null);

  // Sales / Contact (label-based; some environments call it "איש קשר" or "איש מכירות")
  const sales = findValueByLabels([
    'איש מכירות (Bmby)',
    'איש מכירות',
    'איש קשר (Bmby)',
    'איש קשר',
    'מנהל מכירות',
  ]);


  // Licenses (base + additional) from selects under EditProject
  const baseSel = doc.querySelector('#NumberOfUsers, select[name="NumberOfUsers"]');
  const addSel  = doc.querySelector('#AdditionNumberOfUsers, #AdditionNumberOfUsers, select[name="AdditionNumberOfUsers"], select[name="AdditionNumberOfUsers"]');

  function getSelNum(sel){
    if (!sel) return null;
    const raw = String(sel.value || '').trim();
    let n = parseInt(raw, 10);
    if (!Number.isNaN(n)) return n;
    const opt = sel.selectedOptions && sel.selectedOptions[0];
    if (opt) {
      const t = String(opt.value || opt.textContent || '').trim();
      n = parseInt(t, 10);
      if (!Number.isNaN(n)) return n;
    }
    return null;
  }

  const licenseBase = getSelNum(baseSel);
  const licenseAdd  = getSelNum(addSel);
  const licenseTotal = (licenseBase !== null || licenseAdd !== null)
    ? ((licenseBase || 0) + (licenseAdd || 0))
    : null;

  // Due date (project end) – BMBY often splits to d_/m_/y_ fields
  const dDue = getInputValueByNames(['d_DueDate']);
  const mDue = getInputValueByNames(['m_DueDate']);
  const yDue = getInputValueByNames(['y_DueDate']);

  const pad2 = (n) => {
    const v = String(n ?? "").trim();
    if (!v) return "";
    return v.length === 1 ? ("0" + v) : v;
  };

  const dueFromParts = (dDue && mDue && yDue)
    ? `${pad2(dDue)}/${pad2(mDue)}/${String(yDue).trim()}`
    : null;

  const dueDate =
    dueFromParts ||
    getInputValueByNames(['d_DueDate', 'm_DueDate', 'y_DueDate', 'd_dueDate', 'm_dueDate', 'y_dueDate', 'DueDate']) ||
    findValueByLabels(['תאריך סיום', 'תאריך יעד', 'Due Date', 'End Date']) ||
    null;


return { projectName, status, salesBmby: sales, dueDate, licenseBase, licenseAdd, licenseTotal };
}

async function fetchTextSmart(url) {
    // Robust Hebrew decode using GM_xmlhttpRequest(arraybuffer) when available.
    const hasGM = (typeof GM_xmlhttpRequest === "function");
    if (!hasGM) {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("fetch failed: " + r.status);
      return await r.text();
    }

    const res = await new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        responseType: "arraybuffer",
        withCredentials: true,
        timeout: 45000,
        onload: (r) => resolve(r),
        onerror: () => reject(new Error("GM_xhr error")),
        ontimeout: () => reject(new Error("GM_xhr timeout")),
      });
    });

    const ab = res.response;
    const u8 = new Uint8Array(ab);
    const headersText = String(res.responseHeaders || "");
    const lcHeaders = headersText.toLowerCase();

    const charsetFromHeaders = () => {
      const mm = lcHeaders.match(/content-type:[^\n]*charset\s*=\s*([^\s;]+)/i);
      return mm ? mm[1].trim().toLowerCase() : null;
    };

    const charsetFromBytes = () => {
      const lim = Math.min(u8.length, 4096);
      let ascii = "";
      for (let i = 0; i < lim; i++) {
        const c = u8[i];
        ascii += (c >= 32 && c < 127) ? String.fromCharCode(c) : " ";
      }
      let m = ascii.match(/charset\s*=\s*["']?\s*([a-z0-9\-_]+)/i);
      if (m) return String(m[1]).toLowerCase();
      m = ascii.match(/content=["'][^"']*charset=([a-z0-9\-_]+)/i);
      if (m) return String(m[1]).toLowerCase();
      return null;
    };

    const decode = (enc) => {
      try { return new TextDecoder(enc, { fatal: false }).decode(u8); } catch { return null; }
    };

    const score = (s) => {
      if (s == null) return -1e9;
      const bad = (s.match(/\uFFFD/g) || []).length;
      const heb = (s.match(/[\u0590-\u05FF]/g) || []).length;
      const moj = (s.match(/×/g) || []).length;
      return heb * 3 - bad * 6 - moj * 2;
    };

    const candidates = [];
    const ch1 = charsetFromHeaders();
    const ch2 = charsetFromBytes();
    if (ch1) candidates.push(ch1);
    if (ch2) candidates.push(ch2);

    // Common for old Hebrew pages
    candidates.push("windows-1255", "iso-8859-8", "utf-8");

    const uniq = [];
    for (const c of candidates) {
      const cc = String(c || "").toLowerCase();
      if (cc && !uniq.includes(cc)) uniq.push(cc);
    }

    let best = null;
    for (const enc of uniq) {
      const t = decode(enc);
      const sc = score(t);
      if (!best || sc > best.score) best = { t, score: sc, enc };
    }

    return (best && best.t) || decode("utf-8") || "";
  }

  async function fetchEditProjectHtml(pid, cid) {
    const url = `${location.origin}/nihul/EditProject.php?ProjectID=${encodeURIComponent(pid)}&CompanyID=${encodeURIComponent(cid)}&BrokerageProject=no`;
    const html = await fetchTextSmart(url);
    return { url, html };
  }

  async function runEditProjectExtract(pidInput) {
    const pid = normalizePidLite(pidInput);
    if (!pid) throw new Error("INVALID_PID");
    const wiz = await fetchCompanyIdForPid_Wizard(pid);
    const cid = wiz?.companyId;
    const companyName = wiz?.companyName;
    if (!cid) return { ok: false, projectId: pid, companyId: null, error: "NO_COMPANYID" };

    const fetched = await fetchEditProjectHtml(pid, cid);
    const fields = extractFromEditProjectHtml(fetched.html);

    return {
      ok: true,
      companyName,
      projectId: pid,
      companyId: cid,
      editUrl: fetched.url,
      fields,
    };
  }

  function bindEditProjectPanel(panel) {
    const pidEl = panel.querySelector('[data-x="pid"]');
    const btnRun = panel.querySelector('[data-x="run"]');
    const btnCopy = panel.querySelector('[data-x="copyLine"]');
    const cidEl = panel.querySelector('[data-x="cid"]');
    const btnScanCompany = panel.querySelector('[data-x="scanCompany"]');
    const btnExportCompany = panel.querySelector('[data-x="exportCompany"]');
    const btnStopCompany = panel.querySelector('[data-x="stopCompany"]');
    const scanTable = panel.querySelector('[data-x="scanTable"]');
    const scanTbody = scanTable ? scanTable.querySelector("tbody") : null;
    const statusEl = panel.querySelector('[data-x="status"]');
    const outPid = panel.querySelector('[data-x="outPid"]');
    const outCid = panel.querySelector('[data-x="outCid"]');
    const outCompany = panel.querySelector('[data-x="outCompany"]');
    const outName = panel.querySelector('[data-x="outName"]');
    const outStatus = panel.querySelector('[data-x="outStatus"]');
    const outSales = panel.querySelector('[data-x="outSales"]');
    const outDue   = panel.querySelector('[data-x="outDue"]');
    const outLic = panel.querySelector('[data-x="outLic"]');
    const outUsers = panel.querySelector('[data-x="outUsers"]');
    const outLink = panel.querySelector('[data-x="outLink"]');

    let lastLine = "";
    let lastCompanyScan = [];
    let cancelCompanyScan = false;

    function escapeCsv(v){
      const s = String(v ?? "");
      if (/[",\n\r]/.test(s)) return "\"" + s.replace(/"/g, '""') + "\"";
      return s;
    }

    function downloadCsv(filename, rows){
      const bom = "\ufeff";
      const csv = rows.map(r=>r.map(escapeCsv).join(",")).join("\r\n");
      const blob = new Blob([bom + csv], {type:"text/csv;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1500);
    }

    function renderScanRows(list){
      if (!scanTbody) return;
      scanTbody.innerHTML = "";
      for (const r of list){
        const tr = document.createElement("tr");
        const td = (t)=>{ const x=document.createElement("td"); x.style.textAlign="right"; x.style.padding="6px 8px"; x.style.borderBottom="1px solid rgba(255,255,255,.06)"; x.textContent=t; return x; };
        tr.appendChild(td(String(r.projectId||"")));
        tr.appendChild(td(String(r.projectName||"")));
        tr.appendChild(td(String(r.licenseTotal??"")));
        tr.appendChild(td(String(r.usersTotal??"")));
        tr.appendChild(td(r.flag==="RED" ? "🚨" : "🟢"));
        scanTbody.appendChild(tr);
      }
    }

  async function fetchUsersCounts(companyId, projectId, onProgress){
  const logPrefix = "[BMBY-UsersCount]";
  const usersUrl = `/nihul/AddProject2.php?ProjectID=${encodeURIComponent(projectId)}&CompanyID=${encodeURIComponent(companyId)}&BrokerageProject=no`;
  const samples = [];
  const ids = [];
  const totals = { total: 0, inactive: 0, active: 0, unknown: 0, fetchErrors: 0 };
  let rawHit = false;

  const CFG = {
    concurrency: 1,
    perRequestDelayMs: 950,
    baseBackoffMs: 2500,
    maxBackoffMs: 30000,
    maxRetries429: 5,
    maxRetriesOther: 2,
    requestTimeoutMs: 20000,
    cooldownAfter429Ms: 12000,
    jitterMs: 450,
  };

  const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const withJitter = (ms) => Math.max(0, Math.round(ms + Math.random() * CFG.jitterMs));
  const parseRetryAfterMs = (res) => {
    try {
      const raw = res && res.headers && typeof res.headers.get === 'function' ? res.headers.get('Retry-After') : null;
      if (!raw) return 0;
      const num = Number(String(raw).trim());
      if (Number.isFinite(num) && num >= 0) return Math.round(num * 1000);
      const ts = Date.parse(raw);
      if (!Number.isNaN(ts)) return Math.max(0, ts - Date.now());
    } catch(e) {}
    return 0;
  };

  async function fetchTextWithTimeout(url, fetchOpts = {}, timeoutMs = CFG.requestTimeoutMs) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...fetchOpts, signal: ctrl.signal });
      const text = await res.text();
      return { ok: res.ok, status: res.status, text, headers: res.headers };
    } finally {
      clearTimeout(t);
    }
  }

  async function fetchWithRateLimitRetry(url, fetchOpts = {}, meta = {}) {
    const kind = meta.kind || 'request';
    const id = meta.id || null;
    const maxAttempts = 1 + Math.max(CFG.maxRetries429, CFG.maxRetriesOther);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const resp = await fetchTextWithTimeout(url, fetchOpts, CFG.requestTimeoutMs);

        if (resp.status === 429) {
          totals.fetchErrors++;
          const retryAfterMs = parseRetryAfterMs(resp);
          const expMs = Math.min(CFG.maxBackoffMs, CFG.baseBackoffMs * Math.pow(2, Math.min(attempt - 1, 6)));
          const waitMs = withJitter(Math.max(retryAfterMs || 0, expMs, CFG.cooldownAfter429Ms));
          if (samples.length < 25) samples.push({ id, status: 'rate-limit', kind, http: 429, attempt, waitMs, url });
          if (attempt > CFG.maxRetries429 + 1) return { ok: false, status: 429, text: resp.text, headers: resp.headers, gaveUp: true };
          console.warn(logPrefix, `${kind} 429`, { id, attempt, waitMs, url });
          if (typeof onProgress === 'function') {
            try { onProgress({ ...totals, done: totals.active + totals.inactive + totals.unknown, total: ids.length, rateLimited: true, currentId: id, waitMs }); } catch(_) {}
          }
          await sleepMs(waitMs);
          continue;
        }

        if (!resp.ok) {
          totals.fetchErrors++;
          if (attempt <= CFG.maxRetriesOther + 1 && resp.status >= 500) {
            const waitMs = withJitter(Math.min(CFG.maxBackoffMs, 1200 * attempt));
            if (samples.length < 20) samples.push({ id, status: 'retry-http', kind, http: resp.status, attempt, waitMs, url });
            await sleepMs(waitMs);
            continue;
          }
        }

        return resp;
      } catch (e) {
        totals.fetchErrors++;
        const isAbort = /abort/i.test(String(e || ''));
        if (attempt <= CFG.maxRetriesOther + 1) {
          const waitMs = withJitter(Math.min(CFG.maxBackoffMs, isAbort ? 1500 * attempt : 1000 * attempt));
          if (samples.length < 20) samples.push({ id, status: isAbort ? 'timeout-retry' : 'fetch-exception-retry', kind, attempt, waitMs, note: String(e), url });
          await sleepMs(waitMs);
          continue;
        }
        if (samples.length < 20) samples.push({ id, status: isAbort ? 'timeout' : 'fetch-exception', kind, note: String(e), url });
        return { ok: false, status: 0, text: '', error: String(e), gaveUp: true };
      }
    }

    return { ok: false, status: 0, text: '', gaveUp: true };
  }

  // 1) fetch Users page (AddProject2) HTML
  {
    const pageResp = await fetchWithRateLimitRetry(usersUrl, { credentials: "include", redirect: "follow", cache: "no-store" }, { kind: 'users-page' });
    const usersHtml = String(pageResp?.text || '');

    if(!pageResp?.ok){
      samples.push({ status:'users-page-fetch-error', http: pageResp?.status || 0, note: pageResp?.error || `users page status ${pageResp?.status || 0}`, usersUrl });
      console.warn(logPrefix, 'users page fetch error:', pageResp);
      return { ...totals, ids, samples, rawHit, usersUrl, debugSamples: samples, scanned: 0, limited: false };
    }

    // 2) extract UserIDs from HTML (works even when there are no explicit EditUser links)
    const seen = new Set();
    for(const m of usersHtml.matchAll(/EditUser\.php\?[^"'<>]*\bUserID=(\d{3,})\b/gi)){
      const id = m[1];
      if(!seen.has(id)){ seen.add(id); ids.push(id); }
    }

    if(ids.length === 0){
      const raw = [];
      for(const m of usersHtml.matchAll(/\bUserID=(\d{3,})\b/gi)) raw.push(m[1]);
      for(const m of usersHtml.matchAll(/\bUserID&#0*61;(\d{3,})\b/gi)) raw.push(m[1]);
      rawHit = raw.length > 0;
      for(const id of raw){
        if(!seen.has(id)){ seen.add(id); ids.push(id); }
      }
    }
  }

  totals.total = ids.length;

  if(ids.length === 0){
    samples.push({ status:'no-ids', note:'No UserID occurrences found on AddProject2 users page.', usersUrl });
    console.warn(logPrefix, 'No ids found.', { usersUrl });
    return { ...totals, ids, samples, rawHit, usersUrl, debugSamples: samples, scanned: 0, limited: false };
  }

  console.log(logPrefix, 'Found ids total:', totals.total, 'sample:', ids.slice(0,10));

  const hasDetails = (t) => /wrappUserDetails/i.test(t);
  const hasNotActive = (t) => /class\s*=\s*["']notActive["']/i.test(t);

  let idx = 0;
  let scanned = 0;
  let limited = false;

  async function worker(){
    while(true){
      const my = idx++;
      if(my >= ids.length) return;

      const id = ids[my];
      const url = `/preferences/EditUser.php?UserID=${encodeURIComponent(id)}&ProjectID=${encodeURIComponent(projectId)}&FromNihul=1`;

      if (my > 0) await sleepMs(withJitter(CFG.perRequestDelayMs));

      const r = await fetchWithRateLimitRetry(url, { credentials:'include', redirect:'follow', cache:'no-store' }, { kind: 'edit-user', id });
      const t = String(r?.text || '');
      scanned++;

      const detailsOk = hasDetails(t);
      const inactive = detailsOk && hasNotActive(t);

      if(!r?.ok){
        if(r?.status === 429) limited = true;
        if(samples.length < 20) samples.push({ id, status:'fetch-error', http:r?.status || 0, url });
      }else if(!detailsOk){
        totals.unknown++;
        if(samples.length < 20) samples.push({ id, status:'unknown', note:'No wrappUserDetails in response', len:t.length, url });
      }else if(inactive){
        totals.inactive++;
        if(samples.length < 50) samples.push({ id, status:'inactive', len:t.length, url });
      }else{
        totals.active++;
        if(samples.length < 20) samples.push({ id, status:'active', len:t.length, url });
      }

      if(typeof onProgress === 'function'){
        try{
          onProgress({
            ...totals,
            done: scanned,
            total: ids.length,
            scanned,
            currentId: id,
            remaining: Math.max(0, ids.length - scanned),
            limited,
          });
        }catch(_){}
      }
    }
  }

  const workers = [];
  for(let i=0;i<CFG.concurrency;i++) workers.push(worker());
  await Promise.all(workers);

  console.log(logPrefix, 'Done:', { inactive: totals.inactive, active: totals.active, unknown: totals.unknown, fetchErrors: totals.fetchErrors, limited, scanned });

  return { ...totals, ids, samples, rawHit, usersUrl, debugSamples: samples, scanned, limited };
}



    const setOut = (data) => {
      outPid.textContent = data?.projectId ? "P" + data.projectId : "—";
      outCid.textContent = data?.companyId || "—";
      if (outCompany) outCompany.textContent = data?.companyName || "—";
      outName.textContent = data?.fields?.projectName || "—";
      outStatus.textContent = data?.fields?.status || "—";
      outSales.textContent = data?.fields?.salesBmby || "—";
      if (outDue) outDue.textContent = data?.fields?.dueDate || "—";

      const baseN = data?.fields?.licenseBase;
      const addN = data?.fields?.licenseAdd;
      const totN = data?.fields?.licenseTotal;
      outLic.textContent = (totN !== null && totN !== undefined)
        ? `${totN} (בסיס: ${baseN || 0} + נוספים: ${addN || 0})`
        : "—";

      const ut = data?.fields?.usersTotal;
      const ua = data?.fields?.usersActive;
      const ui = data?.fields?.usersInactive;
      if (outUsers) {
        if (outUsers) outUsers.textContent = (ut !== null && ut !== undefined)
          ? `${ut} (פעילים: ${ua ?? "—"} | לא פעילים: ${ui ?? "—"})${(data?.fields?.usersRawHit ? " | rawHit: " + data.fields.usersRawHit : "")}${(data?.fields?.usersDebugSamples ? " | samples: " + data.fields.usersDebugSamples.length : "")}${(data?.fields?.usersUnknown ? " | לא ידוע: " + data.fields.usersUnknown : "")}${(data?.fields?.usersFetchErrors ? " | שגיאות: " + data.fields.usersFetchErrors : "")}${(data?.fields?.usersLimited ? " ⚠️ נסרקו רק " + data.fields.usersScanned : "")}`
          : "—";
      }



      // 🚨 License vs TOTAL Users indicator (Active + Inactive)
      try{
        const lic = (totN !== null && totN !== undefined) ? Number(totN) : null;

        const totalUsersNum =
          (ut !== null && ut !== undefined && String(ut).match(/\d+/))
            ? Number(String(ut).match(/\d+/)[0])
            : null;

        // reset styles
        if (outLic) {
          outLic.style.color = "";
          outLic.title = "";
        }
        if (outUsers) {
          outUsers.title = "";
        }

        if (lic !== null && !Number.isNaN(lic) &&
            totalUsersNum !== null && !Number.isNaN(totalUsersNum) &&
            lic < totalUsersNum){

          if (outLic) {
            outLic.style.color = "var(--bmby-danger)";
            outLic.title = `אזהרה: רשיונות (${lic}) קטן מסך המשתמשים (${totalUsersNum})`;
            if (!String(outLic.textContent || "").includes("🚨")) {
              outLic.textContent = "🚨 " + outLic.textContent;
            }
          }

          if (outUsers && !String(outUsers.textContent || "").includes("🚨")) {
            outUsers.textContent = outUsers.textContent + " 🚨";
            outUsers.title = `אזהרה: סך המשתמשים (${totalUsersNum}) גדול ממספר הרשיונות (${lic})`;
          }
        }

      }catch(e){}



      const url = data?.editUrl || "";
      if (url) {
        outLink.href = url;
        outLink.target = "_blank";
        outLink.rel = "noopener";
        outLink.textContent = "Link";
      } else {
        outLink.href = "#";
        outLink.textContent = "—";
      }

      lastLine = `P${data?.projectId || ""} | CID=${data?.companyId || ""} | name=${data?.fields?.projectName || ""} | status=${data?.fields?.status || ""} | sales=${data?.fields?.salesBmby || ""} | due=${data?.fields?.dueDate || ""} | licenses=${data?.fields?.licenseTotal ?? ""}`.trim();
    };

    const run = async () => {
      const pidIn = pidEl.value;
      statusEl.textContent = "טוען...";
      setOut(null);

      try {
        const data = await runEditProjectExtract(pidIn);
        if (!data.ok) {
          statusEl.textContent = `שגיאה: ${data.error || "ERROR"}`;
          setOut(data);
          toast(`❌ ${data.error || "ERROR"}`, "error");
          return;
        }
        statusEl.textContent = "✅ נמצא.";
        // Count users (AddProject2): total/active/inactive
        try {
          statusEl.textContent = "✅ נמצא. סופר משתמשים…";
          const uc = await fetchUsersCounts(data.companyId, data.projectId, (st)=>{
            try{
              statusEl.textContent = `✅ נמצא. סופר משתמשים… ${st?.done ?? 0}/${st?.total ?? 0}`;
              if (outUsers) {
                const ina = st?.inactive ?? 0;
                const unk = st?.unknown ?? 0;
                const err = st?.fetchErrors ?? 0;
                outUsers.textContent = `${n} (נסרק: ${i} | לא פעילים: ${ina} | לא ידוע: ${unk} | שגיאות: ${err})`;
              }
            }catch(e){}
          });
          statusEl.textContent = `✅ הושלם. (${uc?.total ?? 0} משתמשים)`;
          data.fields = data.fields || {};
          data.fields.usersTotal = uc.total;
          data.fields.usersActive = uc.active;
          data.fields.usersInactive = uc.inactive;
          data.fields.usersUrl = uc.url;
          data.fields.usersLimited = !!uc.limited;
          data.fields.usersScanned = uc.scanned;
          try { console.log('[BMBY-UsersCount] samples', uc.debugSamples); } catch(e) {}
          data.fields.usersUnknown = uc.unknown;
          data.fields.usersFetchErrors = uc.fetchErrors;
          data.fields.usersRawHit = uc.rawHit;
          data.fields.usersDebugSamples = uc.debugSamples;
        } catch(e) {
          console.error("[BMBY-UsersCount]", e);
        }
        setOut(data);
        toast("✅ נמצא", "ok");
      } catch (e) {
        console.error(e);
        statusEl.textContent = "שגיאה (ראה קונסול)";
        toast("❌ שגיאה", "error");
      }
    };


    async function scanCompanyFlow(){
      const cid = normDigits(cidEl ? cidEl.value : "");
      if (!cid) { statusEl.textContent = "❌ CompanyID לא תקין."; return; }

      cancelCompanyScan = false;
      if (btnScanCompany) btnScanCompany.disabled = true;
      if (btnStopCompany) btnStopCompany.disabled = false;
      if (btnExportCompany) btnExportCompany.disabled = true;
      statusEl.textContent = `🔎 סורק חברה ${cid}… מושך רשימת פרויקטים…`;

      let pids = [];
      try{
        pids = await getProjectIdsForCompany(cid);
      }catch(e){
        statusEl.textContent = "❌ כשל בשליפת פרויקטים לחברה.";
        if (btnScanCompany) btnScanCompany.disabled = false;
        if (btnStopCompany) btnStopCompany.disabled = true;
        return;
      }

      pids = (pids || []).map(String).filter(Boolean).sort((a,b)=>Number(a)-Number(b));
      if (!pids.length){
        statusEl.textContent = "⚠️ לא נמצאו פרויקטים לחברה.";
        if (btnScanCompany) btnScanCompany.disabled = false;
        if (btnStopCompany) btnStopCompany.disabled = true;
        return;
      }

      lastCompanyScan = [];
      renderScanRows(lastCompanyScan);

      for (let i=0;i<pids.length;i++){
        const pid = pids[i];
        if (cancelCompanyScan){
          statusEl.textContent = `⏹️ נעצר. נסרקו ${lastCompanyScan.length} מתוך ${pids.length}.`;
          break;
        }
        statusEl.textContent = `🔄 סורק פרויקט ${pid} (${i+1}/${pids.length})…`;

        try{
          const ep = await runEditProjectExtract(pid);
          const fields = ep?.fields || {};
          const licTotal = (fields.licenseTotal !== null && fields.licenseTotal !== undefined) ? Number(fields.licenseTotal) : null;

          statusEl.textContent = `🔄 סורק פרויקט ${pid} (${i+1}/${pids.length})… סופר משתמשים…`;
          const uc = await fetchUsersCounts(ep.companyId || cid, pid);
          const usersTotal = uc?.total ?? null;
          const usersActive = uc?.active ?? null;
          const usersInactive = uc?.inactive ?? null;

          const flag = (licTotal !== null && !Number.isNaN(licTotal) && usersTotal !== null && !Number.isNaN(Number(usersTotal)) && licTotal < Number(usersTotal))
            ? "RED" : "OK";

          lastCompanyScan.push({
            companyId: ep.companyId || cid,
            companyName: ep.companyName || "",
            projectId: pid,
            projectName: fields.projectName || "",
            status: fields.status || "",
            sales: fields.salesBmby || "",
            dueDate: fields.dueDate || "",
            licenseBase: fields.licenseBase ?? "",
            licenseAdd: fields.licenseAdd ?? "",
            licenseTotal: fields.licenseTotal ?? "",
            usersTotal,
            usersActive,
            usersInactive,
            flag
          });

          renderScanRows(lastCompanyScan);
        }catch(e){
          lastCompanyScan.push({ companyId: cid, companyName:"", projectId: pid, projectName:"", licenseTotal:"", usersTotal:"", flag:"RED" });
          renderScanRows(lastCompanyScan);
        }

        await new Promise(r=>setTimeout(r, 0));
      }

      const redCount = lastCompanyScan.filter(x=>x.flag==="RED").length;
      statusEl.textContent = `✅ סריקת חברה הסתיימה. פרויקטים: ${lastCompanyScan.length}. חריגות: ${redCount}.`;

      if (btnScanCompany) btnScanCompany.disabled = false;
      if (btnStopCompany) btnStopCompany.disabled = true;
      if (btnExportCompany) btnExportCompany.disabled = false;
    }

    if (btnScanCompany){
      btnScanCompany.addEventListener("click", (e)=>{ e.preventDefault(); scanCompanyFlow(); });

    if (btnStopCompany){
      btnStopCompany.addEventListener("click", (e)=>{
        e.preventDefault();
        cancelCompanyScan = true;
        if (btnStopCompany) btnStopCompany.disabled = true;
        statusEl.textContent = "⏹️ בקשת עצירה התקבלה… מסיים את הפרויקט הנוכחי.";
      });
    }

}

    if (btnExportCompany){
      btnExportCompany.addEventListener("click", (e)=>{
        e.preventDefault();
        if (!lastCompanyScan || !lastCompanyScan.length) return;


        const cid = normDigits(cidEl ? cidEl.value : "") || (lastCompanyScan[0]?.companyId || "");
        const fname = `company_${cid}_projects.xlsx`;

        const rows = [];
        rows.push(["CompanyID","CompanyName","ProjectID","ProjectName","Status","Sales(Bmby)","DueDate","LicBase","LicAdd","LicTotal","UsersTotal","UsersActive","UsersInactive","Flag"]);

        const isClosed = (s) => {
          const t = String(s||"").trim().toLowerCase();
          return t.includes("סגור") || t.includes("closed");
        };

        const parseDue = (s) => {
          const t = String(s||"").trim();
          const m = t.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$/);
          if (!m) return null;
          let d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
          if (y < 100) y = 2000 + y;
          const dt = new Date(y, mo-1, d);
          return Number.isNaN(dt.getTime()) ? null : dt;
        };

        const today0 = new Date(); today0.setHours(0,0,0,0);

        for (const r of lastCompanyScan){
          rows.push([
            r.companyId, r.companyName, r.projectId, r.projectName, r.status, r.sales, r.dueDate,
            r.licenseBase, r.licenseAdd, r.licenseTotal,
            r.usersTotal, r.usersActive, r.usersInactive,
            r.flag==="RED" ? "ALERT" : "OK"
          ]);
        }

        try{
          if (typeof XLSX === "undefined" || !XLSX.utils) throw new Error("XLSX lib missing");

          const ws = XLSX.utils.aoa_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Company Scan");

          ws["!cols"] = [
            {wch:10},{wch:22},{wch:10},{wch:28},{wch:12},{wch:16},{wch:12},
            {wch:8},{wch:8},{wch:8},{wch:10},{wch:10},{wch:12},{wch:8}
          ];

          const headerStyle = { font:{bold:true,color:{rgb:"FFFFFF"}}, fill:{patternType:"solid", fgColor:{rgb:"1F2937"}} };
          for (let c=0;c<rows[0].length;c++){
            const cell = ws[XLSX.utils.encode_cell({r:0,c})];
            if (cell) cell.s = headerStyle;
          }

          const styleAlert = { fill:{patternType:"solid", fgColor:{rgb:"FEE2E2"}}, font:{bold:true,color:{rgb:"991B1B"}} };
          const styleClosed = { fill:{patternType:"solid", fgColor:{rgb:"E5E7EB"}}, font:{color:{rgb:"374151"}} };
          const styleDuePast = { fill:{patternType:"solid", fgColor:{rgb:"FEF3C7"}}, font:{color:{rgb:"92400E"}} };

          for (let r=1;r<rows.length;r++){
            const rowObj = lastCompanyScan[r-1] || {};
            const dueDt = parseDue(rowObj.dueDate);
            const duePast = !!(dueDt && dueDt.getTime() < today0.getTime());
            const closed = isClosed(rowObj.status);
            const alert = rowObj.flag === "RED";

            const rowStyle = alert ? styleAlert : (closed ? styleClosed : (duePast ? styleDuePast : null));
            if (!rowStyle) continue;

            for (let c=0;c<rows[0].length;c++){
              const cell = ws[XLSX.utils.encode_cell({r,c})];
              if (cell) cell.s = rowStyle;
            }
          }

          XLSX.writeFile(wb, fname);
        }catch(e){
          const csvName = `company_${cid}_projects.csv`;
          downloadCsv(csvName, rows);
        }

      });
    }

btnRun?.addEventListener("click", run);
    pidEl?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") run();
    });

    btnCopy?.addEventListener("click", async () => {
      if (!lastLine) return toast("אין מה להעתיק", "warn");
      const ok = await copyToClipboard(lastLine);
      toast(ok ? "✅ הועתק" : "⚠️ לא הועתק", ok ? "ok" : "warn");
    });
  }




  /*****************************************************************
   * PROJECTS BOARDS: highlight row by BoardProjectID
   *****************************************************************/
  function renderBoardsPanel() {
    return `
      <div style="font:900 14px/1.2 var(--bmby-font);">הגדרות פרויקטים נדל״ן (ProjectsBoards)</div>
      <div class="bmby-small">מזינים מספר פרויקט ➜ פותח את המסך ProjectsBoards ומדגיש את השורה לפי BoardProjectID.</div>

      <div class="bmby-row" style="margin-top:10px; gap:8px; align-items:center;">
        <input class="bmby-input" data-x="pid" placeholder="BoardProjectID (P1234 או 1234)" style="flex:1; min-width:160px;">
        <button class="bmby-btn" data-x="open">פתח + צבע</button>
        <button class="bmby-btn secondary" data-x="paintHere" title="צבע בעמוד הנוכחי (רק אם אתה כבר ב-ProjectsBoards)">צבע כאן</button>
      </div>

      <div class="bmby-small muted" style="margin-top:10px;" data-x="hint">טיפ: אם אתה כבר במסך ProjectsBoards, כפתור "צבע כאן" ידגיש בלי לפתוח טאב.</div>
    `;
  }

  function pbNorm(s) {
    return String(s || "")
      .replace(/\u00a0/g, " ")
      .replace(/[\s\u200e\u200f]+/g, " ")
      .trim();
  }

  function pbClearHL() {
    document.querySelectorAll(".bmbyPBHL").forEach((tr) => tr.classList.remove("bmbyPBHL"));
  }

  function pbEnsureCss() {
    if (document.getElementById("bmbyPBHLStyle")) return;
    const st = document.createElement("style");
    st.id = "bmbyPBHLStyle";
    st.textContent = `
      .bmbyPBHL{
        outline:3px solid rgba(0,140,255,.9) !important;
        box-shadow:0 0 0 6px rgba(0,140,255,.18) !important;
        background:rgba(255, 235, 140, .65) !important;
      }
      .bmbyPBHL td, .bmbyPBHL th{ background:transparent !important; }
    `;
    document.head.appendChild(st);
  }

  function pbFindHeaderCell(table) {
    const rows = Array.from(table.querySelectorAll("tr"));
    for (const tr of rows) {
      const ths = Array.from(tr.querySelectorAll("th"));
      for (const th of ths) {
        if (pbNorm(th.textContent) === "BoardProjectID") return { tr, th };
      }
    }
    return null;
  }

  function pbFindRow(pid) {
    const tables = Array.from(document.querySelectorAll("table"));
    for (const table of tables) {
      const hdr = pbFindHeaderCell(table);
      if (!hdr) continue;

      const colIndex = hdr.th.cellIndex;
      const allRows = Array.from(table.querySelectorAll("tr"));
      const startIdx = allRows.indexOf(hdr.tr) + 1;

      for (let i = Math.max(0, startIdx); i < allRows.length; i++) {
        const tr = allRows[i];
        const cells = Array.from(tr.children).filter((el) => el && (el.tagName === "TD" || el.tagName === "TH"));
        const cell = cells[colIndex] || tr.children[colIndex];
        if (cell && pbNorm(cell.textContent) === String(pid)) return tr;
      }
    }
    return null;
  }

  function pbHighlight(pidInput) {
    const pid = normalizePidLite(pidInput);
    if (!pid) return { ok: false, error: "INVALID_PID" };

    pbEnsureCss();
    pbClearHL();

    const row = pbFindRow(pid);
    if (!row) return { ok: false, error: "NOT_FOUND" };

    row.classList.add("bmbyPBHL");
    try { row.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
    return { ok: true };
  }

  function bindBoardsPanel(panel) {
    const pidEl = panel.querySelector('[data-x="pid"]');
    const btnOpen = panel.querySelector('[data-x="open"]');
    const btnPaint = panel.querySelector('[data-x="paintHere"]');
    const hintEl = panel.querySelector('[data-x="hint"]');

    const go = () => {
      const pid = normalizePidLite(pidEl.value);
      if (!pid) return toast("נא להזין מספר פרויקט", "warn");

      // store for auto-highlight on the ProjectsBoards page (shared across tabs)
      Store.set("pb_target_pid", pid);

      // also pass via query string so refresh still works
      const url = `${location.origin}/nihul/ProjectsBoards.php?BoardProjectID=${encodeURIComponent(pid)}`;
      window.open(url, "_blank", "noopener");
      toast("פותח ProjectsBoards + צביעה...", "info");
    };

    const paintHere = () => {
      const pid = normalizePidLite(pidEl.value);
      if (!pid) return toast("נא להזין מספר פרויקט", "warn");
      const ok = pbHighlight(pid);
      if (ok.ok) toast("✅ נצבע", "ok");
      else toast("❌ לא נמצא", "error");
    };

    btnOpen?.addEventListener("click", go);
    btnPaint?.addEventListener("click", paintHere);
    pidEl?.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });

    // If not on ProjectsBoards, hide "paint here" hint
    const onPB = /\/nihul\/ProjectsBoards\.php/i.test(location.pathname);
    if (!onPB) {
      btnPaint.disabled = true;
      hintEl.textContent = 'כפתור "צבע כאן" פעיל רק במסך ProjectsBoards עצמו.';
    }
  }

  // Auto-highlight on ProjectsBoards if a target was set from dashboard
  function pbAutoHighlightFromStore() {
    if (!/\/nihul\/ProjectsBoards\.php/i.test(location.pathname)) return;

    // Prefer query param (survives refresh), fallback to Store.
    let pid = null;
    try {
      const u = new URL(location.href);
      pid = u.searchParams.get("BoardProjectID") || u.searchParams.get("ProjectID");
    } catch {}
    if (!pid) pid = Store.get("pb_target_pid", null);
    if (!pid) return;

    pid = normalizePidLite(pid);
    if (!pid) return;

    // We'll retry because tables can render a bit late.
    const MAX_TRIES = 120;
    const INTERVAL_MS = 250;
    let tries = 0;

    const tick = () => {
      tries++;
      const r = pbHighlight(pid);
      if (r.ok) {
        Store.set("pb_target_pid", null); // clear only on success
        toast(`✅ נצבע: ${pid}`, "ok");
        return;
      }
      if (tries >= MAX_TRIES) {
        // clear to avoid re-trigger loops
        Store.set("pb_target_pid", null);
        toast(`❌ לא נמצא: ${pid}`, "error");
        console.log(TAG, "PB auto highlight NOT_FOUND after tries", tries, "pid", pid);
        return;
      }
      setTimeout(tick, INTERVAL_MS);
    };

    setTimeout(tick, 200);
  }


    /*****************************************************************
     * TAB: DICTIONARY
     *****************************************************************/
    const DICT_CACHE_KEY = "dictionary_cache_v2";

    function renderDictionaryPanel() {
      return `
        <div style="font:900 14px/1.2 var(--bmby-font);">חיפוש במילון</div>
        <div class="bmby-small">חיפוש מתוך EditDictionaries.php לפי עמודת <b>קוד</b> או <b>עברית</b>. אפשר לבחור חיפוש מדויק או כללי.</div>

        <div class="bmby-row" style="margin-top:10px; gap:8px; align-items:center; flex-wrap:wrap;">
          <input class="bmby-input" data-x="dictTerm" placeholder="מילת חיפוש / קוד / טקסט בעברית" style="flex:1; min-width:220px;">
          <button class="bmby-btn primary" data-x="dictSearch">חפש</button>
          <button class="bmby-btn secondary" data-x="dictOpen">פתח מילון</button>
          <button class="bmby-btn secondary" data-x="dictReload">רענן</button>
        </div>

        <div class="bmby-row" style="gap:18px; align-items:center; flex-wrap:wrap; margin-top:10px;">
          <label style="display:flex; align-items:center; gap:6px; font-weight:800;">
            <input type="radio" name="bmbyDictMode" data-x="dictMode" value="general" checked>
            חיפוש כללי
          </label>
          <label style="display:flex; align-items:center; gap:6px; font-weight:800;">
            <input type="radio" name="bmbyDictMode" data-x="dictMode" value="exact">
            חיפוש מדויק
          </label>
          <label style="display:flex; align-items:center; gap:6px; font-weight:800;">
            <input type="radio" name="bmbyDictField" data-x="dictField" value="code" checked>
            קוד
          </label>
          <label style="display:flex; align-items:center; gap:6px; font-weight:800;">
            <input type="radio" name="bmbyDictField" data-x="dictField" value="hebrew">
            עברית
          </label>
          <label style="display:flex; align-items:center; gap:6px; font-weight:800;">
            <input type="radio" name="bmbyDictField" data-x="dictField" value="both">
            שניהם
          </label>
        </div>

        <div class="bmby-card" style="margin-top:10px; padding:10px;">
          <div class="bmby-small muted" data-x="dictStatus">מוכן. לחץ חפש כדי לטעון את המילון.</div>
          <div style="margin-top:8px; max-height:260px; overflow:auto; border:1px solid rgba(255,255,255,.08); border-radius:10px;">
            <table data-x="dictTable" style="width:100%; border-collapse:collapse; font:700 12px/1.35 var(--bmby-font);">
              <thead>
                <tr style="position:sticky; top:0; background:rgba(0,0,0,.25); backdrop-filter: blur(6px);">
                  <th style="text-align:right; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,.08);">קוד</th>
                  <th style="text-align:right; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,.08);">עברית</th>
                  <th style="text-align:right; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,.08);">אנגלית</th>
                  <th style="text-align:right; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,.08);">תיאור</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      `;
    }

    function dictionaryNormalize(s) {
      return String(s || "")
        .replace(/\u00a0/g, " ")
        .replace(/[\s\u200e\u200f]+/g, " ")
        .trim();
    }

    function dictionaryMatch(value, term, exact) {
      const source = dictionaryNormalize(value);
      const q = dictionaryNormalize(term);
      if (!q) return true;
      if (exact) return source === q;
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      const hay = source.toLowerCase();
      return words.every(w => hay.includes(w));
    }

    function parseDictionaryRows(html) {
      const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
      const rows = Array.from(doc.querySelectorAll("tr"));
      const out = [];

      function cellText(td) {
        if (!td) return "";
        const inp = td.querySelector("input:not([type=button]):not([type=hidden]), textarea, select");
        if (inp) {
          if (inp.tagName === 'SELECT') {
            return dictionaryNormalize(inp.options?.[inp.selectedIndex]?.textContent || inp.value || "");
          }
          return dictionaryNormalize(inp.value || inp.getAttribute('value') || "");
        }
        return dictionaryNormalize(td.textContent || "");
      }

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll(":scope > td"));
        if (cells.length < 4) continue;

        const hebInput = row.querySelector("input[dir='rtl'][name^='id']:not([name^='idalt'])");
        if (!hebInput) continue;

        const hebTd = hebInput.closest('td');
        const hebIdx = hebTd ? cells.indexOf(hebTd) : -1;
        if (hebIdx < 0) continue;

        const hebrew = dictionaryNormalize(hebInput.value || hebInput.getAttribute("value") || "");
        const codeCell = hebIdx > 0 ? cells[hebIdx - 1] : null;
        const englishCell = hebIdx > 1 ? cells[hebIdx - 2] : null;
        const altCell = hebIdx + 1 < cells.length ? cells[hebIdx + 1] : null;
        const descCell = hebIdx + 2 < cells.length ? cells[hebIdx + 2] : null;

        const code = cellText(codeCell);
        const english = cellText(englishCell);
        const alt = cellText(altCell);
        let description = '';
        if (descCell) {
          const strongs = Array.from(descCell.querySelectorAll('strong')).map(x => dictionaryNormalize(x.textContent)).filter(Boolean);
          description = strongs.join(' | ') || cellText(descCell);
        }

        if (!code && !hebrew && !english) continue;
        // skip header-like garbage
        if (/^קוד$/i.test(code) || /^עברית$/i.test(hebrew)) continue;

        out.push({ code, hebrew, english, alt, description });
      }

      return out;
    }

    function getDictionaryPageLinks(doc, currentUrl) {
      const out = [];
      const anchors = Array.from(doc.querySelectorAll('a[href]'));
      for (const a of anchors) {
        const href = a.getAttribute('href') || '';
        const text = dictionaryNormalize(a.textContent);
        if (!/Page=/i.test(href) && !/הדף הבא|next/i.test(text)) continue;
        try {
          const abs = new URL(href, currentUrl).toString();
          if (!out.includes(abs)) out.push(abs);
        } catch {}
      }
      return out;
    }

    async function getDictionaryRows(forceReload) {
      if (!forceReload) {
        const cached = Store.get(DICT_CACHE_KEY, null);
        if (cached && Array.isArray(cached.rows) && cached.rows.length) return cached.rows;
      }

      const startUrl = location.origin + "/nihul/EditDictionaries.php";
      const queue = [startUrl];
      const seenPages = new Set();
      const rows = [];
      const seenKeys = new Set();

      while (queue.length) {
        const url = queue.shift();
        if (!url || seenPages.has(url)) continue;
        seenPages.add(url);

        const html = await fetchTextSmart(url);
        const pageRows = parseDictionaryRows(html);
        for (const r of pageRows) {
          const key = [r.code, r.hebrew, r.english, r.alt].join('||');
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          rows.push(r);
        }

        const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
        const nextLinks = getDictionaryPageLinks(doc, url);
        for (const nextUrl of nextLinks) {
          if (!seenPages.has(nextUrl) && !queue.includes(nextUrl)) queue.push(nextUrl);
        }
      }

      Store.set(DICT_CACHE_KEY, { rows, ts: Date.now() });
      return rows;
    }

    function renderDictionaryResults(tbody, rows) {
      if (!tbody) return;
      tbody.innerHTML = "";
      for (const r of rows) {
        const tr = document.createElement("tr");
        const make = (txt) => {
          const td = document.createElement("td");
          td.style.textAlign = "right";
          td.style.padding = "6px 8px";
          td.style.borderBottom = "1px solid rgba(255,255,255,.06)";
          td.textContent = txt || "";
          return td;
        };
        tr.appendChild(make(r.code));
        tr.appendChild(make(r.hebrew));
        tr.appendChild(make(r.english));
        tr.appendChild(make(r.description));
        tbody.appendChild(tr);
      }
    }

    function bindDictionaryPanel(panel) {
      const termEl = panel.querySelector('[data-x="dictTerm"]');
      const btnSearch = panel.querySelector('[data-x="dictSearch"]');
      const btnOpen = panel.querySelector('[data-x="dictOpen"]');
      const btnReload = panel.querySelector('[data-x="dictReload"]');
      const statusEl = panel.querySelector('[data-x="dictStatus"]');
      const tbody = panel.querySelector('[data-x="dictTable"] tbody');

      async function run(forceReload) {
        const term = dictionaryNormalize(termEl ? termEl.value : "");
        const exact = !!panel.querySelector('[data-x="dictMode"][value="exact"]:checked');
        const field = panel.querySelector('[data-x="dictField"]:checked')?.value || 'code';

        if (!term && !forceReload) {
          statusEl.textContent = 'הכנס מילת חיפוש.';
          renderDictionaryResults(tbody, []);
          return;
        }

        try {
          statusEl.textContent = forceReload ? 'טוען מילון מחדש...' : 'טוען מילון ומחפש...';
          const rows = await getDictionaryRows(!!forceReload);
          let list = rows;
          if (term) {
            list = rows.filter(r => {
              const byCode = dictionaryMatch(r.code, term, exact);
              const byHeb = dictionaryMatch(r.hebrew, term, exact);
              if (field === 'code') return byCode;
              if (field === 'hebrew') return byHeb;
              return byCode || byHeb;
            });
          }
          renderDictionaryResults(tbody, list.slice(0, 100));
          statusEl.textContent = `נמצאו ${list.length} תוצאות.`;
          if (!list.length) toast('לא נמצאו תוצאות במילון', 'warn');
        } catch (e) {
          console.error('[DICT]', e);
          statusEl.textContent = 'שגיאה בטעינת המילון.';
          toast('שגיאה בטעינת המילון', 'error');
        }
      }

      btnSearch?.addEventListener('click', () => run(false));
      btnReload?.addEventListener('click', () => run(true));
      btnOpen?.addEventListener('click', () => {
        try { window.open(location.origin + '/nihul/EditDictionaries.php', '_blank'); } catch {}
      });
      termEl?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') run(false);
      });
    }

    function renderComingSoon(tabId) {
      const title =
        tabId === "passwords" ? "חיפוש סיסמאות" :
        tabId === "extensions" ? "חיפוש שלוחות" : "בקרוב";
      return `
        <div style="font:900 14px/1.2 var(--bmby-font);">${title}</div>
        <div class="bmby-small">בקרוב נוסיף את הפיצ׳ר הזה. כרגע PROD מתמקד ב-VOIP.</div>
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

    // --- Pagination-aware project collector (scan ALL pages, not only current page) ---
    async function collectProjectIdsFromAllPages(maxPages = 200) {
      const ids = new Set();

      function extractIdsFromDoc(doc) {
        doc.querySelectorAll("[onclick], a[href]").forEach((el) => {
          const src = el.getAttribute("onclick") || el.getAttribute("href") || "";
          const m1 = src.match(/ProjectID=(\d+)/i);
          const m2 = src.match(/FindedProjects=(\d+)/i);
          if (m1) ids.add(m1[1]);
          if (m2) ids.add(m2[1]);
        });
      }

      function getNextPageUrl(doc, currentUrl) {
        // 1) anchor text "הדף הבא"
        const nextA = Array.from(doc.querySelectorAll("a[href]"))
          .find(a => (a.textContent || "").includes("הדף הבא"));
        if (nextA) {
          try { return new URL(nextA.getAttribute("href"), currentUrl).toString(); } catch {}
        }

        // 2) select dropdown "עבור לדף"
        const sel = doc.querySelector('select[onchange*="window.location"]');
        if (sel) {
          const opts = Array.from(sel.querySelectorAll("option[value]"));
          const idx = opts.findIndex(o => o.selected);
          if (idx >= 0 && idx + 1 < opts.length) {
            try { return new URL(opts[idx + 1].value, currentUrl).toString(); } catch {}
          }
        }

        return null;
      }

      let pageUrl = location.href;

      for (let page = 1; page <= maxPages; page++) {
        const res = await fetch(pageUrl, { credentials: "include" });
        if (!res.ok) break;

        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        extractIdsFromDoc(doc);

        const next = getNextPageUrl(doc, pageUrl);
        if (!next || next === pageUrl) break;
        pageUrl = next;
      }

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

      const ids = await collectProjectIdsFromAllPages().catch(() => collectProjectIdsFromPage());
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
      toast("✅ למדתי את מקור ה-VOIP מהמערכת (יישמר ב-PROD)", "ok");
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
        const row = cell.bmbyGetRowFromAny() || cell.parentElement;
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
        if (t) learnStatus.textContent = "למידת VOIP: פעילה ✅ (נלמד אוטומטית מרשת – PROD)";
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

    // Keys (PROD) – stored in Store (GM/local)
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

    const UIDHL = {
      key: 'uid_highlight_v1' // { uid, ts }
    };

    function setUidHighlight(uid){
      try{
        Store.set(UIDHL.key, { uid: String(uid||''), ts: Date.now() });
      }catch(e){}
    }
    function getUidHighlight(){
      try{ return Store.get(UIDHL.key, null); }catch(e){ return null; }
    }
    function clearUidHighlight(){
      try{ Store.del(UIDHL.key); }catch(e){}
    }

    function usFindEditLinkForUserId(uid){
      const target = String(uid||'').trim();
      if (!target) return null;

      // Prefer explicit EditUser.php?UserID=XXX
      const nodes = Array.from(document.querySelectorAll('a[href], [onclick]'));
      for (const el of nodes){
        const src = ((el.getAttribute('href')||'') + ' ' + (el.getAttribute('onclick')||'')).replace(/&amp;/g,'&');
        if (!src) continue;
        if (src.includes('EditUser.php') && src.match(new RegExp('UserID=' + target + '(?:\\D|$)'))) return el;
        if (src.match(new RegExp('UserID=' + target + '(?:\\D|$)'))) return el;
      }

      // Fallback: plain text contains uid (rare)
      const els2 = Array.from(document.querySelectorAll('td,th,span,div')).slice(0, 8000);
      for (const el of els2){
        const t = (el.textContent||'').trim();
        if (t === target) return el;
      }
      return null;
    }

    async function autoHighlightUserIdOnUsersPageIfNeeded(){
      try{
        if (!/\/nihul\/AddProject2\.php$/i.test(location.pathname)) return;
        const payload = getUidHighlight();
        if (!payload || !payload.uid) return;

        await sleep(350);
        const el = usFindEditLinkForUserId(payload.uid);
        if (el){
          usHighlightElement(el, 'UserID ' + payload.uid);
          toast('✅ נמצא UserID והודגש', 'ok', 2500);
        } else {
          toast('⚠️ לא נמצא UserID במסך משתמשים זה', 'warn', 3500);
        }
        clearUidHighlight();
      }catch(e){
        try{ clearUidHighlight(); }catch(_){}
      }
    }



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

        const tr = el.bmbyGetRowFromAny() || el.closest('TR');
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

    async function usFetchUsernameFromEditUserUrl(url) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort('timeout'), US_FETCH_TIMEOUT_MS);
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
          } else {
            usLogAppend(`ℹ️ יש קאש ל-UserID=${cached.uid} אבל הוא לא קיים בפרויקט הזה – עובר לסריקה…`);
          }
        }
      }catch{}

      usLogAppend(`מסך משתמשים: ${items.length} לינקים של "עריכה"`);
      usLogAppend(`מחפש: ${targetUsername}`);

      if (!items.length) { usLogAppend('❌ 0 עריכות חולצו.'); return { found:false }; }

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
            const seenFetch = await usFetchUsernameFromEditUserUrl(it.url);
            if (seenFetch) {
              if (seenFetch === target) {
                found = true;
                foundItem = it;
                return;
              }
              // got a definitive username from HTML and it's not ours → skip iframe
              continue;
            } else {
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
                return;
              }
              await usSleep(US_POST_LOAD_POLL_MS);
            }
          } catch (_) {
          }
        }
      };

      await Promise.allSettled(pool.map(worker));
      pool.forEach(fr => { try { if (fr && fr.remove) fr.remove(); } catch (_) {} });

      if (!isActive()) return { found:false };

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
        Store.del(US.active);
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
            <input class="bmby-input" data-x="usCompany" placeholder="CompanyID (e.g. 4583)" style="width:140px; text-align:center;" value="${escapeHtml(String(Store.get('users_companyId_v1','')||''))}" />
            <input class="bmby-input" data-x="usUser" placeholder="username / UserID" value="${escapeHtml(u)}" />
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


      const cidInp = panel.querySelector('[data-x="usCompany"]');

      const doStart = (mode) => {
        const qraw = String(inp?.value || '').trim();
        if (!qraw) return toast('תכתוב username או UserID', 'err');

        const cidTypedRaw = String(cidInp?.value || '').trim();
        if (cidTypedRaw) Store.set('users_companyId_v1', cidTypedRaw);

        // Numeric -> UserID global scan inside a company
        if (/^\d+$/.test(qraw)) {
          const uid = qraw;

          // Resolve CompanyID: typed > selected company > URL param
          let cid = (cidTypedRaw.match(/\d+/) || [null])[0];
          if (!cid) {
            const cur = Store.get(US.cur, null);
            if (cur && cur.cid) cid = String(cur.cid);
          }
          if (!cid) {
            const mm = String(location.href).match(/CompanyID=(\d+)/i);
            cid = mm ? mm[1] : null;
          }

          if (!cid) return toast('חובה CompanyID לחיפוש לפי UserID (הקלד או בחר חברה)', 'err');

          Store.set(US.mode, 'userid');
          Store.set(US.active, true);
          usLogClear();
          usSetStatus('');
          Store.set(US.runId, Date.now());
          usLogAppend(`▶️ Start (UserID) ${uid} | CompanyID=${cid}`);

          (async () => {
            try {
              const res = await findUserIdInCompanyProjects(cid, uid, (p) => {
                if (p.phase === "projects") {
                  usSetStatus(`נמצאו ${p.count} פרויקטים. מתחיל סריקה...`);
                } else if (p.phase === "scan") {
                  usSetStatus(`סורק ${p.index}/${p.total} | ProjectID=${p.pid}`);
                }
              });

              if (res && res.found) {
                usLogAppend(`✅ נמצא! ProjectID=${res.projectId}`);
                usSetStatus(`✅ נמצא בפרויקט ${res.projectId}`);
                Store.set('dash_open_on_load_v1', true);
                window.open(res.usersUrl, "_blank", "noopener,noreferrer");
                toast(`נמצא! ProjectID=${res.projectId}`, "ok", 6000);
              } else {
                const pc = res && typeof res.projectCount === "number" ? res.projectCount : 0;
                usLogAppend(`❌ לא נמצא UserID בחברה הזו. (projects=${pc})`);
                usSetStatus(`❌ לא נמצא בחברה. (projects=${pc})`);
                toast('לא נמצא UserID בחברה הזו', 'warn', 6000);
              }
            } catch (e) {
              console.error(e);
              usLogAppend('❌ שגיאה בסריקה (פרטים בקונסול)');
              usSetStatus('❌ שגיאה בסריקה');
              toast('שגיאה בסריקה (ראה קונסול)', 'err', 6000);
            } finally {
              Store.del(US.active);
            }
          })();

          return;
        }

        // username flow
        const u = qraw;
        Store.set(US.username, u);
        Store.set(US.mode, mode);
        Store.set(US.active, true);
        Store.del(US.queue);
        Store.del(US.cur);
        Store.del(US.companies);
        usLogClear();
        usSetStatus('');
        Store.set(US.runId, Date.now());
        usLogAppend(`▶️ Start (${mode}) ${u}`);

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
          usLogAppend(`➡️ נכנס לחברה: ${c.name}`);
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
        usLogAppend(`ב-Wizard: נמצאו ${companies.length} חברות`);

        if (!companies.length) {
          toast('לא נמצאו חברות', 'err');
          Store.del(US.active);
          return;
        }

        if (companies.length === 1) {
          Store.set(US.cur, companies[0]);
          usLogAppend(`AUTO: חברה יחידה → ${companies[0].name}`);
          Store.set('dash_open_on_load_v1', true);
          usGo(companies[0].url);
          return;
        }

        if (mode === 'all') {
          Store.set(US.cur, companies[0]);
          Store.set(US.queue, companies.slice(1));
          usLogAppend(`SCAN ALL: נכנס לחברה 1/${companies.length}: ${companies[0].name}`);
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
        usLogAppend(`בדף חברה CompanyID=${cid} | FindedProjects=${pids.join(',') || '(ריק)'}`);

        if (!pids.length) {
          const mode = String(Store.get(US.mode, 'single') || 'single');
          if (mode === 'all') {
            const q = Store.get(US.queue, []) || [];
            const next = q.shift();
            Store.set(US.queue, q);
            if (next) {
              Store.set(US.cur, next);
              usLogAppend(`➡️ חברה הבאה… ${next.name}`);
              Store.set("dash_open_on_load_v1", true);
              usGo(next.url);
            } else {
              usLogAppend("✅ נגמרו חברות.");
              Store.del(US.active);
            }
          }
          return;
        }

        usLogAppend(`➡️ נכנס למסך משתמשים: ProjectID=${pids[0]}`);
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
              usLogAppend(`➡️ חברה הבאה… ${next.name}`);
              Store.set("dash_open_on_load_v1", true);
              usGo(next.url);
            } else {
              usLogAppend("✅ נגמרו חברות.");
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
    try { runUsersFlowIfNeeded();
    autoHighlightUserIdOnUsersPageIfNeeded();
  } catch(e){ log("users flow failed", e); }
  })();


  // === PATCH: Add Interfaces Page Link in Password Tab (PROD 12.3+) ===
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
    // Auto paint ProjectsBoards row if requested from dashboard
    try { if (typeof pbAutoHighlightFromStore === 'function') if (typeof pbAutoHighlightFromStore==='function') pbAutoHighlightFromStore(); } catch(e) {}
    if (/\/nihul\/ProjectsBoards\.php/i.test(location.pathname)) { setTimeout(pbAutoHighlightFromStore, 1200); setTimeout(pbAutoHighlightFromStore, 3500); }


    // GLOBAL_UID_EVENT_DELEGATION
    document.addEventListener("click", (ev) => {
      try{
        const t = ev.target;
        if (!t) return;
        const btn = t.closest && t.closest("button");
        if (!btn) return;
        const label = (btn.textContent||"").trim().toLowerCase();
        if (label !== "start") return;

        const userEl = document.getElementById("usInput") || document.getElementById("userSearchInput") || document.getElementById("usQuery");
        const v = (userEl ? userEl.value : "").trim();
        if (/^\d+$/.test(v)) {
          ev.preventDefault();
          ev.stopPropagation();
          runGlobalUserIdScanFromUi();
        }
      }catch(e){}
    }, true);


    // Auto highlight on Users page if coming from global UserID scan
    if (typeof maybeAutoHighlightGlobalUid==='function') maybeAutoHighlightGlobalUid();
  })();




    async function runGlobalUserIdScanFromUi(){
      try{
        const userEl = document.getElementById("usInput") || document.getElementById("userSearchInput") || document.getElementById("usQuery") || document.querySelector("input[type='text']");
        const cidEl = document.getElementById("usCompanyInput");
        const uid = normDigits(userEl ? userEl.value : "");
        let cid = normDigits(cidEl ? cidEl.value : "");

        if (!cid){
          const mm = String(location.href).match(/CompanyID=(\d+)/i);
          cid = mm ? mm[1] : "";
        }

        if (!uid){
          toast("נא להזין UserID (מספר)", "warn");
          return;
        }
        if (!cid){
          toast("במסך הראשי חייב להזין CompanyID כדי לבצע חיפוש UserID גלובלי.", "warn");
          return;
        }

        toast(`🔎 סורק UserID=${uid} בחברה ${cid}...`, "info", 5000);

        const res = await findUserIdInCompanyProjects(cid, uid, (p)=>{
          if (p.phase==="projects") toast(`נמצאו ${p.count} פרויקטים. מתחיל סריקה...`, "info", 4000);
        });

        if (res.found){
          toast(`✅ נמצא! ProjectID=${res.projectId} (פותח מסך משתמשים)`, "ok", 6000);
          setUidHighlight(uid);
          try{ localStorage.setItem(BMBY_GLOBAL_UID_TO_HIGHLIGHT, String(uid)); }catch(e){}
          window.open(res.usersUrl, "_blank", "noopener");
        }else{
          toast(`❌ לא נמצא UserID בחברה הזו.`, "warn", 6000);
        }
      }catch(e){
        console.error(e);
        toast("שגיאה בסריקת UserID גלובלי (ראה קונסול).", "error", 6000);
      }
    }

}


function __bootIPBX_PARTITION_PREFIX_HELPER__(){
  'use strict';

  const CSS_ID = 'bmby-ipbx-prefix-style';
  const BOX_ID = 'bmby-ipbx-prefix-box';
  const STORE_KEY = 'BMBY__IPBX_PREFIX_LAST';
  const HUB_CTX_KEY = 'BMBY__IPBX_HUB_CONTEXT';

  function injectCss(){
    if (document.getElementById(CSS_ID)) return;
    const s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = `
      #${BOX_ID}{position:fixed;top:14px;right:14px;z-index:2147483647;background:#fff;color:#111;border:1px solid rgba(0,0,0,.14);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.20);padding:12px;width:360px;font:700 12px/1.4 Arial,sans-serif}
      #${BOX_ID} .row{display:flex;gap:8px;align-items:center;margin-top:8px}
      #${BOX_ID} input[type="text"]{flex:1;min-width:0;padding:9px 10px;border:1px solid rgba(0,0,0,.16);border-radius:12px;outline:none}
      #${BOX_ID} button{padding:9px 10px;border:1px solid rgba(0,0,0,.16);background:#fff;border-radius:12px;cursor:pointer;font-weight:700}
      #${BOX_ID} button.primary{background:rgba(37,99,235,.10);border-color:rgba(37,99,235,.35)}
      #${BOX_ID} .muted{color:#666;font-size:11px}
      #${BOX_ID} .results{margin-top:10px;max-height:260px;overflow:auto;border:1px solid rgba(0,0,0,.08);border-radius:12px;background:#fafafa}
      #${BOX_ID} .item{padding:8px 10px;border-bottom:1px solid rgba(0,0,0,.06);cursor:pointer}
      #${BOX_ID} .item:last-child{border-bottom:none}
      #${BOX_ID} .item:hover{background:rgba(37,99,235,.07)}
      #${BOX_ID} .prefix{font-weight:900;color:#0b3aa6}
      #${BOX_ID} .name{display:block;margin-top:2px;color:#222}
      #${BOX_ID} .meta{display:block;margin-top:2px;color:#666;font-size:11px}
      tr.bmbyPrefixHit{outline:3px solid rgba(37,99,235,.9)!important;box-shadow:0 0 0 5px rgba(37,99,235,.16) inset!important;background:rgba(37,99,235,.08)!important}
    `;
    document.head.appendChild(s);
  }

  function saveLast(val){ try{ localStorage.setItem(STORE_KEY, val||''); }catch(e){} }
  function loadLast(){ try{ return localStorage.getItem(STORE_KEY)||''; }catch(e){ return ''; } }
  function saveHubContext(ctx){ try { localStorage.setItem(HUB_CTX_KEY, JSON.stringify(ctx || {})); } catch(e){} }
  function loadHubContext(){ try { return JSON.parse(localStorage.getItem(HUB_CTX_KEY) || '{}') || {}; } catch(e){ return {}; } }
  function dispatchHubModule(name){ try { localStorage.setItem('BMBY__IPBX_HUB_TARGET_MODULE', String(name||'')); } catch(e){} try { window.dispatchEvent(new CustomEvent('bmby-ipbx-open-module', { detail:{ module:name||'' } })); } catch(e){} }
  function norm(s){ return String(s||'').replace(/[\s ‎‏]+/g,' ').trim(); }
  function setSelectedMode(box, item){
    if (!box) return;
    box.setAttribute('data-mode','selected');
    const title = box.querySelector('[data-x="title"]');
    const desc = box.querySelector('[data-x="desc"]');
    const inputRow = box.querySelector('[data-x="inputRow"]');
    const actionsRow = box.querySelector('[data-x="actionsRow"]');
    const results = box.querySelector('[data-x="results"]');
    const selected = box.querySelector('[data-x="selected"]');
    if (title) title.textContent = 'IPBX HUB READY';
    if (desc) desc.textContent = 'המרכזייה נבחרה. פתח מודול מתוך ה-HUB הראשי. לחיפוש חדש לחץ "חיפוש חדש".';
    if (inputRow) inputRow.style.display = 'none';
    if (results) results.style.display = 'none';
    if (selected) {
      selected.style.display = 'block';
      selected.innerHTML = '<div><strong>PREFIX:</strong> ' + (item && item.prefix ? item.prefix : '—') + '</div>' +
        '<div><strong>Partition:</strong> ' + (item && item.partition ? item.partition : '—') + '</div>' +
        '<div><strong>Name:</strong> ' + (item && item.name ? item.name : '—') + '</div>';
    }
    if (actionsRow) actionsRow.innerHTML = '<button type="button" class="primary" data-x="openUsers">USERS</button><button type="button" data-x="openAgents">AGENTS</button><button type="button" data-x="openIvrMenu">IVR MENU</button><button type="button" data-x="openIvrSwitch">IVR SWITCH</button><button type="button" data-x="newSearch">חיפוש חדש</button>';
    const btn = box.querySelector('[data-x="newSearch"]');
    if (btn) btn.addEventListener('click', () => setSearchMode(box));
    const go = (url) => { try { if (url) location.assign(url); } catch(e){} };
    const uBtn = box.querySelector('[data-x="openUsers"]');
    if (uBtn) uBtn.addEventListener('click', () => go('http://voip2.bmby.com/ipbx/users_edit.php'));
    const aBtn = box.querySelector('[data-x="openAgents"]');
    if (aBtn) aBtn.addEventListener('click', () => go('http://voip2.bmby.com/ipbx/agents_list.php'));
    const mBtn = box.querySelector('[data-x="openIvrMenu"]');
    if (mBtn) mBtn.addEventListener('click', () => go('http://voip2.bmby.com/ipbx/ivr_edit.php?type=MENU'));
    const sBtn = box.querySelector('[data-x="openIvrSwitch"]');
    if (sBtn) sBtn.addEventListener('click', () => goToModule('IVR SWITCH'));
  }
  function setSearchMode(box){
    if (!box) return;
    box.setAttribute('data-mode','search');
    const title = box.querySelector('[data-x="title"]');
    const desc = box.querySelector('[data-x="desc"]');
    const inputRow = box.querySelector('[data-x="inputRow"]');
    const actionsRow = box.querySelector('[data-x="actionsRow"]');
    const results = box.querySelector('[data-x="results"]');
    const selected = box.querySelector('[data-x="selected"]');
    if (title) title.textContent = 'IPBX Prefix Search';
    if (desc) desc.textContent = 'חיפוש לפי PREFIX (העמודה השנייה). בחירת תוצאה תבחר את המרכזייה ותעדכן את ה-HUB הראשי.';
    if (inputRow) inputRow.style.display = 'flex';
    if (results) { results.style.display = ''; results.innerHTML = '<div class="item">הקלד PREFIX ולחץ חפש</div>'; }
    if (selected) { selected.style.display = 'none'; selected.innerHTML = ''; }
    if (actionsRow) actionsRow.innerHTML = '<button type="button" data-x="clear">נקה</button><button type="button" data-x="refresh">רענן רשימה</button>';
  }

  function getRows(){
    return Array.from(document.querySelectorAll('tr')).filter(tr => {
      const tds = tr.querySelectorAll('td');
      return tds.length >= 3 && Array.from(tds).slice(0,3).every(td => /ChangePartition/.test(td.getAttribute('onclick') || td.querySelector('a[onclick*="ChangePartition"]')?.getAttribute('onclick') || ''));
    });
  }

  function parseRow(tr){
    const tds = Array.from(tr.querySelectorAll('td'));
    if (tds.length < 3) return null;
    const partition = norm(tds[0].textContent);
    const prefix = norm(tds[1].textContent);
    const name = norm(tds[2].textContent);
    const clickEl = tds[1].querySelector('a[onclick*="ChangePartition"]') || tds[0].querySelector('a[onclick*="ChangePartition"]') || tds[2].querySelector('a[onclick*="ChangePartition"]') || tds[1];
    const onclick = clickEl.getAttribute('onclick') || '';
    if (!prefix || !onclick) return null;
    return { tr, partition, prefix, name, onclick, clickEl };
  }

  function getItems(){
    return getRows().map(parseRow).filter(Boolean);
  }

  function clearHits(){ document.querySelectorAll('tr.bmbyPrefixHit').forEach(tr => tr.classList.remove('bmbyPrefixHit')); }
  function hitRow(tr){ clearHits(); try{ tr.classList.add('bmbyPrefixHit'); tr.scrollIntoView({behavior:'smooth', block:'center'}); }catch(e){} }

  function notifyHubRefresh(){
    try { window.dispatchEvent(new CustomEvent('bmby-ipbx-context-updated')); } catch(e){}
  }

  function runPartition(item){
    hitRow(item.tr);
    saveLast(item.prefix);
    saveHubContext({
      prefix: item.prefix || '',
      partition: item.partition || '',
      name: item.name || '',
      host: location.host || '',
      page: location.pathname || '',
      selectedAt: new Date().toISOString()
    });
    const box = document.getElementById(BOX_ID);
    setSelectedMode(box, item);
    const el = item.clickEl;
    let clicked = false;
    if (el && typeof el.click === 'function') {
      try { el.click(); clicked = true; } catch(e) { console.error('[BMBY PREFIX] native click failed', e); }
    }
    if (!clicked) {
      try { (0,eval)(item.onclick); clicked = true; } catch(e) { console.error('[BMBY PREFIX] click failed', e); }
    }
    setTimeout(notifyHubRefresh, 150);
    setTimeout(notifyHubRefresh, 700);
    setTimeout(function(){ setSelectedMode(document.getElementById(BOX_ID), item); }, 1200);
  }

  function renderResults(root, items){
    const results = root.querySelector('[data-x="results"]');
    if (!results) return;
    results.innerHTML = '';
    if (!items.length) {
      results.innerHTML = '<div class="item">לא נמצאו תוצאות</div>';
      return;
    }
    items.slice(0,100).forEach(item => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `<span class="prefix">${item.prefix}</span><span class="name">${item.name || '—'}</span><span class="meta">Partition: ${item.partition || '—'}</span>`;
      div.addEventListener('click', () => runPartition(item));
      results.appendChild(div);
    });
  }

  function doSearch(root, autoRun){
    const inp = root.querySelector('[data-x="prefix"]');
    const term = norm(inp && inp.value);
    saveLast(term);
    const all = getItems();
    let found = [];
    if (term) found = all.filter(x => x.prefix.includes(term));
    renderResults(root, found);
    if (autoRun && found.length === 1) runPartition(found[0]);
  }

  function mount(){
    if (document.getElementById(BOX_ID)) return;
    injectCss();
    const box = document.createElement('div');
    box.id = BOX_ID;
    box.innerHTML = `
      <div style="font-weight:900" data-x="title">IPBX Prefix Search</div>
      <div class="muted" data-x="desc">חיפוש לפי PREFIX (העמודה השנייה). בחירת תוצאה תבחר את המרכזייה ותעדכן את ה-HUB הראשי.</div>
      <div class="row" data-x="inputRow">
        <input type="text" data-x="prefix" placeholder="חפש PREFIX, למשל 5535">
        <button type="button" class="primary" data-x="search">חפש</button>
      </div>
      <div class="row" data-x="actionsRow"></div>
      <div class="selectedInfo muted" data-x="selected" style="display:none;margin-top:10px;padding:10px;border:1px solid rgba(0,0,0,.08);border-radius:12px;background:#fafafa"></div>
      <div class="results" data-x="results"></div>
    `;
    document.body.appendChild(box);
    const inp = box.querySelector('[data-x="prefix"]');
    inp.value = loadLast();
    const bindSearchHandlers = function(){
      const searchBtn = box.querySelector('[data-x="search"]');
      if (searchBtn && !searchBtn.__bmbyBound) { searchBtn.__bmbyBound = true; searchBtn.addEventListener('click', () => doSearch(box, false)); }
      const clearBtn = box.querySelector('[data-x="clear"]');
      if (clearBtn && !clearBtn.__bmbyBound) { clearBtn.__bmbyBound = true; clearBtn.addEventListener('click', () => { inp.value=''; saveLast(''); const results = box.querySelector('[data-x="results"]'); if (results) results.innerHTML = '<div class="item">הקלד PREFIX ולחץ חפש</div>'; clearHits(); inp.focus(); }); }
      const refreshBtn = box.querySelector('[data-x="refresh"]');
      if (refreshBtn && !refreshBtn.__bmbyBound) { refreshBtn.__bmbyBound = true; refreshBtn.addEventListener('click', () => doSearch(box, false)); }
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(box, true); });
    const ctx = loadHubContext();
    if (ctx && ctx.prefix) setSelectedMode(box, ctx);
    else setSearchMode(box);
    bindSearchHandlers();
    window.addEventListener('bmby-ipbx-context-updated', () => {
      const newCtx = loadHubContext();
      if (newCtx && newCtx.prefix) setSelectedMode(box, newCtx);
    });
    const observer = new MutationObserver(() => bindSearchHandlers());
    observer.observe(box, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
}



function __bootIPBX_USERS_SCAN_HELPER__(){
  'use strict';

  const host = location.host;
  const path = location.pathname;
  const allowed = ['voip.bmby.com','voip2.bmby.com','82.166.228.179','82.166.228.180'];
  if (!allowed.includes(host)) return;
  if (path !== '/ipbx/partition_selection.php' && path !== '/ipbx/users.php' && path !== '/ipbx/users_edit.php') return;

  const BOX_ID = 'bmby-ipbx-users-scan-box';
  const STYLE_ID = 'bmby-ipbx-users-scan-style';
  const POS_KEY = 'bmby_ipbx_users_scan_box_pos_v3';
  const HUB_CTX_KEY = 'BMBY__IPBX_HUB_CONTEXT';
  const LOG_PREFIX = '[BMBY IPBX HUB v1.4.44]';
  const scanState = { running:false, paused:false, cancel:false };
  const isPartitionPage = path === '/ipbx/partition_selection.php';
  const isUsersPage = path === '/ipbx/users.php' || path === '/ipbx/users_edit.php';
  const NAV_TARGETS = {
    'USERS': 'http://voip2.bmby.com/ipbx/users_edit.php',
    'AGENTS': 'http://voip2.bmby.com/ipbx/agents_list.php',
    'IVR MENU': 'http://voip2.bmby.com/ipbx/ivr_edit.php?type=MENU',
    'IVR SWITCH': ''
  };

  function log(){ try { console.log(LOG_PREFIX, ...arguments); } catch(e){} }
  function norm(s){ return String(s||'').replace(/[ ‎‏\s]+/g,' ').trim(); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function loadHubContext(){ try { return JSON.parse(localStorage.getItem(HUB_CTX_KEY) || '{}') || {}; } catch(e){ return {}; } }
  function dispatchHubModule(name){ try { localStorage.setItem('BMBY__IPBX_HUB_TARGET_MODULE', String(name||'')); } catch(e){} try { window.dispatchEvent(new CustomEvent('bmby-ipbx-open-module', { detail:{ module:name||'' } })); } catch(e){} }

  function tryAutoOpenUsersPage(){ return; }

  function injectCss(){
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${BOX_ID}{position:fixed;top:14px;right:14px;left:auto;z-index:2147483647;width:760px;max-width:calc(100vw - 28px);background:#fff;color:#111;border:1px solid rgba(0,0,0,.14);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.20);padding:12px;font:700 12px/1.45 Arial,sans-serif}
      #${BOX_ID}.min{width:300px}
      #${BOX_ID} .head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
      #${BOX_ID} .drag{cursor:move;user-select:none;font-weight:900}
      #${BOX_ID} .headBtns{display:flex;gap:6px;align-items:center}
      #${BOX_ID} .row{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap}
      #${BOX_ID} .hubMeta{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 8px}
      #${BOX_ID} .metaPill{padding:4px 8px;border-radius:999px;background:#f5f5f5;border:1px solid rgba(0,0,0,.07);font-size:11px}
      #${BOX_ID} .modules{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:8px 0 10px}
      #${BOX_ID} .modBtn{padding:10px 8px;border:1px solid rgba(0,0,0,.12);border-radius:12px;background:#fff;cursor:pointer;font-weight:800;text-align:center}
      #${BOX_ID} .modBtn.active{background:rgba(37,99,235,.10);border-color:rgba(37,99,235,.35);box-shadow:0 0 0 2px rgba(37,99,235,.08) inset}
      #${BOX_ID} .modulePanel{display:none}
      #${BOX_ID} .modulePanel.active{display:block}
      #${BOX_ID} .placeholder{margin-top:8px;padding:12px;border-radius:12px;border:1px dashed rgba(0,0,0,.16);background:#fafafa}
      #${BOX_ID} .muted{color:#666;font-size:11px}
      #${BOX_ID} button{padding:9px 10px;border:1px solid rgba(0,0,0,.16);background:#fff;border-radius:12px;cursor:pointer;font-weight:700}
      #${BOX_ID} button.primary{background:rgba(37,99,235,.10);border-color:rgba(37,99,235,.35)}
      #${BOX_ID} .status{margin-top:8px;padding:8px 10px;border-radius:12px;background:#f8fafc;border:1px solid rgba(0,0,0,.08)}
      #${BOX_ID} .results{margin-top:8px;max-height:380px;overflow:auto;border:1px solid rgba(0,0,0,.08);border-radius:12px;background:#fff}
      #${BOX_ID} table{width:100%;border-collapse:collapse;font:12px/1.4 Arial,sans-serif}
      #${BOX_ID} th,#${BOX_ID} td{border-bottom:1px solid rgba(0,0,0,.08);padding:6px 8px;text-align:left;vertical-align:top}
      #${BOX_ID} th{position:sticky;top:0;background:#f8fafc;z-index:1}
      #${BOX_ID} .hiddenBody{display:none}
      #${BOX_ID} .navHint{margin-top:8px;padding:8px 10px;border-radius:12px;background:#f8fafc;border:1px solid rgba(37,99,235,.10)}
    `;
    document.head.appendChild(s);
  }

  function setStatus(msg){
    const el = document.querySelector(`#${BOX_ID} [data-x="status"]`);
    if (el) el.textContent = msg;
  }

  function updateContextMeta(){
    const ctx = loadHubContext();
    const prefixEl = document.querySelector(`#${BOX_ID} [data-x="ctxPrefix"]`);
    const partEl = document.querySelector(`#${BOX_ID} [data-x="ctxPartition"]`);
    const nameEl = document.querySelector(`#${BOX_ID} [data-x="ctxName"]`);
    const pageEl = document.querySelector(`#${BOX_ID} [data-x="ctxPage"]`);
    if (prefixEl) prefixEl.textContent = ctx.prefix || '—';
    if (partEl) partEl.textContent = ctx.partition || '—';
    if (nameEl) nameEl.textContent = ctx.name || '—';
    if (pageEl) pageEl.textContent = path.replace('/ipbx/','');
  }

  function updatePauseButton(){
    const btn = document.querySelector(`#${BOX_ID} [data-x="pause"]`);
    if (!btn) return;
    btn.disabled = !scanState.running;
    btn.textContent = scanState.paused ? 'המשך' : 'עצור';
  }

  function wait(ms){ return new Promise(r => setTimeout(r, ms)); }
  async function waitIfPaused(){ while (scanState.paused && !scanState.cancel) await wait(200); }
  function absUrl(href, base){ try { return new URL(href, base || location.href).toString(); } catch(e){ return ''; } }
  async function fetchText(url){ const res = await fetch(url, { credentials:'include' }); if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`); return await res.text(); }
  function parseHtml(html, url){ const doc = new DOMParser().parseFromString(html, 'text/html'); try { doc.__bmbyBaseUrl = url; } catch(e){} return doc; }
  function getInputValue(doc, id){ const el = doc.getElementById(id); return norm(el && ('value' in el ? el.value : el.textContent)); }
  function getText(doc, sel){ const el = doc.querySelector(sel); return norm(el ? el.textContent : ''); }
  function hasText(doc, re){ return re.test(norm(doc.body ? doc.body.textContent : '')); }
  function extractByRegex(text, re){ const m = text.match(re); return m ? norm(m[1]) : ''; }

  function extractExtensionRecord(html, url, linkMeta){
    const doc = parseHtml(html, url);
    const panelText = norm((doc.querySelector('#__qbws_wspanel729_shell') || doc.querySelector('#wspanel729') || doc.body).textContent || '');
    const extension = getInputValue(doc, 'txt_ext_num');
    const extensionCaption = getText(doc, '#txt_ext_numcaption');
    const textToScan = panelText + ' ' + norm(doc.body ? doc.body.textContent : '');
    const cfAlways = extractByRegex(textToScan, new RegExp('Call\\s*Forward\\s*Always\\s*is\\s*Enabled\\s*to\\s*:\\s*([^\\n\\r<]+)', 'i')).replace(/\s*\(by\s*default\).*$/i, '').trim();
    const cfNoAnswer = extractByRegex(textToScan, new RegExp('Call\\s*Forward\\s*No\\s*Answer\\s*is\\s*Enabled\\s*to\\s*:\\s*([^\\n\\r<]+)', 'i')).replace(/\s*\(by\s*default\).*$/i, '').trim();
    return {
      pageUrl: url,
      id: getInputValue(doc, 'hdn_user_id') || linkMeta.id || '',
      linkLabel: linkMeta.label || '',
      extension,
      extensionCaption,
      displayName: getInputValue(doc, 'txt_display_name'),
      directDid: getInputValue(doc, 'txt_direct_did'),
      outboundCid: getInputValue(doc, 'txt_outbound_cid'),
      email: getInputValue(doc, 'txt_email_address'),
      uniqueAddress: getInputValue(doc, 'txt_unique_address'),
      macAddress: getInputValue(doc, 'txt_mac_address'),
      alsoDial: getInputValue(doc, 'txt_dial_also'),
      dndStatus: extractByRegex(textToScan, /(DnD\s*is\s*Currently\s*(?:On|Off))/i),
      callForwardAlways: cfAlways,
      callForwardNoAnswer: cfNoAnswer,
      autoIncomingRecording: hasText(doc, /Automatic\s*Incoming\s*Call\s*Recording/i) ? 'Yes' : '',
      autoOutgoingRecording: hasText(doc, /Automatic\s*Outgoing\s*Call\s*Recording/i) ? 'Yes' : '',
      // partitionPinCode removed from output per v1.4.44
    };
  }

  function getUserLinksFromDoc(doc){
    const out = [];
    const seen = new Set();
    Array.from(doc.querySelectorAll('a[href*="users.php?id="]')).forEach(a => {
      const href = absUrl(a.getAttribute('href') || '', doc.__bmbyBaseUrl || location.href);
      if (!href || seen.has(href)) return;
      seen.add(href);
      const m = href.match(/[?&]id=(\d+)/i);
      const row = a.closest('tr');
      out.push({ href, id: m ? m[1] : '', label: norm(a.textContent) || 'Open', rowText: norm(row && row.textContent) });
    });
    return out;
  }

  function getUsersEditPageNumber(url){ try { const u = new URL(url, location.href); return Number(u.searchParams.get('_qb_users_lister_page') || '0') || 0; } catch(e){ return 0; } }
  function getStrictNextUsersEditUrlFromDoc(doc, currentUrl){
    const currentPage = getUsersEditPageNumber(currentUrl);
    const candidates = [];
    Array.from(doc.querySelectorAll('img[title="Next"], img[src*="NEXT.gif"]')).forEach(img => {
      const oc = img.getAttribute('onclick') || '';
      const m = oc.match(/window\.location\s*=\s*['"]([^'"]*users_edit\.php[^'"]*)['"]/i);
      if (m && m[1]) candidates.push(absUrl(m[1], doc.__bmbyBaseUrl || currentUrl));
    });
    Array.from(doc.querySelectorAll('a[href*="users_edit.php?_qb_users_lister_page="]')).forEach(a => { candidates.push(absUrl(a.getAttribute('href') || '', doc.__bmbyBaseUrl || currentUrl)); });
    for (const url of candidates) { const nextPage = getUsersEditPageNumber(url); if (nextPage === currentPage + 1) return url; }
    return '';
  }

  function toCsv(rows){
    const headers = ['UserID','Extension','ExtensionCaption','DisplayName','DirectDID','OutboundCID','Email','UniqueAddress','MAC','AlsoDial','DnD','CallForwardAlways','CallForwardNoAnswer','AUTO IN REC','AUTO OUT REC','PageURL'];
    const lines = [headers.join(',')];
    for (const r of rows) lines.push([r.id,r.extension,r.extensionCaption,r.displayName,r.directDid,r.outboundCid,r.email,r.uniqueAddress,r.macAddress,r.alsoDial,r.dndStatus,r.callForwardAlways,r.callForwardNoAnswer,r.autoIncomingRecording,r.autoOutgoingRecording,r.pageUrl].map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(','));
    return '\ufeff' + lines.join('\r\n');
  }

  function download(name, text, type){ const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }

  function renderRows(rows){
    const root = document.getElementById(BOX_ID); if (!root) return; const el = root.querySelector('[data-x="results"]'); if (!el) return;
    if (!rows.length) { el.innerHTML = '<div style="padding:10px">אין עדיין תוצאות</div>'; return; }
    el.innerHTML = `<table><thead><tr><th>#</th><th>UserID</th><th>Ext</th><th>Display Name</th><th>Direct DID</th><th>Outbound CID</th><th>Email</th><th>Unique Address</th><th>MAC</th><th>Also Dial</th><th>DnD</th><th>CF Always</th><th>CF No Answer</th><th>AUTO IN REC</th><th>AUTO OUT REC</th></tr></thead><tbody>${rows.map((r, idx) => `<tr><td>${idx+1}</td><td>${esc(r.id)}</td><td>${esc(r.extension || r.extensionCaption)}</td><td>${esc(r.displayName)}</td><td>${esc(r.directDid)}</td><td>${esc(r.outboundCid)}</td><td>${esc(r.email)}</td><td>${esc(r.uniqueAddress)}</td><td>${esc(r.macAddress)}</td><td>${esc(r.alsoDial)}</td><td>${esc(r.dndStatus)}</td><td>${esc(r.callForwardAlways)}</td><td>${esc(r.callForwardNoAnswer)}</td><td>${esc(r.autoIncomingRecording)}</td><td>${esc(r.autoOutgoingRecording)}</td></tr>`).join('')}</tbody></table>`;
  }

  function renderLinks(links){
    const root = document.getElementById(BOX_ID); if (!root) return; const el = root.querySelector('[data-x="results"]'); if (!el) return;
    if (!links.length) { el.innerHTML = '<div style="padding:10px">לא נמצאו קישורים</div>'; return; }
    el.innerHTML = `<table><thead><tr><th>#</th><th>UserID</th><th>Label</th><th>Link</th></tr></thead><tbody>${links.map((x, idx) => `<tr><td>${idx+1}</td><td>${esc(x.id || '')}</td><td>${esc(x.label || x.rowText || '')}</td><td><a href="${esc(x.href)}" target="_blank" rel="noopener noreferrer">פתח שלוחה</a></td></tr>`).join('')}</tbody></table>`;
  }

  async function collectAllUserLinks(){
    const all = []; const seenLinks = new Set(); const seenPages = new Set(); let currentUrl = location.href; let currentDoc = document; let pageCounter = 0; const maxPages = 25;
    while (currentUrl && !seenPages.has(currentUrl) && pageCounter < maxPages) {
      seenPages.add(currentUrl); pageCounter++; const pageNo = getUsersEditPageNumber(currentUrl); setStatus(`טוען דף שלוחות ${pageCounter} (pager ${pageNo})...`);
      let doc = currentDoc;
      if (!doc) { try { const html = await fetchText(currentUrl); doc = parseHtml(html, currentUrl); } catch (e) { log('pagination fetch failed', currentUrl, e); break; } }
      const items = getUserLinksFromDoc(doc);
      items.forEach(it => { if (!seenLinks.has(it.href)) { seenLinks.add(it.href); all.push(it); } });
      const nextUrl = getStrictNextUsersEditUrlFromDoc(doc, currentUrl); if (!nextUrl) break; if (seenPages.has(nextUrl)) break; const nextPage = getUsersEditPageNumber(nextUrl); if (nextPage !== pageNo + 1) break;
      currentUrl = nextUrl; currentDoc = null;
    }
    if (pageCounter >= maxPages) setStatus(`נעצרתי אחרי ${maxPages} דפי USERS כדי למנוע ריצה אינסופית. כרגע נאספו ${all.length} שלוחות.`);
    return all;
  }

  async function scanAllUsers(){
    if (scanState.running) { setStatus('כבר מתבצעת סריקה.'); return; }
    scanState.running = true; scanState.paused = false; scanState.cancel = false;
    const scanBtn = document.querySelector(`#${BOX_ID} [data-x="scan"]`); if (scanBtn) scanBtn.disabled = true; updatePauseButton();
    try {
      setStatus('אוסף קישורי שלוחות מהעמוד הנוכחי ומהעמודים הבאים...');
      const links = await collectAllUserLinks();
      if (!links.length) { setStatus('לא נמצאו קישורי users.php?id=... במסך הזה.'); renderRows([]); return; }
      setStatus(`נמצאו ${links.length} שלוחות. מתחיל סריקה...`);
      const out = [];
      for (let i=0; i<links.length; i++) {
        if (scanState.cancel) { setStatus(`הסריקה נעצרה. נשמרו ${out.length} תוצאות.`); break; }
        await waitIfPaused(); if (scanState.cancel) { setStatus(`הסריקה נעצרה. נשמרו ${out.length} תוצאות.`); break; }
        const link = links[i]; setStatus(`סורק שלוחה ${i+1}/${links.length} | id=${link.id || '?'} ...`);
        try { const html = await fetchText(link.href); const rec = extractExtensionRecord(html, link.href, link); out.push(rec); renderRows(out); }
        catch (e) { out.push({ pageUrl: link.href, id: link.id || '', linkLabel: link.label || '', extension: '', extensionCaption:'', displayName: 'ERROR', directDid: '', outboundCid: '', email: '', uniqueAddress: '', macAddress: '', alsoDial: String(e), dndStatus:'', callForwardAlways:'', callForwardNoAnswer:'', autoIncomingRecording:'', autoOutgoingRecording:'' }); renderRows(out); log('user fetch failed', link.href, e); }
      }
      window.__bmbyUsersScanRows = out; if (!scanState.cancel) setStatus(`✅ הושלמה סריקה: ${out.length} שלוחות.`);
    } finally { scanState.running = false; scanState.paused = false; scanState.cancel = false; if (scanBtn) scanBtn.disabled = false; updatePauseButton(); }
  }

  function loadPos(){ try { return JSON.parse(localStorage.getItem(POS_KEY) || 'null'); } catch(e){ return null; } }
  function savePos(pos){ try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch(e){} }
  function activateModule(name){ const box = document.getElementById(BOX_ID); if (!box) return; const currentModuleEl = box.querySelector('[data-x="currentModule"]'); const moduleButtons = Array.from(box.querySelectorAll('.modBtn')); const modulePanels = Array.from(box.querySelectorAll('.modulePanel')); moduleButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-module') === name)); modulePanels.forEach(p => p.classList.toggle('active', p.getAttribute('data-panel') === name)); if (currentModuleEl) currentModuleEl.textContent = name; }
  function goToModule(name){ const target = NAV_TARGETS[name] || ''; if (!target) { activateModule(name); setStatus(`המודול ${name} עדיין בשלד. נחבר את הדף המדויק בהמשך.`); return; } if (location.href !== target) location.assign(target); }
  function buildUsersPanel(){ return `<div class="modulePanel ${isUsersPage ? 'active' : ''}" data-panel="USERS"><div class="muted">מודול USERS פעיל. הלוגיקה הקיימת נשמרה: סריקת שלוחות, עצור/המשך, יצוא CSV ורשימת קישורים.</div><div class="row"><button type="button" class="primary" data-x="scan">סרוק שלוחות</button><button type="button" data-x="pause" disabled>עצור</button><button type="button" data-x="export">ייצא CSV</button><button type="button" data-x="links">רשימת קישורים</button></div><div class="status" data-x="status">מוכן לסריקה.</div><div class="results" data-x="results"><div style="padding:10px">אין עדיין תוצאות</div></div></div>`; }
  function buildPlaceholder(moduleName, text){ return `<div class="modulePanel" data-panel="${moduleName}"><div class="placeholder"><div><strong>${moduleName}</strong></div><div class="muted">${text}</div></div></div>`; }
  function buildHomePanel(){ const ctx = loadHubContext(); return `<div class="modulePanel ${isPartitionPage ? 'active' : ''}" data-panel="HOME"><div class="placeholder"><div><strong>מרכז בקרה ראשי</strong></div><div class="muted">כאן בוחרים מודול לאחר בחירת PREFIX. USERS, AGENTS ו-IVR MENU כבר מחוברים. IVR SWITCH עדיין מחכה לחיבור טכני.</div><div class="navHint">PREFIX נוכחי: <strong>${esc(ctx.prefix || '—')}</strong> | Partition: <strong>${esc(ctx.partition || '—')}</strong></div><div class="row"><button type="button" class="primary" data-x="openUsers">פתח USERS</button><button type="button" data-x="homeAgents">AGENTS</button><button type="button" data-x="homeIvrMenu">IVR MENU</button><button type="button" data-x="homeIvrSwitch">IVR SWITCH</button></div></div></div>`; }

  function mount(){
    tryAutoOpenUsersPage(); if (document.getElementById(BOX_ID)) return; injectCss();
    const box = document.createElement('div'); box.id = BOX_ID;
    box.innerHTML = `<div class="head"><div class="drag" data-x="drag">BMBY IPBX HUB v1.4.44</div><div class="headBtns"><button type="button" data-x="min">_</button></div></div><div data-x="body"><div class="hubMeta"><div class="metaPill">Version: 1.4.44</div><div class="metaPill">Host: ${esc(location.host)}</div><div class="metaPill">Prefix: <span data-x="ctxPrefix">—</span></div><div class="metaPill">Partition: <span data-x="ctxPartition">—</span></div><div class="metaPill">Name: <span data-x="ctxName">—</span></div><div class="metaPill">Current Module: <span data-x="currentModule">${isPartitionPage ? 'HOME' : 'USERS'}</span></div><div class="metaPill">Page: <span data-x="ctxPage">${esc(path.replace('/ipbx/',''))}</span></div></div><div class="modules"><button type="button" class="modBtn ${isUsersPage ? 'active' : ''}" data-module="USERS">USERS</button><button type="button" class="modBtn" data-module="AGENTS">AGENTS</button><button type="button" class="modBtn" data-module="IVR MENU">IVR MENU</button><button type="button" class="modBtn" data-module="IVR SWITCH">IVR SWITCH</button></div>${buildHomePanel()}${buildUsersPanel()}${buildPlaceholder('AGENTS','לחץ AGENTS כדי לעבור למסך agents_list ולהפעיל את מודול הסריקה.')}${buildPlaceholder('IVR MENU','מודול IVR MENU כבר מחובר. לחץ IVR MENU כדי לעבור למסך הסריקה.')}${buildPlaceholder('IVR SWITCH','שלד המודול מוכן. כאן נחבר בהמשך את מנוע IVR SWITCH.')}</div>`;
    document.body.appendChild(box);
    const saved = loadPos(); if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') { box.style.left = saved.left + 'px'; box.style.top = saved.top + 'px'; box.style.right = 'auto'; } else { box.style.right = '14px'; box.style.left = 'auto'; box.style.top = '14px'; }
    let dragging = false, dx = 0, dy = 0; const dragHandle = box.querySelector('[data-x="drag"]');
    dragHandle.addEventListener('mousedown', (ev) => { if (ev.button !== 0) return; dragging = true; const r = box.getBoundingClientRect(); dx = ev.clientX - r.left; dy = ev.clientY - r.top; ev.preventDefault(); });
    window.addEventListener('mousemove', (ev) => { if (!dragging) return; const left = Math.max(6, Math.min(window.innerWidth - 100, ev.clientX - dx)); const top = Math.max(6, Math.min(window.innerHeight - 40, ev.clientY - dy)); box.style.left = left + 'px'; box.style.top = top + 'px'; box.style.right = 'auto'; savePos({ left, top }); });
    window.addEventListener('mouseup', () => { dragging = false; });
    box.querySelector('[data-x="min"]').addEventListener('click', () => { const body = box.querySelector('[data-x="body"]'); const hidden = body.classList.toggle('hiddenBody'); box.classList.toggle('min', hidden); });
    Array.from(box.querySelectorAll('.modBtn')).forEach(btn => btn.addEventListener('click', () => { const name = btn.getAttribute('data-module') || 'USERS'; goToModule(name); }));
    const openUsersBtn = box.querySelector('[data-x="openUsers"]'); if (openUsersBtn) openUsersBtn.addEventListener('click', () => goToModule('USERS'));
    const homeAgents = box.querySelector('[data-x="homeAgents"]'); if (homeAgents) homeAgents.addEventListener('click', () => goToModule('AGENTS'));
    const homeIvrMenu = box.querySelector('[data-x="homeIvrMenu"]'); if (homeIvrMenu) homeIvrMenu.addEventListener('click', () => goToModule('IVR MENU'));
    const homeIvrSwitch = box.querySelector('[data-x="homeIvrSwitch"]'); if (homeIvrSwitch) homeIvrSwitch.addEventListener('click', () => { activateModule('IVR SWITCH'); setStatus('מודול IVR SWITCH עדיין בשלד.'); });
    if (isUsersPage) {
      box.querySelector('[data-x="scan"]').addEventListener('click', () => scanAllUsers());
      box.querySelector('[data-x="pause"]').addEventListener('click', () => { if (!scanState.running) return; scanState.paused = !scanState.paused; updatePauseButton(); setStatus(scanState.paused ? 'הסריקה מושהית. לחץ המשך כדי להמשיך.' : 'ממשיך סריקה...'); });
      box.querySelector('[data-x="export"]').addEventListener('click', () => { const rows = window.__bmbyUsersScanRows || []; if (!rows.length) { setStatus('אין תוצאות לייצוא עדיין.'); return; } download('bmby_ipbx_users_scan.csv', toCsv(rows), 'text/csv;charset=utf-8'); });
      box.querySelector('[data-x="links"]').addEventListener('click', async () => { const links = await collectAllUserLinks(); setStatus(`נמצאו ${links.length} קישורי שלוחות.`); renderLinks(links); });
      activateModule('USERS'); updatePauseButton();
    } else { activateModule('HOME'); setStatus('בחרת PREFIX? עכשיו אפשר להיכנס ל-USERS מתוך ה-HUB.'); }
    updateContextMeta();
    window.addEventListener('bmby-ipbx-context-updated', () => { updateContextMeta(); if (isPartitionPage) { activateModule('HOME'); setStatus('המרכזייה נבחרה. עכשיו אפשר לפתוח את המודול הרצוי.'); } });
    window.addEventListener('bmby-ipbx-open-module', (ev) => { const name = ev && ev.detail && ev.detail.module ? String(ev.detail.module) : 'HOME'; if (name === 'USERS') return goToModule('USERS'); activateModule(name); setStatus(`המודול ${name} עדיין בשלד.`); });
    try { const pending = localStorage.getItem('BMBY__IPBX_HUB_TARGET_MODULE') || ''; if (pending) { localStorage.removeItem('BMBY__IPBX_HUB_TARGET_MODULE'); if (pending === 'USERS') setTimeout(() => goToModule('USERS'), 50); else setTimeout(() => { activateModule(pending); setStatus(`המודול ${pending} עדיין בשלד.`); }, 50); } } catch(e){}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once:true });
  else mount();
}



function __bootIPBX_AGENTS_SCAN_HELPER__(){
  'use strict';

  const host = location.host;
  const path = location.pathname;
  const allowed = ['voip.bmby.com','voip2.bmby.com','82.166.228.179','82.166.228.180'];
  if (!allowed.includes(host)) return;
  if (path !== '/ipbx/agents_list.php' && path !== '/ipbx/agents.php') return;

  const BOX_ID = 'bmby-ipbx-agents-scan-box';
  const STYLE_ID = 'bmby-ipbx-agents-scan-style';
  const POS_KEY = 'bmby_ipbx_agents_scan_box_pos_v1';
  const HUB_CTX_KEY = 'BMBY__IPBX_HUB_CONTEXT';
  const LOG_PREFIX = '[BMBY IPBX AGENTS v1.4.44]';
  const scanState = { running:false, paused:false, cancel:false };
  const NAV_TARGETS = {
    'USERS': 'http://voip2.bmby.com/ipbx/users_edit.php',
    'AGENTS': 'http://voip2.bmby.com/ipbx/agents_list.php',
    'IVR MENU': 'http://voip2.bmby.com/ipbx/ivr_edit.php?type=MENU',
    'IVR SWITCH': ''
  };

  function log(){ try { console.log(LOG_PREFIX, ...arguments); } catch(e){} }
  function norm(s){ return String(s||'').replace(/[ ‎‏\s]+/g,' ').trim(); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function loadHubContext(){ try { return JSON.parse(localStorage.getItem(HUB_CTX_KEY) || '{}') || {}; } catch(e){ return {}; } }
  function setStatus(msg){ const el = document.querySelector(`#${BOX_ID} [data-x="status"]`); if (el) el.textContent = msg; }
  function wait(ms){ return new Promise(r => setTimeout(r, ms)); }
  async function waitIfPaused(){ while (scanState.paused && !scanState.cancel) await wait(200); }
  function absUrl(href, base){ try { return new URL(href, base || location.href).toString(); } catch(e){ return ''; } }
  async function fetchText(url){ const res = await fetch(url, { credentials:'include' }); if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`); return await res.text(); }
  function parseHtml(html, url){ const doc = new DOMParser().parseFromString(html, 'text/html'); try { doc.__bmbyBaseUrl = url; } catch(e){} return doc; }
  function getInputValue(doc, id){ const el = doc.getElementById(id); return norm(el && ('value' in el ? el.value : el.textContent)); }
  function download(name, text, type){ const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0); }
  function updatePauseButton(){ const btn = document.querySelector(`#${BOX_ID} [data-x="pause"]`); if (!btn) return; btn.disabled = !scanState.running; btn.textContent = scanState.paused ? 'המשך' : 'עצור'; }
  function loadPos(){ try { return JSON.parse(localStorage.getItem(POS_KEY) || 'null'); } catch(e){ return null; } }
  function savePos(pos){ try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch(e){} }

  function injectCss(){
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${BOX_ID}{position:fixed;top:14px;right:14px;left:auto;z-index:2147483647;width:760px;max-width:calc(100vw - 28px);background:#fff;color:#111;border:1px solid rgba(0,0,0,.14);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.20);padding:12px;font:700 12px/1.45 Arial,sans-serif}
      #${BOX_ID}.min{width:300px}
      #${BOX_ID} .head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
      #${BOX_ID} .drag{cursor:move;user-select:none;font-weight:900}
      #${BOX_ID} .headBtns{display:flex;gap:6px;align-items:center}
      #${BOX_ID} .row{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap}
      #${BOX_ID} .hubMeta{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 8px}
      #${BOX_ID} .metaPill{padding:4px 8px;border-radius:999px;background:#f5f5f5;border:1px solid rgba(0,0,0,.07);font-size:11px}
      #${BOX_ID} .modules{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:8px 0 10px}
      #${BOX_ID} .modBtn{padding:10px 8px;border:1px solid rgba(0,0,0,.12);border-radius:12px;background:#fff;cursor:pointer;font-weight:800;text-align:center}
      #${BOX_ID} .modBtn.active{background:rgba(37,99,235,.10);border-color:rgba(37,99,235,.35);box-shadow:0 0 0 2px rgba(37,99,235,.08) inset}
      #${BOX_ID} .muted{color:#666;font-size:11px}
      #${BOX_ID} button{padding:9px 10px;border:1px solid rgba(0,0,0,.16);background:#fff;border-radius:12px;cursor:pointer;font-weight:700}
      #${BOX_ID} button.primary{background:rgba(37,99,235,.10);border-color:rgba(37,99,235,.35)}
      #${BOX_ID} .status{margin-top:8px;padding:8px 10px;border-radius:12px;background:#f8fafc;border:1px solid rgba(0,0,0,.08)}
      #${BOX_ID} .results{margin-top:8px;max-height:380px;overflow:auto;border:1px solid rgba(0,0,0,.08);border-radius:12px;background:#fff}
      #${BOX_ID} table{width:100%;border-collapse:collapse;font:12px/1.4 Arial,sans-serif}
      #${BOX_ID} th,#${BOX_ID} td{border-bottom:1px solid rgba(0,0,0,.08);padding:6px 8px;text-align:left;vertical-align:top}
      #${BOX_ID} th{position:sticky;top:0;background:#f8fafc;z-index:1}
      #${BOX_ID} .hiddenBody{display:none}
    `;
    document.head.appendChild(s);
  }

  function updateContextMeta(){
    const ctx = loadHubContext();
    const prefixEl = document.querySelector(`#${BOX_ID} [data-x="ctxPrefix"]`);
    const partEl = document.querySelector(`#${BOX_ID} [data-x="ctxPartition"]`);
    const nameEl = document.querySelector(`#${BOX_ID} [data-x="ctxName"]`);
    const pageEl = document.querySelector(`#${BOX_ID} [data-x="ctxPage"]`);
    if (prefixEl) prefixEl.textContent = ctx.prefix || '—';
    if (partEl) partEl.textContent = ctx.partition || '—';
    if (nameEl) nameEl.textContent = ctx.name || '—';
    if (pageEl) pageEl.textContent = path.replace('/ipbx/','');
  }

  function extractByRegex(text, re){ const m = String(text||'').match(re); return m ? norm(m[1]) : ''; }

  function extractAgentRecord(html, url, linkMeta){
    const doc = parseHtml(html, url);
    const panelText = norm((doc.querySelector('#__qbws_wspanel729_shell') || doc.querySelector('#wspanel729') || doc.body).textContent || '');
    const textToScan = panelText + ' ' + norm(doc.body ? doc.body.textContent : '');
    const cfAlways = extractByRegex(textToScan, new RegExp('Call\\s*Forward\\s*Always\\s*is\\s*Enabled\\s*to\\s*:\\s*([^\\n\\r<]+)', 'i')).replace(/\s*\(by\s*default\).*$/i, '').trim();
    const cfNoAnswer = extractByRegex(textToScan, new RegExp('Call\\s*Forward\\s*No\\s*Answer\\s*is\\s*Enabled\\s*to\\s*:\\s*([^\\n\\r<]+)', 'i')).replace(/\s*\(by\s*default\).*$/i, '').trim();
    return {
      pageUrl: url,
      id: getInputValue(doc, 'hdn_user_id') || linkMeta.id || '',
      agentNumber: getInputValue(doc, 'txt_ext_num'),
      displayName: getInputValue(doc, 'txt_display_name'),
      directDid: getInputValue(doc, 'txt_direct_did'),
      outboundCid: getInputValue(doc, 'txt_outbound_cid'),
      email: getInputValue(doc, 'txt_email_address'),
      callForwardAlways: cfAlways,
      callForwardNoAnswer: cfNoAnswer,
      rawTitle: norm(doc.title || ''),
      linkLabel: linkMeta.label || ''
    };
  }

  function getAgentLinksFromDoc(doc){
    const out = [];
    const seen = new Set();
    Array.from(doc.querySelectorAll('a[href*="agents.php?id="]')).forEach(a => {
      const href = absUrl(a.getAttribute('href') || '', doc.__bmbyBaseUrl || location.href);
      if (!href || seen.has(href)) return;
      seen.add(href);
      const m = href.match(/[?&]id=(\d+)/i);
      const row = a.closest('tr');
      out.push({ href, id: m ? m[1] : '', label: norm(a.textContent) || 'Open', rowText: norm(row && row.textContent) });
    });
    return out;
  }

  function getAgentsListPageNumber(url){ try { const u = new URL(url, location.href); return Number(u.searchParams.get('_qb_agents_lister_page') || '0') || 0; } catch(e){ return 0; } }
  function getStrictNextAgentsListUrlFromDoc(doc, currentUrl){
    const currentPage = getAgentsListPageNumber(currentUrl);
    const candidates = [];
    Array.from(doc.querySelectorAll('img[title="Next"], img[src*="NEXT.gif"]')).forEach(img => {
      const oc = img.getAttribute('onclick') || '';
      const m = oc.match(/window\.location\s*=\s*['"]([^'"]*agents_list\.php[^'"]*)['"]/i);
      if (m && m[1]) candidates.push(absUrl(m[1], doc.__bmbyBaseUrl || currentUrl));
    });
    Array.from(doc.querySelectorAll('a[href*="agents_list.php?_qb_agents_lister_page="]')).forEach(a => { candidates.push(absUrl(a.getAttribute('href') || '', doc.__bmbyBaseUrl || currentUrl)); });
    for (const url of candidates) { const nextPage = getAgentsListPageNumber(url); if (nextPage === currentPage + 1) return url; }
    return '';
  }

  async function collectAllAgentLinks(){
    const out = [];
    const seenPages = new Set();
    const seenLinks = new Set();
    let currentUrl = location.href;
    let guard = 0;
    while (currentUrl && !seenPages.has(currentUrl) && guard < 50) {
      guard++;
      seenPages.add(currentUrl);
      const html = currentUrl === location.href ? document.documentElement.outerHTML : await fetchText(currentUrl);
      const doc = parseHtml(html, currentUrl);
      getAgentLinksFromDoc(doc).forEach(link => { if (!seenLinks.has(link.href)) { seenLinks.add(link.href); out.push(link); } });
      const nextUrl = getStrictNextAgentsListUrlFromDoc(doc, currentUrl);
      if (!nextUrl || seenPages.has(nextUrl)) break;
      currentUrl = nextUrl;
    }
    return out;
  }

  function toCsv(rows){
    const headers = ['AgentID','AgentNumber','DisplayName','DirectDID','OutboundCID','Email','CallForwardAlways','CallForwardNoAnswer','PageURL'];
    const escCsv = (v) => { const s = String(v==null?'':v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
    return [headers.join(','), ...rows.map(r => [r.id, r.agentNumber, r.displayName, r.directDid, r.outboundCid, r.email, r.callForwardAlways, r.callForwardNoAnswer, r.pageUrl].map(escCsv).join(','))].join('\n');
  }

  function renderRows(rows){
    const root = document.querySelector(`#${BOX_ID} [data-x="results"]`);
    if (!root) return;
    if (!rows || !rows.length) { root.innerHTML = '<div style="padding:10px">אין עדיין תוצאות</div>'; return; }
    root.innerHTML = `<table><thead><tr><th>AgentID</th><th>Agent Number</th><th>Display Name</th><th>Direct DID</th><th>Outbound CID</th><th>Email</th><th>CallForwardAlways</th><th>CallForwardNoAnswer</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.id)}</td><td>${esc(r.agentNumber)}</td><td>${esc(r.displayName)}</td><td>${esc(r.directDid)}</td><td>${esc(r.outboundCid)}</td><td>${esc(r.email)}</td><td>${esc(r.callForwardAlways)}</td><td>${esc(r.callForwardNoAnswer)}</td></tr>`).join('')}</tbody></table>`;
  }

  function renderLinks(links){
    const root = document.querySelector(`#${BOX_ID} [data-x="results"]`);
    if (!root) return;
    if (!links.length) { root.innerHTML = '<div style="padding:10px">לא נמצאו קישורים</div>'; return; }
    root.innerHTML = `<table><thead><tr><th>#</th><th>AgentID</th><th>Link</th></tr></thead><tbody>${links.map((l, idx) => `<tr><td>${idx+1}</td><td>${esc(l.id)}</td><td><a href="${esc(l.href)}" target="_blank" rel="noopener noreferrer">${esc(l.href)}</a></td></tr>`).join('')}</tbody></table>`;
  }

  async function scanAllAgents(){
    const scanBtn = document.querySelector(`#${BOX_ID} [data-x="scan"]`);
    if (scanState.running) return;
    scanState.running = true; scanState.paused = false; scanState.cancel = false; updatePauseButton(); if (scanBtn) scanBtn.disabled = true;
    try {
      const links = await collectAllAgentLinks();
      if (!links.length) { setStatus('לא נמצאו קישורי agents.php?id=... במסך הזה.'); renderRows([]); return; }
      setStatus(`נמצאו ${links.length} Agents. מתחיל סריקה...`);
      const out = [];
      for (let i=0; i<links.length; i++) {
        if (scanState.cancel) { setStatus(`הסריקה נעצרה. נשמרו ${out.length} תוצאות.`); break; }
        await waitIfPaused();
        if (scanState.cancel) { setStatus(`הסריקה נעצרה. נשמרו ${out.length} תוצאות.`); break; }
        const link = links[i];
        setStatus(`סורק Agent ${i+1}/${links.length} | id=${link.id || '?'} ...`);
        try {
          const html = await fetchText(link.href);
          const rec = extractAgentRecord(html, link.href, link);
          out.push(rec);
          renderRows(out);
        } catch (e) {
          out.push({ pageUrl: link.href, id: link.id || '', agentNumber: '', displayName: 'ERROR', directDid: '', outboundCid: '', email: String(e), callForwardAlways:'', callForwardNoAnswer:'', rawTitle:'', linkLabel: link.label || '' });
          renderRows(out);
          log('agent fetch failed', link.href, e);
        }
      }
      window.__bmbyAgentsScanRows = out;
      if (!scanState.cancel) setStatus(`✅ הושלמה סריקה: ${out.length} Agents.`);
    } finally {
      scanState.running = false; scanState.paused = false; scanState.cancel = false; if (scanBtn) scanBtn.disabled = false; updatePauseButton();
    }
  }

  function goToModule(name){
    const target = NAV_TARGETS[name] || '';
    if (!target) { setStatus(`המודול ${name} עדיין בשלד.`); return; }
    if (location.href !== target) location.assign(target);
  }

  function mount(){
    if (document.getElementById(BOX_ID)) return;
    injectCss();
    const box = document.createElement('div');
    box.id = BOX_ID;
    box.innerHTML = `<div class="head"><div class="drag" data-x="drag">BMBY IPBX AGENTS v1.4.44</div><div class="headBtns"><button type="button" data-x="min">_</button></div></div><div data-x="body"><div class="hubMeta"><div class="metaPill">Version: 1.4.44</div><div class="metaPill">Host: ${esc(location.host)}</div><div class="metaPill">Prefix: <span data-x="ctxPrefix">—</span></div><div class="metaPill">Partition: <span data-x="ctxPartition">—</span></div><div class="metaPill">Name: <span data-x="ctxName">—</span></div><div class="metaPill">Current Module: AGENTS</div><div class="metaPill">Page: <span data-x="ctxPage">${esc(path.replace('/ipbx/',''))}</span></div></div><div class="modules"><button type="button" class="modBtn" data-module="USERS">USERS</button><button type="button" class="modBtn active" data-module="AGENTS">AGENTS</button><button type="button" class="modBtn" data-module="IVR MENU">IVR MENU</button><button type="button" class="modBtn" data-module="IVR SWITCH">IVR SWITCH</button></div><div class="muted">מודול AGENTS – סריקה ראשונית. כרגע מושכים: Agent Number, Display Name, Direct DID, Outbound CID, Email, Call Forward Always, Call Forward No Answer.</div><div class="row"><button type="button" class="primary" data-x="scan">סרוק Agents</button><button type="button" data-x="pause" disabled>עצור</button><button type="button" data-x="export">ייצא CSV</button><button type="button" data-x="links">רשימת קישורים</button></div><div class="status" data-x="status">מוכן לסריקה.</div><div class="results" data-x="results"><div style="padding:10px">אין עדיין תוצאות</div></div></div>`;
    document.body.appendChild(box);

    const saved = loadPos();
    if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') { box.style.left = saved.left + 'px'; box.style.top = saved.top + 'px'; box.style.right = 'auto'; }
    else { box.style.right = '14px'; box.style.left = 'auto'; box.style.top = '14px'; }

    let dragging = false, dx = 0, dy = 0;
    const dragHandle = box.querySelector('[data-x="drag"]');
    dragHandle.addEventListener('mousedown', (ev) => { if (ev.button !== 0) return; dragging = true; const r = box.getBoundingClientRect(); dx = ev.clientX - r.left; dy = ev.clientY - r.top; ev.preventDefault(); });
    window.addEventListener('mousemove', (ev) => { if (!dragging) return; const left = Math.max(6, Math.min(window.innerWidth - 100, ev.clientX - dx)); const top = Math.max(6, Math.min(window.innerHeight - 40, ev.clientY - dy)); box.style.left = left + 'px'; box.style.top = top + 'px'; box.style.right = 'auto'; savePos({ left, top }); });
    window.addEventListener('mouseup', () => { dragging = false; });
    box.querySelector('[data-x="min"]').addEventListener('click', () => { const body = box.querySelector('[data-x="body"]'); const hidden = body.classList.toggle('hiddenBody'); box.classList.toggle('min', hidden); });
    Array.from(box.querySelectorAll('.modBtn')).forEach(btn => btn.addEventListener('click', () => { const name = btn.getAttribute('data-module') || 'AGENTS'; goToModule(name); }));
    box.querySelector('[data-x="scan"]').addEventListener('click', () => scanAllAgents());
    box.querySelector('[data-x="pause"]').addEventListener('click', () => { if (!scanState.running) return; scanState.paused = !scanState.paused; updatePauseButton(); setStatus(scanState.paused ? 'הסריקה מושהית. לחץ המשך כדי להמשיך.' : 'ממשיך סריקה...'); });
    box.querySelector('[data-x="export"]').addEventListener('click', () => { const rows = window.__bmbyAgentsScanRows || []; if (!rows.length) { setStatus('אין תוצאות לייצוא עדיין.'); return; } download('bmby_ipbx_agents_scan.csv', toCsv(rows), 'text/csv;charset=utf-8'); });
    box.querySelector('[data-x="links"]').addEventListener('click', async () => { const links = await collectAllAgentLinks(); setStatus(`נמצאו ${links.length} קישורי Agents.`); renderLinks(links); });
    updateContextMeta();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once:true });
  else mount();
}


function __bootIPBX_DID_HELPER__(){
  (function () {
    'use strict';
  try { console.log('%c[BMBY PROD] loaded v1.3.68','background:#222;color:#bada55;padding:2px 6px;border-radius:4px'); } catch(e) {}

  // Visible runtime marker
  try { console.log('[BMBY PROD] loaded v1.3.68'); } catch(e) {}
  try { (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).__BMBY_DASH_VER = '1.3.68'; } catch(e) {}


  // CSS.escape polyfill (needed for safe querySelector on dynamic IDs/names)
  const cssEscape = (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function')
    ? CSS.escape
    : function (value) {
        const str = String(value);
        // Minimal but safe escaper for CSS selectors
        return str.replace(/[^a-zA-Z0-9_-]/g, function (ch) {
          const hex = ch.codePointAt(0).toString(16).toUpperCase();
          return "\\%s ".replace("%s", hex);
        });
      };


    const LOG = (...a) => console.log('[BMBY-IPBX]', ...a);
    const ERR = (...a) => console.error('[BMBY-IPBX]', ...a);

    const url = new URL(location.href);
    const context = url.searchParams.get('context') || '';
    if (context && context !== 'pbx-did') return;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const q = (sel, root = document) => root.querySelector(sel);
    const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const escHtml = (s) => (s ?? '').toString()
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const norm = (s) => (s ?? '').toString().replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
    const onlyDigits = (s) => (s ?? '').toString().replace(/[^\d]/g, '');

    function downloadText(filename, text, mimeType = 'text/plain;charset=utf-8') {
      const blob = new Blob([text], { type: mimeType });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 2000);
    }

    function downloadExcelHtml(filename, headers, rows) {
      const css = `
        <style>
          table { border-collapse: collapse; direction: ltr; font-family: Arial, sans-serif; }
          th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: center; vertical-align: middle; white-space: pre-line; }
          th { font-weight: bold; background: #f7f7f7; }
        </style>`;
      const head = headers.map(h => `<th>${escHtml(h)}</th>`).join('');
      const body = rows.map(r => `<tr>${r.map(v => `<td>${escHtml(v)}</td>`).join('')}</tr>
              <tr>
                <td class="bmby-k">משתמשים</td>
                <td class="bmby-v"><span data-x="outUsers">—</span></td>
              </tr>
`).join('');
      const html = `<!doctype html><html><head><meta charset="utf-8">${css}</head><body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
      downloadText(filename, html, 'application/vnd.ms-excel');
    }

    function getExtInput() {
      return document.getElementById('extension_txt') || q('input[name="extension_txt"]') || null;
    }

    function findBestTable(root = document) {
      const tables = qa('table', root);
      let best = null, bestScore = -1;

      for (const t of tables) {
        const trs = qa('tr', t);
        if (!trs.length) continue;

        let digits6 = 0, partHits = 0, gotoHits = 0, headerHits = 0;

        const headTxt = norm((t.querySelector('thead') || t).textContent);
        if (/\bDID\b/i.test(headTxt)) headerHits++;
        if (/\bPartition\b/i.test(headTxt)) headerHits++;
        if (/\bContext\b/i.test(headTxt)) headerHits++;

        for (const tr of trs.slice(0, 200)) {
          const txt = norm(tr.textContent);
          if (!txt) continue;
          if (/\bGOTO\b/i.test(txt)) gotoHits++;
          if (/partition\s*:/i.test(txt)) partHits++;
          if (/\b\d{6,}\b/.test(txt)) digits6++;
        }

        const score = digits6 * 6 + partHits * 4 + gotoHits * 2 + headerHits * 6;
        if (score > bestScore) { bestScore = score; best = t; }
      }

      if (!best) return null;
      if (bestScore < 12) return null;
      return best;
    }

    function collectRowsFromTable(t) {
      if (!t) return [];
      const rows = qa('tbody tr', t);
      return rows.length ? rows : qa('tr', t);
    }

    function hasRealData(rows) {
      const sample = rows.slice(0, 80);
      let hits = 0;
      for (const r of sample) {
        const txt = norm(r.textContent);
        if (/\d{6,}/.test(txt)) hits++;
        if (/partition\s*:/i.test(txt)) hits++;
      }
      return hits >= 3;
    }


    function extractFieldsFromRowText(rowText) {
      const t = (rowText || '').toString().replace(/\u00A0/g, ' ').trim();
      const m = t.match(/Partition:\s*([^\s\n\r]+)[\s\S]*?Context:\s*([^\s\n\r]+)[\s\S]*?Extension:\s*([^\s\n\r]+)[\s\S]*?Step:\s*([^\s\n\r]+)/i);
      if (!m) return null;
      return { Partition: m[1], Context: m[2], Extension: m[3], Step: m[4] };
    }



    function getPartitionFromRowElement(rowEl) {
      try {
        // Typical structure seen:
        // <span class="normal_title">Partition:</span> ... <span class="caption">10004</span>
        const titles = Array.from(rowEl.querySelectorAll('span.normal_title, span.normalTitle, span.title'));
        for (const t of titles) {
          const tt = (t.textContent || '').toString().toLowerCase();
          if (tt.includes('partition')) {
            // Try nearest caption
            const cap = t.parentElement?.querySelector('span.caption') || t.nextElementSibling?.matches?.('span.caption') ? t.nextElementSibling : null;
            if (cap) {
              const d = (cap.textContent || '').toString().replace(/[^\d]/g,'');
              if (d) return d;
            }
            // Fallback: any digits near this title
            const near = (t.parentElement?.textContent || t.textContent || '');
            const m = near.match(/(\d{1,10})/);
            if (m) return m[1];
          }
        }
        // Fallback: any "Partition" label then digits in row text
        return getPartitionFromAnyText(rowEl.textContent || '');
      } catch {
        return '';
      }
    }

  function getPartitionFromAnyText(text) {
      const t = (text || '').toString().replace(/\u00A0/g, ' ');
      const m = t.match(/Partition\s*:?\s*(\d{1,10})/i);
      return m ? m[1] : '';
    }

    function pickGotoBlobFromCells(cellsText) {
      // Return the cell text that most likely contains the GOTO/Partition fields
      let best = '';
      let bestScore = -1;
      for (const ct of cellsText) {
        const s = (ct || '').toString();
        let score = 0;
        if (/\bGOTO\b/i.test(s)) score += 4;
        if (/Partition\s*:/i.test(s)) score += 6;
        if (/Context\s*:/i.test(s)) score += 3;
        if (/Extension\s*:/i.test(s)) score += 3;
        if (/Step\s*:/i.test(s)) score += 2;
        if (score > bestScore) { bestScore = score; best = s; }
      }
      return best;
    }

  function parseGotoFields(raw) {
      const t = (raw || '').toString().replace(/\u00A0/g, ' ').trim();
      const m = t.match(/(?:^|\b)(?:GOTO\s+)?Partition:\s*([^\s]+)[\s\S]*?Context:\s*([^\s]+)[\s\S]*?Extension:\s*([^\s]+)[\s\S]*?Step:\s*([^\s]+)/i);
      if (!m) return null;
      return { Partition: m[1], Context: m[2], Extension: m[3], Step: m[4] };
    }

    // UI
    const panel = document.createElement('div');
    panel.id = 'bmbyIpbxDidPanel';
    panel.style.position = 'fixed';
    panel.style.right = '12px';
    panel.style.top = '12px';
    panel.style.zIndex = '999999';
    panel.style.background = '#fff';
    panel.style.border = '1px solid #ddd';
    panel.style.borderRadius = '10px';
    panel.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
    panel.style.padding = '10px';
    panel.style.width = '360px';
    panel.style.fontFamily = 'Arial, sans-serif';
    panel.style.fontSize = '13px';

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;">
      <div id="bmbyIpbxDrag" style="position:absolute;left:0;top:0;height:34px;width:calc(100% - 170px);cursor:move;opacity:0;"></div>
        <div style="font-weight:bold;">BMBY IPBX – DID</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button id="bmbyMinimize" title="הקטן" style="padding:4px 8px;border:1px solid #ccc;border-radius:8px;background:#f7f7f7;cursor:pointer;">_</button>
        <button id="bmbyToggle" style="padding:4px 8px;border:1px solid #ccc;border-radius:8px;background:#f7f7f7;cursor:pointer;">OFF</button>
          <div style="opacity:.7;">v0.7.6+UI</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
        <input id="bmbyQuick" type="text" placeholder="חיפוש (* / 7338* / 10004=Partition / Partition: 10004 / DID )"
               style="flex:1;padding:6px;border:1px solid #ccc;border-radius:8px;direction:ltr;" />
        <button id="bmbyLoadAll" style="padding:6px 8px;border:1px solid #ccc;border-radius:8px;background:#f7f7f7;cursor:pointer;">טען *</button>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <button id="bmbyExportVisible" style="flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:8px;background:#f7f7f7;cursor:pointer;">ייצוא תוצאות (אקסל)</button>
        <button id="bmbyExportPrefixes" style="flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:8px;background:#f7f7f7;cursor:pointer;">ייצוא לפי תחיליות (אקסל)</button>
      </div>

      <details style="margin-bottom:8px;">
        <summary style="cursor:pointer;">תחיליות קבועות</summary>
        <div style="margin-top:6px;">
          <textarea id="bmbyPrefixSet" rows="4" style="width:100%;font-family:monospace;direction:ltr;">3
  4
  8
  9
  72
  73358
  73367
  7338
  73396
  747
  77
  52</textarea>
        </div>
        <div style="opacity:.8;margin-top:6px;">הייצוא לפי תחיליות מבצע fetch לכל prefix ומאחד לקובץ אחד.</div>
      </details>

      <div id="bmbyStatus" style="padding:6px;border:1px solid #eee;border-radius:8px;background:#fafafa;opacity:.9;">מוכן.</div>

      <div style="margin-top:8px;border-top:1px solid #eee;padding-top:8px;">
        <div style="font-weight:bold;margin-bottom:6px;">תוצאות (תצוגה)</div>
        <div id="bmbyPreviewMeta" style="opacity:.8;margin-bottom:6px;">—</div>
        <div id="bmbyPreview" style="max-height:220px;overflow:auto;border:1px solid #eee;border-radius:8px;"></div>
      </div>
    `;

    document.documentElement.appendChild(panel);

  // Minimized floating button (like NIHUL)
  const miniBtn = document.createElement('button');
  miniBtn.id = 'bmbyIpbxMiniBtn';
  miniBtn.textContent = 'BMBY IPBX';
  miniBtn.style.position = 'fixed';
  miniBtn.style.right = '12px';
  miniBtn.style.bottom = '12px';
  miniBtn.style.zIndex = '999999';
  miniBtn.style.padding = '10px 12px';
  miniBtn.style.borderRadius = '999px';
  miniBtn.style.border = '1px solid #ddd';
  miniBtn.style.background = '#fff';
  miniBtn.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
  miniBtn.style.cursor = 'pointer';
  miniBtn.style.display = 'none';
  document.documentElement.appendChild(miniBtn);


    // Show immediately
    try { panel.style.display = 'block'; } catch {}



  // Draggable (like NIHUL)
  const POS_KEY = 'bmby_ipbx_panel_pos_v1';
  function loadPos(){
    try { return JSON.parse(localStorage.getItem(POS_KEY) || 'null'); } catch(e){ return null; }
  }
  function savePos(pos){
    try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch(e){}
  }
  const savedPos = loadPos();
  if (savedPos && typeof savedPos.left === 'number' && typeof savedPos.top === 'number') {
    panel.style.left = savedPos.left + 'px';
    panel.style.top = savedPos.top + 'px';
    panel.style.right = 'auto';
  }

  let dragging = false;
  let dx = 0, dy = 0;
  const dragHandle = q('#bmbyIpbxDrag', panel) || panel;

  function onDown(ev){
    if (ev.button !== 0) return;
    const t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.closest('button'))) return;
    dragging = true;
    const r = panel.getBoundingClientRect();
    dx = ev.clientX - r.left;
    dy = ev.clientY - r.top;
    ev.preventDefault();
  }
  function onMove(ev){
    if (!dragging) return;
    const left = Math.max(6, ev.clientX - dx);
    const top = Math.max(6, ev.clientY - dy);
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.right = 'auto';
    savePos({ left, top });
  }
  function onUp(){ dragging = false; }
  dragHandle.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  const elToggle = q('#bmbyToggle', panel);
    const elQuick = q('#bmbyQuick', panel);
    const elLoadAll = q('#bmbyLoadAll', panel);
    const elExportVisible = q('#bmbyExportVisible', panel);
    const elExportPrefixes = q('#bmbyExportPrefixes', panel);
    const elStatus = q('#bmbyStatus', panel);
    const elPreview = q('#bmbyPreview', panel);
    const elPreviewMeta = q('#bmbyPreviewMeta', panel);
    const elPrefixSet = q('#bmbyPrefixSet', panel);
  try {
    if (elPrefixSet && !elPrefixSet.value.trim()) {
      elPrefixSet.value = '03*\n04*\n0722*\n0732*\n0733*\n0737*\n0747*\n08*\n09*\n052*\n';
    }
  } catch(e) {}


  const elMin = q('#bmbyMinimize', panel);
  function setMinimized(min){
    if (min){
      panel.style.display = 'none';
      miniBtn.style.display = 'block';
    } else {
      panel.style.display = 'block';
      miniBtn.style.display = 'none';
    }
  }
  if (elMin) elMin.addEventListener('click', () => setMinimized(true));
  miniBtn.addEventListener('click', () => setMinimized(false));



    // Autocomplete datalist
    const dl = document.createElement('datalist');
    dl.id = 'bmbyDidSuggest';
    document.documentElement.appendChild(dl);
    elQuick.setAttribute('list', dl.id);

    const ENABLE_KEY = 'bmby_ipbx_did_helper_enabled';
    const __ON_PARAM = 'bmbyDidOn';
    const __u0 = new URL(location.href);
    const __fromNav = (__u0.searchParams.get(__ON_PARAM) === '1');
    let isEnabled = __fromNav ? true : false;
    // Always default OFF for normal entry; keep ON only if we navigated with bmbyDidOn=1
    try { localStorage.setItem(ENABLE_KEY, '0'); } catch(e) {}
    // If param exists, clean it from URL (so refresh returns to default OFF)
    if (__fromNav) {
      try {
        __u0.searchParams.delete(__ON_PARAM);
        history.replaceState(null, '', __u0.toString());
      } catch(e) {}
    }

    let table = null;
    let allRows = [];
    let didIndex = [];
    let lastFilter = '';
    let suppressFilter = false;


    function renderEnabledState() {
      if (!elToggle) return;
      elToggle.textContent = isEnabled ? 'ON' : 'OFF';
      elToggle.style.background = isEnabled ? '#e9f9ef' : '#f7f7f7';
      elToggle.style.borderColor = isEnabled ? '#8ad19c' : '#ccc';

      elQuick.disabled = !isEnabled;
      elLoadAll.disabled = !isEnabled;
      elExportVisible.disabled = !isEnabled;
      elExportPrefixes.disabled = !isEnabled;

      if (!isEnabled) {
        updateStatus('OFF — הדף נטען בלי פעולה. לחץ ON כדי להתחיל.');
      }
    }

  function updateStatus(text) {
      elStatus.textContent = text;
    }

    function buildIndex() {
      table = findBestTable(document);
      if (!table) {
        didIndex = [];
        dl.innerHTML = '';
        elPreviewMeta.textContent = '—';
        elPreview.innerHTML = '<div style="padding:8px;opacity:.8;">עדיין לא נמצאה טבלת תוצאות (המתן/טען *).</div>';
        return false;
      }

      allRows = collectRowsFromTable(table);
      didIndex = [];

      for (const r of allRows) {
        const cells = qa('td,th', r).map(c => norm(c.textContent));
        if (!cells.length) continue;

        const rowText = norm(r.textContent);
        const looksLikeData = /\b\d{2,}\b/.test(rowText) || /partition/i.test(rowText) || /\bGOTO\b/i.test(rowText);
        if (!looksLikeData) continue;

        let did = cells[0] || '';
        // Normalize DID: must contain 6+ digits (otherwise skip this row)
        let didDigits = onlyDigits(did);
        if (didDigits.length < 2) {
          const mDid = rowText.match(/\b\d{2,}\b/);
          if (mDid) didDigits = mDid[0];
        }
        if (didDigits.length < 2) continue;
        did = didDigits;
        const blob = pickGotoBlobFromCells(cells);
        let g = parseGotoFields(blob || cells[2] || '');
        if (!g) g = extractFieldsFromRowText(blob || rowText);
        const partText = g?.Partition || getPartitionFromAnyText(blob || rowText) || getPartitionFromRowElement(r) || '';
        didIndex.push({
          did,
          part: g?.Partition || '',
          partText: partText,
          ctx: g?.Context || '',
          ext: g?.Extension || '',
          step: g?.Step || '',
          row: r,
          text: rowText,
        });
      }

      const uniq = new Set();
      const opts = [];
      for (const it of didIndex) {
        const d = it.did;
        if (!d) continue;
        if (uniq.has(d)) continue;
        if (!/\d/.test(d)) continue;
        uniq.add(d);
        opts.push(d);
        if (opts.length >= 800) break;
      }
      dl.innerHTML = opts.map(v => `<option value="${escHtml(v)}"></option>`).join('');

      updatePreview();
      return true;
    }

    function updatePreview(sample = 80) {
      const visible = didIndex.filter(it => !it.row.classList.contains('bmbyHidden'));
      elPreviewMeta.textContent = `Rows: ${didIndex.length} | Visible: ${visible.length}`;

      const take = visible.slice(0, sample);
      elPreview.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:12px;direction:ltr;">
          <thead>
            <tr>
              <th style="border-bottom:1px solid #ddd;padding:4px;text-align:left;">DID</th>
              <th style="border-bottom:1px solid #ddd;padding:4px;text-align:left;">Partition</th>
              <th style="border-bottom:1px solid #ddd;padding:4px;text-align:left;">Context</th>
              <th style="border-bottom:1px solid #ddd;padding:4px;text-align:left;">Extension</th>
              <th style="border-bottom:1px solid #ddd;padding:4px;text-align:left;">Step</th>
            </tr>
          </thead>
          <tbody>
            ${take.map(it => `
              <tr>
                <td style="border-bottom:1px solid #f0f0f0;padding:4px;">${escHtml(it.did)}</td>
                <td style="border-bottom:1px solid #f0f0f0;padding:4px;">${escHtml(it.part)}</td>
                <td style="border-bottom:1px solid #f0f0f0;padding:4px;">${escHtml(it.ctx)}</td>
                <td style="border-bottom:1px solid #f0f0f0;padding:4px;">${escHtml(it.ext)}</td>
                <td style="border-bottom:1px solid #f0f0f0;padding:4px;">${escHtml(it.step)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    function showAllRows() {
      for (const it of didIndex) it.row.classList.remove('bmbyHidden');
      updatePreview();
    }

    function applyPrefixSetFilter(){
      const raw = (elPrefixSet?.value || '').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      if (!raw.length) { showAllRows(); return; }
      const prefixes = raw.map(p => p.endsWith('*') ? p.slice(0,-1) : p);
      for (const it of didIndex) {
        const did = String(it.did || '');
        let ok = false;
        for (const p of prefixes) { if (did.startsWith(p)) { ok = true; break; } }
        if (ok) it.row.classList.remove('bmbyHidden');
        else it.row.classList.add('bmbyHidden');
      }
      updatePreview();
    }

function applyFilter(qRaw) {
      const qText = norm(qRaw);
      if (qText === lastFilter) return;
      lastFilter = qText;

      if (!qText || qText === '*') {
        showAllRows();
        return;
      }

      // Partition: 10004  |  Partition 10004  |  (typos) Partit... 10004
      const pm = qText.match(/partit\w*\s*:?\s*(\d+)/i);
      let partition = pm ? pm[1] : '';

      // Remove the partition clause from the rest of the query (so it won't be treated as DID digits)
      const qRest = pm ? norm(qText.replace(pm[0], '')) : qText;

      // If user typed only digits (e.g., 10004) and it matches any Partition in the loaded data,
      // treat it as a Partition filter (because DID won't contain it).
      let treatDigitsAsPartition = false;
      if (!partition && qRest && /^\d+$/.test(qRest)) {
        const anyPartMatch = didIndex.some(it => (it.part || it.partText || '').toString() === qRest);
        if (anyPartMatch) {
          partition = qRest;
          treatDigitsAsPartition = true;
        }
      }

      const isSeries = qRest.endsWith('*');
      const qPrefix = isSeries ? onlyDigits(qRest.slice(0, -1)) : '';
      const qDigits = onlyDigits(qRest);

      for (const it of didIndex) {
        let ok = true;

        if (partition) {
          const p = (it.part || it.partText || getPartitionFromAnyText(it.text) || '').toString();
          ok = ok && (p === partition);
        }

        if (isSeries) {
          ok = ok && it.did.startsWith(qPrefix);
        } else if (qDigits) {
          if (!treatDigitsAsPartition) ok = ok && it.did.includes(qDigits);
        } else if (qRest) {
          ok = ok && it.text.toLowerCase().includes(qRest.toLowerCase());
        }

        it.row.classList.toggle('bmbyHidden', !ok);
      }

      updatePreview();
    }

    async function loadAllByNavigation() {
      const u = new URL(location.href);
      u.searchParams.set('context', 'pbx-did');
      u.searchParams.set('ext', '*');
      updateStatus('טוען מספרים (ext=*)…');
      location.replace(u.toString());
      return true;
    }

    async function fetchDocForExt(extValueWithStar) {
      const u = new URL(location.href);
      u.searchParams.set('context', 'pbx-did');
      u.searchParams.set('ext', extValueWithStar);
      const res = await fetch(u.toString(), { credentials: 'include' });
      const text = await res.text();
      return new DOMParser().parseFromString(text, 'text/html');
    }

    function extractRowsFromDoc(doc) {
      const t = findBestTable(doc);
      return collectRowsFromTable(t);
    }

    async function exportVisibleExcel() {
      if (!didIndex.length) buildIndex();
      const visible = didIndex.filter(it => !it.row.classList.contains('bmbyHidden'));
      if (!visible.length) {
        updateStatus('אין תוצאות נראות לייצוא.');
        return;
      }

      const rows = visible.map(it => [it.did, it.part, it.ctx, it.ext, it.step]);
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
      const fn = `did-results-${stamp}.xls`;
      downloadExcelHtml(fn, ['DID','Partition','Context','Extension','Step'], rows);
      updateStatus(`יוצא אקסל ✅ (${rows.length} שורות)`);
    }

    async function exportPrefixSetExcel() {
      const raw = elPrefixSet.value || '';
      const prefixes = raw.split(/\s+/).map(s => s.trim()).filter(Boolean);
      if (!prefixes.length) { updateStatus('אין תחיליות.'); return; }

      // Partition in quick field optionally
      const qRaw = elQuick.value || '*';
      const pm = norm(qRaw).match(/partit\w*\s*:?\s*(\d+)/i);
      let partition = pm ? pm[1] : '';

      const qText = norm(qRaw);
      const qRest = pm ? norm(qText.replace(pm[0], '')) : qText;
      const qDigits = onlyDigits(qRest);

      // Heuristic: if user typed only digits (e.g., 10004) and it matches any Partition in data,
      // treat it as Partition filter (because DID won't contain it).
      const digitsOnlyQuery = qRest && /^\d+$/.test(qRest);
      let treatDigitsAsPartition = false;
      if (digitsOnlyQuery) {
        const anyPartMatch = didIndex.some(it => (it.part || it.partText || '').toString() === qRest);
        treatDigitsAsPartition = anyPartMatch;
      }
      if (treatDigitsAsPartition && !partition) partition = qRest;


      const out = [];
      for (let i=0; i<prefixes.length; i++) {
        const p = prefixes[i];
        const extVal = `${p}*`;
        updateStatus(`מושך… ${i+1}/${prefixes.length} ext=${extVal}`);
        const doc = await fetchDocForExt(extVal);
        const rows = extractRowsFromDoc(doc);
        if (!rows.length) continue;

        for (const r of rows) {
          const cells = qa('td,th', r).map(c => norm(c.textContent));
          if (!cells.length) continue;

          let did = cells[0] || '';
        // Normalize DID: must contain 6+ digits (otherwise skip this row)
        let didDigits = onlyDigits(did);
        if (didDigits.length < 2) {
          const mDid = rowText.match(/\b\d{2,}\b/);
          if (mDid) didDigits = mDid[0];
        }
        if (didDigits.length < 2) continue;
        did = didDigits;
          const rowText = norm(r.textContent);
          const blob = pickGotoBlobFromCells(cells) || rowText;
          let g = parseGotoFields(blob);
          if (!g) g = extractFieldsFromRowText(blob);
          const part = g?.Partition || getPartitionFromAnyText(blob) || getPartitionFromRowElement(r) || '';
          const ctx  = g?.Context || '';
          const ext  = g?.Extension || '';
          const step = g?.Step || '';

          if (partition && part != partition) continue;

          // apply quick filter if user typed something other than "*" or "Partition: ..."
          if (qRest && qRest !== '*' && !pm) {
            if (qRest.endsWith('*')) {
              const pp = onlyDigits(qRest.slice(0, -1));
              if (pp && !did.startsWith(pp)) continue;
            } else if (qDigits) {
              if (!did.includes(qDigits)) continue;
            } else {
              const t = norm(r.textContent).toLowerCase();
              if (!t.includes(qRest.toLowerCase())) continue;
            }
          }

          out.push([did, part, ctx, ext, step]);
        }
      }

      if (!out.length) { updateStatus('לא נמצאו תוצאות לייצוא לפי תחיליות.'); return; }

      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
      const fn = `did-prefixes-${stamp}.xls`;
      downloadExcelHtml(fn, ['DID','Partition','Context','Extension','Step'], out);
      updateStatus(`יוצא אקסל ✅ (${out.length} שורות)`);
    }

    renderEnabledState();

    elToggle.addEventListener('click', () => {
      isEnabled = !isEnabled;
      localStorage.setItem(ENABLE_KEY, isEnabled ? '1' : '0');
      renderEnabledState();
      if (isEnabled) {
    if (isEnabled) init().catch(e => ERR('init failed', e));
      }
    });

  elLoadAll.addEventListener('click', () => { updateStatus('טוען מספרים (ext=*)…'); loadAllByNavigation().catch(ERR); });

    elQuick.addEventListener('input', () => {
      if (!isEnabled) return;
      if (suppressFilter) return;
      if (!didIndex.length) buildIndex();
      applyFilter(elQuick.value);
    });

    elExportVisible.addEventListener('click', () => { if (!isEnabled) return; exportVisibleExcel().catch(ERR); });
    elExportPrefixes.addEventListener('click', () => {
      if (!isEnabled) return;
      applyPrefixSetFilter();
      updateStatus('סינון לפי תחיליות הוחל. אם תרצה קובץ — לחץ "ייצוא תוצאות (אקסל)".');
    });


    async function waitForResultsTable({ tries = 40, delayMs = 250 } = {}) {
      for (let i = 0; i < tries; i++) {
        const t = findBestTable(document);
        if (t) {
          const rows = collectRowsFromTable(t);
          if (rows.length && hasRealData(rows)) return true;
        }
        await sleep(delayMs);
      }
      return false;
    }

  async function init() {
      if (!isEnabled) { renderEnabledState(); return; }
      updateStatus('טוען מספרים…');

      if (document.readyState === 'loading') {
        await new Promise(res => document.addEventListener('DOMContentLoaded', res, { once: true }));
      }
      await sleep(200);

      const extParam = (new URL(location.href)).searchParams.get('ext') || '';
      const hasTableNow = await waitForResultsTable({ tries: 6, delayMs: 200 });

      if (!hasTableNow && extParam !== '*') {
        updateStatus('טוען מספרים (ext=*)…');
        const u = new URL(location.href);
        u.searchParams.set('context', 'pbx-did');
        u.searchParams.set('ext', '*');
        u.searchParams.set(__ON_PARAM, '1');
        location.replace(u.toString());
  return;
      }

      const ok = await waitForResultsTable({ tries: 40, delayMs: 250 });
      if (!ok) {
        updateStatus('לא נמצאה טבלת תוצאות. נסה ללחוץ "טען *" או לרענן.');
        buildIndex();
        return;
      }

      buildIndex();
      if (elQuick.value) applyFilter(elQuick.value);
      updateStatus(`מוכן ✅ (${didIndex.length} שורות אינדקס)`);
    }
    if (isEnabled) init().catch(e => ERR('init failed', e));

  })();
}


(function(){
  'use strict';
  const host = location.hostname;
  const path = location.pathname || '';
  const isNihul = path.startsWith('/nihul/') && (host === 'www.bmby.com' || host === 'bmby.com');
  const isIPBXDialplan = (path === '/ipbx/dialplan_edit.php') && (host === 'voip.bmby.com' || host === 'voip2.bmby.com' || host === '82.166.228.179' || host === '82.166.228.180');

function __bootIPBX_IVR_MENU_SCAN_HELPER__(){
  const host = location.host;
  const path = location.pathname;
  const typeParam = String(new URL(location.href).searchParams.get('type') || '').toLowerCase();
  if (path !== '/ipbx/ivr_edit.php' || typeParam !== 'menu') return;

  const BOX_ID = 'bmby-ipbx-ivr-menu-scan-box';
  const STYLE_ID = 'bmby-ipbx-ivr-menu-scan-style';
  const POS_KEY = 'bmby_ipbx_ivr_menu_scan_box_pos_v1';
  const HUB_CTX_KEY = 'BMBY__IPBX_HUB_CONTEXT';
  const LOG_PREFIX = '[BMBY IPBX IVR MENU v1.4.44]';
  const scanState = { running:false, paused:false, cancel:false };
  const NAV_TARGETS = {
    'USERS': 'http://voip2.bmby.com/ipbx/users_edit.php',
    'AGENTS': 'http://voip2.bmby.com/ipbx/agents_list.php',
    'IVR MENU': 'http://voip2.bmby.com/ipbx/ivr_edit.php?type=MENU',
    'IVR SWITCH': ''
  };

  function log(){ try { console.log(LOG_PREFIX, ...arguments); } catch(e){} }
  function norm(s){ return String(s||'').replace(/[ ‎‏\s]+/g,' ').trim(); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function loadHubContext(){ try { return JSON.parse(localStorage.getItem(HUB_CTX_KEY) || '{}') || {}; } catch(e){ return {}; } }
  function setStatus(msg){ const el = document.querySelector(`#${BOX_ID} [data-x="status"]`); if (el) el.textContent = msg; }
  function wait(ms){ return new Promise(r => setTimeout(r, ms)); }
  async function waitIfPaused(){ while (scanState.paused && !scanState.cancel) await wait(200); }
  function absUrl(href, base){ try { return new URL(href, base || location.href).toString(); } catch(e){ return ''; } }
  async function fetchText(url){ const res = await fetch(url, { credentials:'include' }); if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`); return await res.text(); }
  function parseHtml(html, url){ const doc = new DOMParser().parseFromString(html, 'text/html'); try { doc.__bmbyBaseUrl = url; } catch(e){} return doc; }
  function getInputValue(doc, id){ const el = doc.getElementById(id); return norm(el && ('value' in el ? el.value : el.textContent)); }
  function getSelectedText(doc, id){ const el = doc.getElementById(id); if (!el) return ''; if (el.tagName === 'SELECT') { const opt = el.selectedOptions && el.selectedOptions[0]; if (opt) return norm(opt.textContent); const sel = Array.from(el.options || []).find(o => o.selected); if (sel) return norm(sel.textContent); } return norm(el.value || el.textContent); }
  function updatePauseButton(){ const btn = document.querySelector(`#${BOX_ID} [data-x="pause"]`); if (!btn) return; btn.disabled = !scanState.running; btn.textContent = scanState.paused ? 'המשך' : 'עצור'; }
  function loadPos(){ try { return JSON.parse(localStorage.getItem(POS_KEY) || 'null'); } catch(e){ return null; } }
  function savePos(pos){ try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch(e){} }
  function download(name, text, type){ const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0); }

  function injectCss(){
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${BOX_ID}{position:fixed;top:14px;right:14px;left:auto;z-index:2147483647;width:820px;max-width:calc(100vw - 28px);background:#fff;color:#111;border:1px solid rgba(0,0,0,.14);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.20);padding:12px;font:700 12px/1.45 Arial,sans-serif}
      #${BOX_ID}.min{width:320px}
      #${BOX_ID} .head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
      #${BOX_ID} .drag{cursor:move;user-select:none;font-weight:900}
      #${BOX_ID} .headBtns{display:flex;gap:6px;align-items:center}
      #${BOX_ID} .row{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap}
      #${BOX_ID} .hubMeta{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 8px}
      #${BOX_ID} .metaPill{padding:4px 8px;border-radius:999px;background:#f5f5f5;border:1px solid rgba(0,0,0,.07);font-size:11px}
      #${BOX_ID} .modules{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:8px 0 10px}
      #${BOX_ID} .modBtn{padding:10px 8px;border:1px solid rgba(0,0,0,.12);border-radius:12px;background:#fff;cursor:pointer;font-weight:800;text-align:center}
      #${BOX_ID} .modBtn.active{background:rgba(37,99,235,.10);border-color:rgba(37,99,235,.35);box-shadow:0 0 0 2px rgba(37,99,235,.08) inset}
      #${BOX_ID} .muted{color:#666;font-size:11px}
      #${BOX_ID} button{padding:9px 10px;border:1px solid rgba(0,0,0,.16);background:#fff;border-radius:12px;cursor:pointer;font-weight:700}
      #${BOX_ID} button.primary{background:rgba(37,99,235,.10);border-color:rgba(37,99,235,.35)}
      #${BOX_ID} .status{margin-top:8px;padding:8px 10px;border-radius:12px;background:#f8fafc;border:1px solid rgba(0,0,0,.08)}
      #${BOX_ID} .results{margin-top:8px;max-height:420px;overflow:auto;border:1px solid rgba(0,0,0,.08);border-radius:12px;background:#fff}
      #${BOX_ID} table{width:100%;border-collapse:collapse;font:12px/1.4 Arial,sans-serif}
      #${BOX_ID} th,#${BOX_ID} td{border-bottom:1px solid rgba(0,0,0,.08);padding:6px 8px;text-align:left;vertical-align:top}
      #${BOX_ID} th{position:sticky;top:0;background:#f8fafc;z-index:1}
      #${BOX_ID} .hiddenBody{display:none}
    `;
    document.head.appendChild(s);
  }

  function updateContextMeta(){
    const ctx = loadHubContext();
    const prefixEl = document.querySelector(`#${BOX_ID} [data-x="ctxPrefix"]`);
    const partEl = document.querySelector(`#${BOX_ID} [data-x="ctxPartition"]`);
    const nameEl = document.querySelector(`#${BOX_ID} [data-x="ctxName"]`);
    const pageEl = document.querySelector(`#${BOX_ID} [data-x="ctxPage"]`);
    if (prefixEl) prefixEl.textContent = ctx.prefix || '—';
    if (partEl) partEl.textContent = ctx.partition || '—';
    if (nameEl) nameEl.textContent = ctx.name || '—';
    if (pageEl) pageEl.textContent = path.replace('/ipbx/','') + '?type=menu';
  }

  function parseActions(doc){
    const rows = [];
    for (let i = 0; i < 20; i++) {
      const value = getInputValue(doc, `txt_value_${i}`);
      const actionType = getSelectedText(doc, `objects_txt_action_${i}`);
      const actionTarget = getSelectedText(doc, `targets_txt_action_${i}`) || getInputValue(doc, `goto_txt_action_${i}`);
      if (!value && !actionType && !actionTarget) continue;
      rows.push({ value, actionType, actionTarget, summary: `${value || '?'}=>${actionType || '?'}:${actionTarget || ''}`.trim() });
    }
    return rows;
  }

  function extractIvrId(doc, url){
    try { const u = new URL(url, location.href); const direct = u.searchParams.get('id'); if (direct) return direct; } catch(e){}
    const attrsLink = Array.from(doc.querySelectorAll('a[onclick*="ivr_attributes.php?id="]')).map(a => a.getAttribute('onclick') || '').find(Boolean) || '';
    const m = attrsLink.match(/ivr_attributes\.php\?id=(\d+)/i);
    return m ? m[1] : '';
  }

  function extractIvrRecord(html, url, linkMeta){
    const doc = parseHtml(html, url);
    const actions = parseActions(doc);
    const rec = {
      pageUrl: url,
      id: extractIvrId(doc, url) || linkMeta.id || '',
      ivrName: getInputValue(doc, 'txt_ivr_name'),
      testExtension: getInputValue(doc, 'txt_goto_ivr_extension'),
      didNumber: getInputValue(doc, 'txt_did_number'),
      announcement1: getSelectedText(doc, 'txt_announcements_1'),
      announcement2: getSelectedText(doc, 'txt_announcements_2'),
      announcement3: getSelectedText(doc, 'txt_announcements_3'),
      actionsCount: String(actions.length),
      actionsSummary: actions.map(a => a.summary).join(' | '),
      rawTitle: norm(doc.title || ''),
      linkLabel: linkMeta.label || ''
    };
    const isEmptyIvr =
      !String(rec.ivrName || '').trim() &&
      !String(rec.testExtension || '').trim() &&
      !String(rec.didNumber || '').trim() &&
      !String(rec.announcement1 || '').trim() &&
      !String(rec.announcement2 || '').trim() &&
      !String(rec.announcement3 || '').trim() &&
      String(rec.actionsCount || '0') === '0';
    if (isEmptyIvr) return null;
    return rec;
  }

  function getIvrLinksFromDoc(doc){
    const out = [];
    const seenHref = new Set();
    const seenId = new Set();
    function shouldKeepIvrUrl(u){
      const p = (u.pathname || '').toLowerCase();
      const isList = p.endsWith('/ivr_edit.php');
      const isOpen = p.endsWith('/ivr.php');
      if (!isList && !isOpen) return false;
      if (u.searchParams.get('qbjs') || u.searchParams.get('qbjax') || u.searchParams.get('wsqbcallfunc') || u.searchParams.get('triggerer')) return false;
      const type = String(u.searchParams.get('type') || '').toLowerCase();
      if (type && type !== 'menu') return false;
      if (isOpen && !String(u.searchParams.get('id') || '').trim()) return false;
      return true;
    }
    function pushLink(rawHref, label){
      const href = absUrl(rawHref || '', doc.__bmbyBaseUrl || location.href);
      if (!href) return;
      try {
        const u = new URL(href, location.href);
        if (!shouldKeepIvrUrl(u)) return;
        const id = String(u.searchParams.get('id') || '').trim();
        if (id) {
          if (seenId.has(id)) return;
          seenId.add(id);
        } else if (seenHref.has(u.toString())) {
          return;
        }
        seenHref.add(u.toString());
        out.push({ href: u.toString(), id, label: norm(label) || 'Open IVR MENU' });
      } catch(e) {}
    }
    Array.from(doc.querySelectorAll('a[href*="ivr.php?type="], a[href*="ivr_edit.php?type="]')).forEach(a => {
      const row = a.closest('tr');
      const label = (row && (row.querySelector('[id*="users_lister_name_span_"]') || row.querySelector('td:nth-child(3) span'))) ? ((row.querySelector('[id*="users_lister_name_span_"]') || row.querySelector('td:nth-child(3) span')).textContent || '') : a.textContent;
      pushLink(a.getAttribute('href') || '', label);
    });
    Array.from(doc.querySelectorAll('[onclick*="ivr.php"], [onclick*="ivr_edit.php"]')).forEach(el => {
      const oc = el.getAttribute('onclick') || '';
      const matches = [...oc.matchAll(/['"]([^'"]*(?:ivr|ivr_edit)\.php[^'"]*)['"]/ig)];
      matches.forEach(m => { if (m && m[1]) pushLink(m[1], el.textContent || el.getAttribute('title') || 'Open IVR MENU'); });
    });
    const currentName = getInputValue(doc, 'txt_ivr_name');
    const currentId = extractIvrId(doc, location.href);
    if (currentName && currentId) {
      const u = new URL(urlWithTypeMenu(location.href), location.href);
      u.searchParams.set('id', currentId);
      pushLink(u.toString(), currentName || doc.title || 'Current IVR MENU');
    }
    return out;
  }

  function urlWithTypeMenu(url){
    try { const u = new URL(url, location.href); if (!u.searchParams.get('type')) u.searchParams.set('type', 'menu'); return u.toString(); } catch(e){ return url; }
  }

  async function collectAllIvrLinks(){
    const out = [];
    const seen = new Set();
    const html = document.documentElement.outerHTML;
    const doc = parseHtml(html, location.href);
    getIvrLinksFromDoc(doc).forEach(link => { if (!seen.has(link.href)) { seen.add(link.href); out.push(link); } });
    return out;
  }

  function toCsv(rows){
    const headers = ['IVRID','IVRName','TestExtension','DIDNumber','Announcement1','Announcement2','Announcement3','ActionsCount','ActionsSummary','PageURL'];
    const escCsv = (v) => { const s = String(v==null?'':v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
    return [headers.join(','), ...rows.map(r => [r.id, r.ivrName, r.testExtension, r.didNumber, r.announcement1, r.announcement2, r.announcement3, r.actionsCount, r.actionsSummary, r.pageUrl].map(escCsv).join(','))].join('\n');
  }

  function renderRows(rows){
    const root = document.querySelector(`#${BOX_ID} [data-x="results"]`);
    if (!root) return;
    if (!rows || !rows.length) { root.innerHTML = '<div style="padding:10px">אין עדיין תוצאות</div>'; return; }
    root.innerHTML = `<table><thead><tr><th>IVRID</th><th>IVR Name</th><th>Test Ext</th><th>DID</th><th>Announcement 1</th><th>Announcement 2</th><th>Announcement 3</th><th>Actions Count</th><th>Actions Summary</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.id)}</td><td>${esc(r.ivrName)}</td><td>${esc(r.testExtension)}</td><td>${esc(r.didNumber)}</td><td>${esc(r.announcement1)}</td><td>${esc(r.announcement2)}</td><td>${esc(r.announcement3)}</td><td>${esc(r.actionsCount)}</td><td>${esc(r.actionsSummary)}</td></tr>`).join('')}</tbody></table>`;
  }

  function renderLinks(links){
    const root = document.querySelector(`#${BOX_ID} [data-x="results"]`);
    if (!root) return;
    if (!links.length) { root.innerHTML = '<div style="padding:10px">לא נמצאו קישורי IVR MENU</div>'; return; }
    root.innerHTML = `<table><thead><tr><th>#</th><th>IVRID</th><th>Link</th></tr></thead><tbody>${links.map((l, idx) => `<tr><td>${idx+1}</td><td>${esc(l.id)}</td><td><a href="${esc(l.href)}" target="_blank" rel="noopener noreferrer">${esc(l.href)}</a></td></tr>`).join('')}</tbody></table>`;
  }

  async function scanAllIvrMenus(){
    const scanBtn = document.querySelector(`#${BOX_ID} [data-x="scan"]`);
    if (scanState.running) return;
    scanState.running = true; scanState.paused = false; scanState.cancel = false; updatePauseButton(); if (scanBtn) scanBtn.disabled = true;
    try {
      const links = await collectAllIvrLinks();
      if (!links.length) { setStatus('לא נמצאו קישורי IVR MENU במסך הזה.'); renderRows([]); return; }
      setStatus(`נמצאו ${links.length} קישורי IVR MENU. מתחיל סריקה...`);
      const out = [];
      for (let i=0; i<links.length; i++) {
        if (scanState.cancel) { setStatus(`הסריקה נעצרה. נשמרו ${out.length} תוצאות.`); break; }
        await waitIfPaused();
        if (scanState.cancel) { setStatus(`הסריקה נעצרה. נשמרו ${out.length} תוצאות.`); break; }
        const link = links[i];
        setStatus(`סורק IVR MENU ${i+1}/${links.length} | id=${link.id || '?'} ...`);
        try {
          const html = link.href === location.href ? document.documentElement.outerHTML : await fetchText(link.href);
          const rec = extractIvrRecord(html, link.href, link);
          if (!rec) {
            setStatus(`מדלג על IVR ריק ${i+1}/${links.length} | id=${link.id || '?'}`);
            continue;
          }
          out.push(rec);
          renderRows(out);
        } catch (e) {
          out.push({ pageUrl: link.href, id: link.id || '', ivrName: 'ERROR', testExtension: '', didNumber: '', announcement1: '', announcement2: '', announcement3: '', actionsCount: '0', actionsSummary: String(e), rawTitle:'', linkLabel: link.label || '' });
          renderRows(out);
          log('ivr menu fetch failed', link.href, e);
        }
      }
      window.__bmbyIvrMenuScanRows = out;
      if (!scanState.cancel) setStatus(`✅ הושלמה סריקה: ${out.length} IVR MENU.`);
    } finally {
      scanState.running = false; scanState.paused = false; scanState.cancel = false; if (scanBtn) scanBtn.disabled = false; updatePauseButton();
    }
  }

  function goToModule(name){ const target = NAV_TARGETS[name] || ''; if (!target) { setStatus(`המודול ${name} עדיין בשלד.`); return; } if (location.href !== target) location.assign(target); }

  function mount(){
    if (document.getElementById(BOX_ID)) return;
    injectCss();
    const box = document.createElement('div');
    box.id = BOX_ID;
    box.innerHTML = `<div class="head"><div class="drag" data-x="drag">BMBY IPBX IVR MENU v1.4.44</div><div class="headBtns"><button type="button" data-x="min">_</button></div></div><div data-x="body"><div class="hubMeta"><div class="metaPill">Version: 1.4.44</div><div class="metaPill">Host: ${esc(location.host)}</div><div class="metaPill">Prefix: <span data-x="ctxPrefix">—</span></div><div class="metaPill">Partition: <span data-x="ctxPartition">—</span></div><div class="metaPill">Name: <span data-x="ctxName">—</span></div><div class="metaPill">Current Module: IVR MENU</div><div class="metaPill">Page: <span data-x="ctxPage">ivr_edit.php?type=menu</span></div></div><div class="modules"><button type="button" class="modBtn" data-module="USERS">USERS</button><button type="button" class="modBtn" data-module="AGENTS">AGENTS</button><button type="button" class="modBtn active" data-module="IVR MENU">IVR MENU</button><button type="button" class="modBtn" data-module="IVR SWITCH">IVR SWITCH</button></div><div class="muted">מודול IVR MENU – התחלה ראשונית. כרגע מושכים: IVR Name, Test IVR Extension, DID Number, Announcement 1-3, וכמה פעולות נמצאו עם סיכום שלהן.</div><div class="row"><button type="button" class="primary" data-x="scan">סרוק IVR MENU</button><button type="button" data-x="pause" disabled>עצור</button><button type="button" data-x="export">ייצא CSV</button><button type="button" data-x="links">רשימת קישורים</button></div><div class="status" data-x="status">מוכן לסריקה.</div><div class="results" data-x="results"><div style="padding:10px">אין עדיין תוצאות</div></div></div>`;
    document.body.appendChild(box);

    const saved = loadPos();
    if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') { box.style.left = saved.left + 'px'; box.style.top = saved.top + 'px'; box.style.right = 'auto'; }
    else { box.style.right = '14px'; box.style.left = 'auto'; box.style.top = '14px'; }

    let dragging = false, dx = 0, dy = 0;
    const dragHandle = box.querySelector('[data-x="drag"]');
    dragHandle.addEventListener('mousedown', (ev) => { if (ev.button !== 0) return; dragging = true; const r = box.getBoundingClientRect(); dx = ev.clientX - r.left; dy = ev.clientY - r.top; ev.preventDefault(); });
    window.addEventListener('mousemove', (ev) => { if (!dragging) return; const left = Math.max(6, Math.min(window.innerWidth - 100, ev.clientX - dx)); const top = Math.max(6, Math.min(window.innerHeight - 40, ev.clientY - dy)); box.style.left = left + 'px'; box.style.top = top + 'px'; box.style.right = 'auto'; savePos({ left, top }); });
    window.addEventListener('mouseup', () => { dragging = false; });
    box.querySelector('[data-x="min"]').addEventListener('click', () => { const body = box.querySelector('[data-x="body"]'); const hidden = body.classList.toggle('hiddenBody'); box.classList.toggle('min', hidden); });
    Array.from(box.querySelectorAll('.modBtn')).forEach(btn => btn.addEventListener('click', () => { const name = btn.getAttribute('data-module') || 'IVR MENU'; goToModule(name); }));
    box.querySelector('[data-x="scan"]').addEventListener('click', () => scanAllIvrMenus());
    box.querySelector('[data-x="pause"]').addEventListener('click', () => { if (!scanState.running) return; scanState.paused = !scanState.paused; updatePauseButton(); setStatus(scanState.paused ? 'הסריקה מושהית. לחץ המשך כדי להמשיך.' : 'ממשיך סריקה...'); });
    box.querySelector('[data-x="export"]').addEventListener('click', () => { const rows = window.__bmbyIvrMenuScanRows || []; if (!rows.length) { setStatus('אין תוצאות לייצוא עדיין.'); return; } download('bmby_ipbx_ivr_menu_scan.csv', toCsv(rows), 'text/csv;charset=utf-8'); });
    box.querySelector('[data-x="links"]').addEventListener('click', async () => { const links = await collectAllIvrLinks(); setStatus(`נמצאו ${links.length} קישורי IVR MENU.`); renderLinks(links); });
    updateContextMeta();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once:true });
  else mount();
}

  const isIPBXPartition = (path === '/ipbx/partition_selection.php') && (host === 'voip.bmby.com' || host === 'voip2.bmby.com' || host === '82.166.228.179' || host === '82.166.228.180');
  const isIPBXUsersEdit = (path === '/ipbx/users_edit.php') && (host === 'voip.bmby.com' || host === 'voip2.bmby.com' || host === '82.166.228.179' || host === '82.166.228.180');
  const isIPBXAgents = (path === '/ipbx/agents_list.php' || path === '/ipbx/agents.php') && (host === 'voip.bmby.com' || host === 'voip2.bmby.com' || host === '82.166.228.179' || host === '82.166.228.180');
  const isIPBXIvrMenu = (path === '/ipbx/ivr_edit.php' && String(new URL(location.href).searchParams.get('type') || '').toLowerCase() === 'menu') && (host === 'voip.bmby.com' || host === 'voip2.bmby.com' || host === '82.166.228.179' || host === '82.166.228.180');
  if (isNihul) { try { __bootNIHUL_DASHBOARD__(); } catch(e){ console.error('[BMBY PROD] NIHUL boot error', e); } /* no-return */ }
  if (isIPBXDialplan) { try { __bootIPBX_DID_HELPER__(); } catch(e){ console.error('[BMBY PROD] IPBX boot error', e); } /* no-return */ }
  if (isIPBXPartition) { try { __bootIPBX_PARTITION_PREFIX_HELPER__(); } catch(e){ console.error('[BMBY PROD] IPBX partition boot error', e); } /* no-return */ }
  if (isIPBXUsersEdit) { try { __bootIPBX_USERS_SCAN_HELPER__(); } catch(e){ console.error('[BMBY PROD] IPBX users scan boot error', e); } /* no-return */ }
  if (isIPBXAgents) { try { __bootIPBX_AGENTS_SCAN_HELPER__(); } catch(e){ console.error('[BMBY PROD] IPBX agents scan boot error', e); } /* no-return */ }
  if (isIPBXIvrMenu) { try { __bootIPBX_IVR_MENU_SCAN_HELPER__(); } catch(e){ console.error('[BMBY PROD] IPBX IVR MENU scan boot error', e); } /* no-return */ }
})();



(function __bmbyModulesOverlay(){
  const DASH_ID = 'bmby-prod-dash';
  const VIS_KEY = 'bmby_prod_tab_visibility_v1';

  function getVis(){
    try { return JSON.parse(localStorage.getItem(VIS_KEY) || '{}') || {}; } catch(e){ return {}; }
  }
  function setVis(v){
    try { localStorage.setItem(VIS_KEY, JSON.stringify(v || {})); } catch(e){}
  }

  function attach(dash){
    if (!dash || dash.__bmbyModulesAttached) return;
    dash.__bmbyModulesAttached = true;

    const tabs = dash.querySelector('[data-x="tabs"]');
    const panel = dash.querySelector('[data-x="panel"]');
    if (!tabs || !panel) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bmby-tab';
    btn.dataset.tab = '__modules__';
    btn.textContent = 'מודולים';
    tabs.appendChild(btn);

    function listRealTabs(){
      return Array.from(tabs.querySelectorAll('.bmby-tab'))
        .filter(b => b.dataset.tab && b.dataset.tab !== '__modules__');
    }

    function applyVis(){
      const vis = getVis();
      const real = listRealTabs();
      for (const b of real) {
        const id = b.dataset.tab;
        const show = (vis[id] !== false);
        b.style.display = show ? '' : 'none';
      }
      const active = tabs.querySelector('.bmby-tab.active');
      if (active && active.style.display === 'none') {
        const first = real.find(b => b.style.display !== 'none');
        if (first) first.click();
      }
    }

    function openModules(){
      for (const b of tabs.querySelectorAll('.bmby-tab')) b.classList.toggle('active', b.dataset.tab === '__modules__');

      const real = listRealTabs();
      const vis = getVis();
      panel.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'bmby-card-inner';
      wrap.innerHTML = `
        <div style="font-weight:700;margin-bottom:8px;">בחירת מודולים להצגה</div>
        <div style="opacity:.85;margin-bottom:10px;">נשמר מקומית לכל משתמש.</div>
        <div data-x="mods" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;"></div>
      `;
      const mods = wrap.querySelector('[data-x="mods"]');

      for (const b of real) {
        const id = b.dataset.tab;
        const label = b.textContent.trim();
        const item = document.createElement('label');
        item.style.cssText = "display:flex;gap:8px;align-items:center;padding:8px;border:1px solid #e6e6e6;border-radius:10px;cursor:pointer;";
        const checked = (vis[id] !== false);
        item.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''} /> <span style="font-weight:600;">${label}</span>`;
        const cb = item.querySelector('input');
        cb.addEventListener('change', () => {
          const next = getVis();
          next[id] = !!cb.checked;

          const anyOn = real.some(bb => (bb.dataset.tab in next ? next[bb.dataset.tab] : true));
          if (!anyOn && real[0]) next[real[0].dataset.tab] = true;

          setVis(next);
          applyVis();
        });
        mods.appendChild(item);
      }
      panel.appendChild(wrap);
    }

    btn.addEventListener('click', openModules);
    applyVis();
  }

  function scan(){
    const dash = document.getElementById(DASH_ID);
    if (dash) attach(dash);
  }

  const mo = new MutationObserver(() => scan());
  mo.observe(document.documentElement, { childList:true, subtree:true });
  scan();
})();


/***********************
 * BMBY-UsersCount (stable)
 * - Counts users + detects inactive users by fetching each EditUser page
 * - IMPORTANT: must use FromNihul=1 to get full page content (wrappUserDetails / notActive)
 ***********************/
(() => {
  "use strict";

  const UC_VER = "1.3.81";

  const log = (...a) => console.log("[BMBY-UsersCount]", ...a);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function getQueryParam(name) {
    try { return new URL(location.href).searchParams.get(name); } catch { return null; }
  }

  function pickProjectAndCompanyFromDashboardFallback() {
    // Try to read from the EditProject tool input (where you type ProjectID)
    // This avoids relying on URL query params (Wizard pages often don't have ProjectID/CompanyID).
    const pid =
      document.querySelector('input[data-x="pid"]')?.value?.trim() ||
      document.querySelector('input[name="ProjectID"]')?.value?.trim() ||
      "";
    const cid =
      document.querySelector('input[data-x="cid"]')?.value?.trim() ||
      document.querySelector('input[name="CompanyID"]')?.value?.trim() ||
      "";

    return {
      projectId: pid || null,
      companyId: cid || null,
    };
  }

  function extractUserIdsFromAddProject2Html(html) {
    const out = new Set();

    // Common patterns we saw:
    // 1) ...EditUser.php?UserID=57076...
    // 2) ...EditUser_objectID=9681&FromNihul=1... (sometimes appears in openwindow javascript)
    // We'll mainly use UserID.

  async function extractUserIdsViaIframe(usersUrlAbs, timeoutMs = 12000) {
    // Same-origin only. Used when the Users page is rendered by JS and fetch() HTML doesn't include the links.
    return new Promise((resolve) => {
      let done = false;
      const iframe = document.createElement('iframe');

      const finish = (ids) => {
        if (done) return;
        done = true;
        try { iframe.remove(); } catch (_) {}
        resolve(Array.isArray(ids) ? ids : []);
      };

      iframe.style.position = 'fixed';
      iframe.style.left = '-99999px';
      iframe.style.top = '-99999px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.setAttribute('aria-hidden', 'true');

      const to = setTimeout(() => finish([]), timeoutMs);

      iframe.onload = async () => {
        clearTimeout(to);
        try {
          // give the page a bit of time to run its JS and render the list
          await new Promise(r => setTimeout(r, 1500));

          const doc = iframe.contentDocument;
          if (!doc) return finish([]);

          const parts = [];
          doc.querySelectorAll('a[href], [onclick*="EditUser"]').forEach((el) => {
            const h = el.getAttribute('href') || '';
            const o = el.getAttribute('onclick') || '';
            if (h) parts.push(h);
            if (o) parts.push(o);
          });

          const big = parts.join('\n');
          const ids = [];
          const re = /EditUser\.php\?[^\s"'<>]*?UserID=(\d+)/gi;
          let mm;
          while ((mm = re.exec(big))) ids.push(mm[1]);

          finish(Array.from(new Set(ids)));
        } catch (e) {
          console.warn('[BMBY-UsersCount] iframe extract failed', e);
          finish([]);
        }
      };

      iframe.src = usersUrlAbs;
      document.documentElement.appendChild(iframe);
    });
  }

  const reUserId = /EditUser\.php\?UserID=(\d+)/g;
    let m;
    while ((m = reUserId.exec(html))) out.add(m[1]);

    // Fallback: some pages might embed "UserID=123" without the full EditUser.php prefix
    if (out.size === 0) {
      const reLoose = /\bUserID=(\d+)\b/g;
      while ((m = reLoose.exec(html))) out.add(m[1]);
    }

    return Array.from(out);
  }

  function classifyEditUserHtml(htmlText) {
    // Use DOM parsing for robustness (entities, spacing, etc.)
    try {
      const doc = new DOMParser().parseFromString(htmlText, "text/html");

      const wrap = doc.querySelector(".wrappUserDetails");
      const inactiveEl = doc.querySelector(".wrappUserDetails .notActive, .fixedHeaderWrapp .notActive, .notActive");

      if (!wrap) {
        // Usually means we didn't get the full EditUser page (e.g. missing FromNihul=1 or got a short/other page)
        return { status: "unknown", reason: "no_wrappUserDetails" };
      }

      if (inactiveEl) return { status: "inactive", reason: "has_notActive" };
      return { status: "active", reason: "no_notActive" };
    } catch (e) {
      return { status: "unknown", reason: "domparse_failed" };
    }
  }

  async function fetchText(url, timeoutMs = 12000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { credentials: "include", redirect: "follow", signal: ctrl.signal });
      const txt = await r.text();
      return { ok: true, status: r.status, finalUrl: r.url, text: txt };
    } catch (e) {
      return { ok: false, error: String(e) };
    } finally {
      clearTimeout(t);
    }
  }

  async function scanUsersInactive(opts = {}) {
    const projectId =
      String(opts.projectId || "").trim() ||
      getQueryParam("ProjectID") ||
      pickProjectAndCompanyFromDashboardFallback().projectId;

    const companyId =
      String(opts.companyId || "").trim() ||
      getQueryParam("CompanyID") ||
      pickProjectAndCompanyFromDashboardFallback().companyId;

    if (!projectId || !companyId) {
      log("Missing ProjectID/CompanyID. Provide opts {projectId, companyId} or run from a page that has them in URL.");
      return { total: 0, active: 0, inactive: 0, unknown: 0, fetchErrors: 0, ids: [], samples: [] };
    }

    const addProjectUrl = `/nihul/AddProject2.php?ProjectID=${encodeURIComponent(projectId)}&CompanyID=${encodeURIComponent(companyId)}&BrokerageProject=no`;
    const addRes = await fetchText(addProjectUrl, 15000);
    if (!addRes.ok) {
      log("Failed to fetch AddProject2:", addRes.error);
      return { total: 0, active: 0, inactive: 0, unknown: 0, fetchErrors: 1, ids: [], samples: [{status:"fetch_error", where:"AddProject2", error:addRes.error}] };
    }

    const ids = extractUserIdsFromAddProject2Html(addRes.text);
    const total = ids.length;

    const MAX_SCAN = Number.isFinite(opts.maxScan) ? Math.max(0, opts.maxScan) : 250;
    const list = ids.slice(0, Math.min(total, MAX_SCAN));

    const CONC = Number.isFinite(opts.concurrency) ? Math.max(1, opts.concurrency) : 6;

    let inactive = 0, active = 0, unknown = 0, fetchErrors = 0;
    const samples = [];
    const resultsById = {};

    let idx = 0;
    async function worker(wi) {
      while (idx < list.length) {
        const myIdx = idx++;
        const userId = list[myIdx];

        const url = `/preferences/EditUser.php?UserID=${encodeURIComponent(userId)}&ProjectID=${encodeURIComponent(projectId)}&FromNihul=1`;

        const res = await fetchText(url, 15000);
        if (!res.ok) {
          fetchErrors++;
          resultsById[userId] = { userId, status: "fetch_error", error: res.error };
          if (samples.length < 10) samples.push(resultsById[userId]);
          continue;
        }

        const cls = classifyEditUserHtml(res.text);
        const row = { userId, status: cls.status, reason: cls.reason, len: res.text.length };

        resultsById[userId] = row;

        if (cls.status === "inactive") inactive++;
        else if (cls.status === "active") active++;
        else unknown++;

        // Record samples: first 5 + all inactive + any unknown/fetch_error (up to a cap)
        if (samples.length < 5 || cls.status !== "active") {
          if (samples.length < 25) samples.push(row);
        }

        if (typeof opts.onProgress === "function") {
          try {
            opts.onProgress({
              done: myIdx + 1,
              total: list.length,
              active, inactive, unknown, fetchErrors,
              lastUserId: userId,
              lastStatus: cls.status,
            });
          } catch {}
        }

        // small jitter to reduce server stress
        await sleep(120 + Math.floor(Math.random() * 120));
      }
    }

    const workers = Array.from({ length: CONC }, (_, wi) => worker(wi));
    await Promise.all(workers);

    return { total, scanned: list.length, active, inactive, unknown, fetchErrors, ids, samples, projectId, companyId };
  }

  window.BMBY_scanUsersInactive = scanUsersInactive;

  // Hook: if the dashboard defines runUsersCount(projectId, companyId), keep args and forward them.
  if (typeof window.runUsersCount === "function") {
    const prev = window.runUsersCount;
    window.runUsersCount = async function (projectId, companyId) {
      // If caller passes args, use them. Otherwise fallback to old behavior.
      const res = await window.BMBY_scanUsersInactive({ projectId, companyId });
      return res;
    };
    window.runUsersCount._bmbyUsersCountWrapped = true;
    window.runUsersCount._bmbyUsersCountVer = UC_VER;
    window.runUsersCount._bmbyUsersCountPrev = prev;
  }

  log(`loaded v${UC_VER}`);
})();;

