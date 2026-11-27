/* dashboard/sw.js — served at /sw.js (api/admin.js ?view=sw).
   Offline READING for the hosted dashboard: the app shell (/dashboard, the
   sync layer, fonts, icon) is cached network-first, so an online load always
   gets the latest deploy and an offline load gets the last good copy. The
   business data itself is cached by the sync layer in localStorage; API
   calls are never cached here. A redirect to /login (signed out) is never
   stored over a good copy. */
const CACHE = "pl-shell-v4";
const SHELL = ["/dashboard", "/sync-layer.js", "/today.js", "/evri-match.js", "/manifest.json", "/icon.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isFont = (url) => url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.startsWith("/api/")) return;   // data: never cached here
  /* Only the dashboard shell — never /login or anything else, so a signed-out
     device holds nothing of the dashboard's. */
  const shell = url.origin === location.origin && SHELL.includes(url.pathname);
  if (!shell && !isFont(url)) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = url.pathname === "/dashboard" ? "/dashboard" : req;
    try {
      const res = await fetch(req);
      // Only store real pages — never the 302 → /login or an error.
      if (res.ok && !res.redirected && res.type !== "opaqueredirect") cache.put(key, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(key);
      if (hit) return hit;
      throw err;
    }
  })());
});

/* ---------- notifications (lib/push.js sends {title, body, url, tag}) ---------- */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Proton", {
    body: d.body || "", tag: d.tag || undefined, renotify: !!d.tag,
    icon: "/icon.png", badge: "/icon.png", data: { url: d.url || "/dashboard" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/dashboard";
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) {
      if (new URL(c.url).pathname === "/dashboard") { await c.focus(); try { await c.navigate(url); } catch (err) {} return; }
    }
    await self.clients.openWindow(url);
  })());
});
