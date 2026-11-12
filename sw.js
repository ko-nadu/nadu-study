// 오프라인 캐시 — 데이터·앱 코드는 네트워크 우선(새 정리가 바로 보이게), 나머지는 캐시 우선.
// ★같은 주소(출처)에 다른 앱이 함께 있으므로 이 앱 이름(nadu-study-)으로 시작하는 캐시만 만들고 지운다.
const CACHE = "nadu-study-fc4f6b21e6";
const SHELL = ["./", "index.html", "app.css", "app.js", "manifest.json", "icon-180.png", "icon-192.png", "icon-512.png", "data.enc.json"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("nadu-study-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (u.pathname.endsWith(".enc.json") || u.pathname.endsWith("app.js") || u.pathname.endsWith("app.css")) {
    const key = new URL(u.pathname, location.origin).href;  // ?t= 꼬리표를 떼고 한 칸에만 저장
    e.respondWith(fetch(e.request, {cache: "no-store"}).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(key, cp)); }
      return r;
    }).catch(() => caches.match(key)));
    return;
  }
  if (e.request.mode === "navigate" || u.pathname.endsWith("/") || u.pathname.endsWith("index.html")) {
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put("index.html", cp)); return r; })
      .catch(() => caches.match("index.html", {ignoreSearch: true}).then(r => r || caches.match("./"))));
    return;
  }
  e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(r => r || fetch(e.request)));
});
