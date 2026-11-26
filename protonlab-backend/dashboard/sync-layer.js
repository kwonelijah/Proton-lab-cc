/* ===== Hosted sync layer (dashboard/sync-layer.js, served at /sync-layer.js
   by api/admin.js ?view=sync; index.html loads it before the app) =====

   The app below was written for one browser's localStorage. Hosted at
   /dashboard, this layer runs FIRST:
     1. pulls every section from the server (/api/admin?action=state) into this
        origin's localStorage — which doubles as the offline read cache;
     2. starts the app unchanged (its <script type="text/plain" id="pl-app">);
     3. pushes every write to a business key back to the server (debounced),
        three-way merging against the server copy on a 409 so edits made on
        another device are never overwritten;
     4. sends same-origin /api calls with the session cookie + X-PL header.
   Offline: the cached copy is shown read-only; a change made offline is NOT
   saved (toast), and the page reloads from the server once back online.
   Opened as a file:// page it does nothing but start the app. */
(function(){
  "use strict";
  const appEl = document.getElementById("pl-app");
  function startApp(){
    const s = document.createElement("script");
    s.textContent = appEl.textContent;
    document.body.appendChild(s);
  }
  if(!/^https?:$/.test(location.protocol)){ startApp(); return; }

  const MAP = {
    proton_orders_v6:"orders", proton_ws_manual_v1:"manual", proton_planner_v1:"planner",
    proton_clubshops_v1:"clubshops", proton_retail_costs_v1:"retailcosts",
    proton_analytics_v1:"analytics", proton_stock_aliases_v1:"stockAliases",
  };
  const KEY_OF = Object.fromEntries(Object.entries(MAP).map(([k,s])=>[s,k]));
  /* Per-device fields that must never sync (they describe this device's
     IndexedDB Stripe cache, not business data). */
  const LOCAL_FIELDS = { analytics:["lastSync","liteScanAt"] };
  const META_KEY = "pl_sync_meta_v1";
  const rawSet = Storage.prototype.setItem;
  const rawGet = Storage.prototype.getItem;
  const rawRemove = Storage.prototype.removeItem;
  const ls = window.localStorage;

  /* meta: server[s] = {v, data} last known server copy; known[s] = the data
     the running app last loaded/wrote (its view); dirty[s] = unsynced write. */
  let meta;
  try{ meta = JSON.parse(rawGet.call(ls, META_KEY)) || {}; }catch(e){ meta = {}; }
  meta.server ||= {}; meta.known ||= {}; meta.dirty ||= {};
  const saveMeta = () => { try{ rawSet.call(ls, META_KEY, JSON.stringify(meta)); }catch(e){ console.warn("sync meta not saved", e); } };

  let offline = false, discarded = false, stale = false, user = null;
  window.PL_HOSTED = true;
  document.documentElement.classList.add("pl-hosted");

  /* ---------- helpers ---------- */
  const isObj = v => v && typeof v === "object" && !Array.isArray(v);
  function stable(v){
    if(Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
    if(isObj(v)) return "{" + Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>JSON.stringify(k)+":"+stable(v[k])).join(",") + "}";
    return JSON.stringify(v === undefined ? null : v);
  }
  const eq = (a,b) => stable(a) === stable(b);
  const idArray = a => Array.isArray(a) && a.length > 0 && a.every(x => isObj(x) && (typeof x.id === "string" || typeof x.id === "number"));
  const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));

  /* Three-way merge: b = common ancestor, l = this device, s = server.
     A side that left a value as it was in b yields to the other side; when
     both changed the same leaf, this device wins (it is the newest action). */
  function merge3(b, l, s){
    if(eq(l, b)) return clone(s);
    if(eq(s, b) || eq(l, s)) return clone(l);
    if((idArray(l) || Array.isArray(l) && !l.length) && (idArray(s) || Array.isArray(s) && !s.length)) return mergeById(Array.isArray(b) ? b : [], l, s);
    if(isObj(l) && isObj(s)){
      const out = {}, bb = isObj(b) ? b : {};
      for(const k of new Set([...Object.keys(l), ...Object.keys(s)])){
        const v = merge3(bb[k], l[k], s[k]);
        if(v !== undefined) out[k] = v;
      }
      return out;
    }
    return clone(l);
  }
  function mergeById(b, l, s){
    const m = a => new Map(a.map(x => [String(x.id), x]));
    const bm = m(b), lm = m(l), sm = m(s), out = [], seen = new Set();
    for(const x of l){ const id = String(x.id); seen.add(id); const v = merge3(bm.get(id), x, sm.get(id)); if(v !== undefined) out.push(v); }
    for(const x of s){ const id = String(x.id); if(seen.has(id)) continue; const v = merge3(bm.get(id), undefined, x); if(v !== undefined) out.push(v); }
    return out;
  }

  function strip(section, data){
    const f = LOCAL_FIELDS[section];
    if(!f || !isObj(data)) return data;
    const c = { ...data }; f.forEach(k => delete c[k]); return c;
  }
  function withLocal(section, data){
    const f = LOCAL_FIELDS[section];
    if(!f || !isObj(data)) return data;
    let cur = {}; try{ cur = JSON.parse(rawGet.call(ls, KEY_OF[section])) || {}; }catch(e){}
    const c = { ...data }; f.forEach(k => { if(cur[k] !== undefined) c[k] = cur[k]; }); return c;
  }
  function readLocal(section){
    try{ const t = rawGet.call(ls, KEY_OF[section]); return t == null ? undefined : strip(section, JSON.parse(t)); }catch(e){ return undefined; }
  }
  function writeLocal(section, data){
    if(data === undefined || data === null) rawRemove.call(ls, KEY_OF[section]);
    else rawSet.call(ls, KEY_OF[section], JSON.stringify(withLocal(section, data)));
  }

  /* ---------- status chip ---------- */
  let chip, chipTimer;
  function ui(){
    if(chip) return;
    const css = document.createElement("style");
    css.textContent = `
      .pl-chip{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:90;font:500 11px/1 "DM Mono",ui-monospace,Menlo,monospace;
        letter-spacing:.04em;text-transform:uppercase;background:#0A0A0A;color:#F5F4F0;padding:8px 11px;border-radius:999px;box-shadow:0 2px 8px rgba(10,10,10,.18);
        display:flex;gap:10px;align-items:center;max-width:calc(100vw - 24px);pointer-events:none}
      .pl-chip.ok{opacity:.0;pointer-events:none;transition:opacity .6s .8s}
      .pl-chip.warn{background:#B3261E}
      .pl-chip button{pointer-events:auto;font:inherit;color:inherit;background:none;border:1px solid currentColor;border-radius:999px;padding:4px 8px;cursor:pointer;text-transform:inherit}
      .pl-offline-bar{position:sticky;top:0;z-index:80;background:#0A0A0A;color:#F5F4F0;text-align:center;font:600 12px "Montserrat",system-ui,sans-serif;padding:8px 12px;letter-spacing:.04em}
      html.pl-hosted #wsKeyBtn, html.pl-hosted #csKeyBtn{display:none!important}
      .pl-user{font:500 11px "DM Mono",ui-monospace,monospace;letter-spacing:.04em;text-transform:uppercase;color:#6E6E6E;display:flex;gap:8px;align-items:center}
      .pl-user button{font:inherit;background:none;border:1px solid #C9C9C9;border-radius:4px;padding:5px 8px;cursor:pointer;color:#3A3A38}
      body.pl-has-tabs .pl-chip{bottom:calc(72px + env(safe-area-inset-bottom))}
      body.pl-sheet-open .pl-chip{top:calc(10px + env(safe-area-inset-top));bottom:auto}`;
    document.head.appendChild(css);
    chip = document.createElement("div"); chip.className = "pl-chip ok"; chip.setAttribute("role","status");
    document.body.appendChild(chip);
  }
  function status(kind, text, action){
    ui(); clearTimeout(chipTimer);
    chip.className = "pl-chip " + (kind === "ok" ? "ok" : kind === "warn" ? "warn" : "");
    chip.innerHTML = "";
    const span = document.createElement("span"); span.textContent = text; chip.appendChild(span);
    if(action){ const b = document.createElement("button"); b.textContent = action.label; b.onclick = action.run; chip.appendChild(b); }
  }
  function toast(text){ status("warn", text); chipTimer = setTimeout(refreshChip, 4000); }
  function refreshChip(){
    if(offline) return status("warn", "Offline — read only");
    if(stale) return status("", "Updated on another device", { label:"Refresh", run:() => location.reload() });
    if(Object.keys(meta.dirty).length) return status("", "Saving…");
    status("ok", "Saved");
  }
  function setOffline(on){
    offline = on;
    let bar = document.querySelector(".pl-offline-bar");
    if(on && !bar && document.body){
      bar = document.createElement("div"); bar.className = "pl-offline-bar";
      const when = meta.syncedAt ? new Date(meta.syncedAt).toLocaleString("en-GB",{weekday:"short",hour:"2-digit",minute:"2-digit"}) : "never";
      bar.textContent = "No connection — read only · last synced " + when;
      document.body.prepend(bar);
    }
    if(!on && bar) bar.remove();
    refreshChip();
  }

  /* ---------- network ---------- */
  const realFetch = window.fetch.bind(window);
  function sameOriginApi(u){
    try{ const url = new URL(u, location.href); return url.origin === location.origin && url.pathname.startsWith("/api/") ? url : null; }catch(e){ return null; }
  }
  window.fetch = function(input, init){
    const u = typeof input === "string" ? input : input && input.url;
    const url = u && sameOriginApi(u);
    if(!url) return realFetch(input, init);
    url.searchParams.delete("key");
    const opts = { ...(init || {}) };
    const h = new Headers(opts.headers || (typeof input !== "string" && input.headers) || {});
    h.set("X-PL", "1");
    opts.headers = h; opts.credentials = "same-origin";
    if(typeof input !== "string" && !init){ opts.method = input.method; }
    return realFetch(url.toString(), opts).then(r => {
      if(r.status === 401) location.replace("/login");
      return r;
    });
  };

  async function api(body){
    const r = await realFetch("/api/admin", { method:"POST", credentials:"same-origin",
      headers:{ "Content-Type":"application/json", "X-PL":"1" }, body: JSON.stringify(body) });
    if(r.status === 401){ location.replace("/login"); throw new Error("signed out"); }
    const d = await r.json().catch(() => ({}));
    return { status: r.status, ok: r.ok, d };
  }

  /* ---------- pull ---------- */
  async function fetchState(){
    const r = await realFetch("/api/admin?action=state", { credentials:"same-origin", cache:"no-store" });
    if(r.status === 401){ location.replace("/login"); throw new Error("signed out"); }
    if(!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  function applyServer(sections, initial){
    let changed = false;
    for(const s of Object.values(MAP)){
      const srv = sections[s] || null;
      const prev = meta.server[s];
      if(!initial && prev && srv && prev.v === srv.version) continue;
      if(!initial && !prev && !srv) continue;
      meta.server[s] = srv ? { v: srv.version, data: srv.data } : null;
      if(meta.dirty[s]) continue;                         // pending local write: push() merges
      const local = readLocal(s), next = srv ? srv.data : undefined;
      if(!eq(local, next)){ writeLocal(s, next); if(!initial) changed = true; }
      if(initial) meta.known[s] = clone(next);
    }
    meta.syncedAt = new Date().toISOString();
    saveMeta();
    return changed;
  }

  /* ---------- change history (hidden log, sent with each save) ---------- */
  const SUMMARY_FIELDS = { notes:true };
  function summarise(f, v){
    if(v === undefined || v === null || v === "") return null;
    if(SUMMARY_FIELDS[f]) return "(" + String(v).length + " chars)";
    if(typeof v === "object") return Array.isArray(v) ? "[" + v.length + " items]" : "{…}";
    const t = String(v); return t.length > 120 ? t.slice(0,119) + "…" : t;
  }
  function recordLabel(r){ return r ? String(r.club || r.ref || r.name || r.id || "") : ""; }
  function diffRecord(a, b){
    const out = [];
    for(const f of new Set([...Object.keys(a||{}), ...Object.keys(b||{})])){
      if(f === "updated") continue;
      if(!eq(a ? a[f] : undefined, b ? b[f] : undefined)) out.push({ f, from: summarise(f, a && a[f]), to: summarise(f, b && b[f]) });
    }
    return out;
  }
  function historyFor(section, before, after){
    const t = new Date().toISOString(), out = [];
    if(Array.isArray(before) || Array.isArray(after)){
      const m = arr => new Map((Array.isArray(arr) ? arr : []).filter(x => x && x.id != null).map(x => [String(x.id), x]));
      const bm = m(before), am = m(after);
      for(const [id, x] of am){
        const y = bm.get(id);
        if(!y) out.push({ t, section, id, label: recordLabel(x), changes:[{ f:"*", from:null, to:"created" }] });
        else { const c = diffRecord(y, x); if(c.length) out.push({ t, section, id, label: recordLabel(x), changes: c }); }
      }
      for(const [id, y] of bm) if(!am.has(id)) out.push({ t, section, id, label: recordLabel(y), changes:[{ f:"*", from:"exists", to:"deleted" }] });
    }else if(isObj(before) || isObj(after)){
      const b = isObj(before) ? before : {}, a = isObj(after) ? after : {};
      for(const k of new Set([...Object.keys(b), ...Object.keys(a)])){
        if(!eq(b[k], a[k])) out.push({ t, section, id: k, label: k, changes:[{ f: k, from: summarise(k, b[k]), to: summarise(k, a[k]) }] });
      }
    }
    return out.slice(0, 150);
  }

  /* ---------- push (all dirty sections in ONE request) ---------- */
  const PUSH_DELAY = 3000;
  let pushTimer = null, inflight = false, again = false, pushedSinceSnapshot = false;
  function onWrite(section){
    meta.dirty[section] = true; saveMeta(); refreshChip();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push(), PUSH_DELAY);
  }
  async function push(opts){
    opts = opts || {};
    const sections = Object.keys(meta.dirty);
    if(!sections.length){ if(opts.snapshot && pushedSinceSnapshot) return snapshotNow(opts); return true; }
    if(inflight){ again = true; return false; }
    inflight = true; clearTimeout(pushTimer);
    try{
      const work = sections.map(s => {
        const local = readLocal(s), base = meta.known[s], srv = meta.server[s] || null;
        return { s, local, appView: clone(local), base, data: srv ? merge3(base, local, srv.data) : local, ver: srv ? srv.v : 0 };
      });
      const history = [].concat(...work.map(w => historyFor(w.s, w.base, w.local)));
      for(let attempt = 0; attempt < 5; attempt++){
        const body = { action:"state-save", history, snapshot: !!opts.snapshot,
          changes: work.map(w => ({ section: w.s, baseVersion: w.ver, data: w.data === undefined ? null : w.data })) };
        const res = await realFetch("/api/admin", { method:"POST", credentials:"same-origin", keepalive: !!opts.keepalive,
          headers:{ "Content-Type":"application/json", "X-PL":"1" }, body: JSON.stringify(body) });
        if(res.status === 401){ location.replace("/login"); throw new Error("signed out"); }
        const d = await res.json().catch(() => ({}));
        if(res.ok && d.ok){
          for(const w of work){
            meta.server[w.s] = { v: d.versions[w.s], data: clone(w.data) };
            meta.known[w.s] = w.appView;                      // what the running app holds
            /* An edit made while this request was in flight stays dirty and is
               merged on the next push (known = appView, server = what we sent). */
            if(eq(readLocal(w.s), w.appView)){
              if(!eq(w.data, w.appView)){ writeLocal(w.s, w.data); stale = true; }
              delete meta.dirty[w.s];
            }
          }
          meta.syncedAt = new Date().toISOString(); saveMeta();
          pushedSinceSnapshot = !(d.snapshot && (d.snapshot.ok || d.snapshot.skipped));
          return true;
        }
        if(res.status === 409 && d.conflict){
          for(const w of work){
            const cur = d.current ? d.current[w.s] : undefined;
            if(cur === undefined) continue;
            meta.server[w.s] = cur ? { v: cur.version, data: cur.data } : null;
            w.data = merge3(w.base, w.local, cur ? cur.data : undefined);
            w.ver = cur ? cur.version : 0;
          }
          continue;
        }
        throw new Error(d.error || ("HTTP " + res.status));
      }
      throw new Error("could not reconcile — retrying");
    }catch(e){
      console.warn("sync push failed", e);
      if(String(e.message) === "signed out") return false;
      if(!navigator.onLine) setOffline(true);
      else status("warn", "Not saved yet — retrying", { label:"Retry", run:() => push() });
      clearTimeout(pushTimer); pushTimer = setTimeout(() => push(), 15000);
      return false;
    }finally{
      inflight = false;
      if(again){ again = false; push(); } else refreshChip();
    }
  }
  async function snapshotNow(opts){
    try{
      const r = await realFetch("/api/admin", { method:"POST", credentials:"same-origin", keepalive: !!(opts && opts.keepalive),
        headers:{ "Content-Type":"application/json", "X-PL":"1" }, body: JSON.stringify({ action:"snapshot" }) });
      if(r.ok) pushedSinceSnapshot = false;
    }catch(e){}
    return true;
  }
  /* Leaving the page / app: save now and take a session snapshot (online only). */
  function onLeave(){
    if(offline || !navigator.onLine) return;
    if(Object.keys(meta.dirty).length || pushedSinceSnapshot) push({ keepalive:true, snapshot:true });
  }
  window.addEventListener("pagehide", onLeave);
  document.addEventListener("visibilitychange", () => { if(document.hidden) onLeave(); });

  /* ---------- intercept the app's writes ---------- */
  Storage.prototype.setItem = function(k, v){
    if(this === ls && MAP[k]){
      if(offline){ discarded = true; toast("Offline — read only, change not saved"); return; }
      rawSet.call(this, k, v);
      onWrite(MAP[k]);
      return;
    }
    return rawSet.call(this, k, v);
  };
  Storage.prototype.removeItem = function(k){
    if(this === ls && MAP[k]){
      if(offline){ discarded = true; toast("Offline — read only, change not saved"); return; }
      rawRemove.call(this, k); onWrite(MAP[k]); return;
    }
    return rawRemove.call(this, k);
  };

  /* ---------- Mac-only file links ---------- */
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest('a[href^="file:"]');
    if(!a) return;
    e.preventDefault();
    const path = decodeURI(a.getAttribute("href").replace(/^file:\/\//, ""));
    (navigator.clipboard ? navigator.clipboard.writeText(path).catch(()=>{}) : Promise.resolve());
    toast("Mac-only file — path copied");
  }, true);

  /* ---------- account + sign-out (wipes this device's copy) ---------- */
  async function wipeDevice(){
    const keys = [];
    for(let i = 0; i < ls.length; i++){ const k = ls.key(i); if(/^(proton_|pl_)/.test(k)) keys.push(k); }
    keys.forEach(k => rawRemove.call(ls, k));
    try{ sessionStorage.clear(); }catch(e){}
    try{ await new Promise(res => { const r = indexedDB.deleteDatabase("proton_analytics_db"); r.onsuccess = r.onerror = r.onblocked = () => res(); }); }catch(e){}
    try{ if(navigator.serviceWorker) for(const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); }catch(e){}
    try{ if(window.caches) for(const k of await caches.keys()) if(/^pl-/.test(k)) await caches.delete(k); }catch(e){}
  }
  async function signOut(){
    if(Object.keys(meta.dirty).length){
      status("", "Saving before sign-out…");
      const ok = await push();
      if(!ok && Object.keys(meta.dirty).length && !confirm("Some changes haven't reached the server (no connection).\n\nSign out anyway and discard them on this device?")) { refreshChip(); return; }
    }
    await api({ action:"logout" }).catch(()=>{});
    await wipeDevice();
    location.replace("/login");
  }
  function addAccount(){
    const spacer = document.querySelector(".topbar .spacer, header .spacer");
    if(!spacer || document.querySelector(".pl-user")) return;
    const w = document.createElement("span"); w.className = "pl-user";
    w.innerHTML = `<span></span><button type="button">Sign out</button>`;
    w.firstChild.textContent = user ? user.u : "";
    w.lastChild.onclick = signOut;
    spacer.after(w);
  }

  /* ---------- refresh from server: on return to the tab, at most every 5 min ---------- */
  const PULL_GAP = 5 * 60 * 1000;
  let lastPull = 0;
  const modalOpen = () => !!document.querySelector(".overlay:not(.hidden), .pl-sheet.open");
  async function pull(force){
    if(document.hidden) return;
    if(!force && Date.now() - lastPull < PULL_GAP) return;
    lastPull = Date.now();
    try{
      const st = await fetchState();
      if(offline){ setOffline(false); if(discarded){ location.reload(); return; } }
      if(applyServer(st.sections, false)) stale = true;
      if(stale && !modalOpen() && !Object.keys(meta.dirty).length && !document.activeElement?.matches?.("input,textarea,select")) { location.reload(); return; }
      refreshChip();
    }catch(e){ if(!navigator.onLine) setOffline(true); }
  }
  document.addEventListener("visibilitychange", () => { if(!document.hidden) pull(); });
  window.addEventListener("focus", () => pull());
  window.addEventListener("online", () => pull(true));
  window.addEventListener("offline", () => setOffline(true));

  /* ---------- boot ---------- */
  rawSet.call(ls, "proton_admin_key", "session");          // app's "key set?" checks; the cookie is the real auth
  (async () => {
    let st = null;
    try{ st = await fetchState(); lastPull = Date.now(); }
    catch(e){ if(String(e.message) === "signed out") return; }
    if(st){
      user = st.user || null;
      applyServer(st.sections, true);
    }else if(!meta.syncedAt){
      document.body.innerHTML = '<p style="font:600 15px Montserrat,system-ui,sans-serif;padding:40px 24px;text-align:center">No connection, and this device has no saved copy yet.<br><br><button onclick="location.reload()" style="font:inherit;padding:10px 16px">Try again</button></p>';
      return;
    }
    startApp();
    addAccount();
    if(!st) setOffline(true);
    else{
      if(Object.keys(meta.dirty).length) push();              // writes left over from an earlier session
      refreshChip();
    }
    if("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(e => console.warn("sw", e));
  })();

  window.PL_SYNC = { merge3, push, pull: () => pull(true), signOut, meta: () => meta, user: () => user, api,
    isOffline: () => offline };
})();
