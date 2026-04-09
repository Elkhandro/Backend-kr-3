const CACHE_NAME = "notes-app-v1";
const OFFLINE_URL = "/index.html";

// Ресурсы для кэширования
const ASSETS = [
  "/",
  "/index.html",
  "/app.js",
  "https://unpkg.com/chota@latest",
];

// Установка - кэшируем ресурсы
self.addEventListener("install", (event) => {
  console.log("[SW] Установка Service Worker");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        console.log("[SW] Кэширование ресурсов...");
        // Кэшируем каждый ресурс отдельно, чтобы избежать ошибки при одном неудачном
        for (const asset of ASSETS) {
          try {
            await cache.add(asset);
            console.log(`[SW] Закэшировано: ${asset}`);
          } catch (err) {
            console.warn(`[SW] Не удалось закэшировать: ${asset}`, err);
          }
        }
        return cache;
      })
      .then(() => {
        console.log("[SW] Кэширование завершено");
        return self.skipWaiting();
      }),
  );
});

// Активация - очищаем старые кэши
self.addEventListener("activate", (event) => {
  console.log("[SW] Активация Service Worker");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log(`[SW] Удаляем старый кэш: ${cacheName}`);
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => {
        console.log("[SW] Готов к работе");
        return self.clients.claim();
      }),
  );
});

// Перехват fetch-запросов - стратегия "сначала кэш, потом сеть"
self.addEventListener("fetch", (event) => {
  // Пропускаем запросы не GET и запросы к chrome-extension
  if (
    event.request.method !== "GET" ||
    event.request.url.startsWith("chrome-extension")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Если нашли в кэше - возвращаем
      if (cachedResponse) {
        console.log(`[SW] Из кэша: ${event.request.url}`);
        return cachedResponse;
      }

      // Если нет в кэше - идём в сеть
      console.log(`[SW] Из сети: ${event.request.url}`);
      return fetch(event.request)
        .then((networkResponse) => {
          // Кэшируем успешные ответы для будущих запросов
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Если нет сети и нет в кэше - возвращаем fallback
          if (event.request.mode === "navigate") {
            return caches.match(OFFLINE_URL);
          }
          return new Response("Страница недоступна офлайн", {
            status: 503,
            statusText: "Service Unavailable",
          });
        });
    }),
  );
});

// Обработка push-уведомлений (опционально)
self.addEventListener("push", (event) => {
  const options = {
    body: event.data ? event.data.text() : "Новое уведомление",
    icon: "/favicon.ico",
    badge: "/badge.png",
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification("📝 Офлайн Заметки", options),
  );
});
