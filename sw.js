// Service worker: la app abre sin internet. Las llamadas a Supabase nunca se cachean.
const CACHE = "glucemia-v1";
const APP = ["./", "index.html", "css/app.css", "manifest.json", "icons/icon-192.png", "icons/icon-512.png",
  "js/app.js", "js/config.js", "js/db.js", "js/estado.js", "js/graficos.js", "js/ics.js", "js/importar.js", "js/informes.js",
  "js/modelo.js", "js/periodo.js", "js/stats.js", "js/sync.js", "js/ui-historial.js", "js/ui-informes.js", "js/ui-mas.js",
  "js/ui-registro.js", "js/ui-stats.js", "js/util.js"];
const CDN = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([...APP, ...CDN])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.hostname.endsWith("supabase.co") || url.hostname.includes("calendar.google")) return;
  // Archivos propios: red primero (para recibir actualizaciones), caché si no hay conexión
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then(r => {
      const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
    return;
  }
  // Librerías con versión fija: caché primero
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
    const copia = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return resp;
  })));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(cs => cs[0] ? cs[0].focus() : self.clients.openWindow("./#registro")));
});
