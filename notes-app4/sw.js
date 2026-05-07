// ============================================================
//  sw.js — Service Worker (Практики 13, 15, 16, 17)
// ============================================================

const CACHE_NAME         = 'notes-shell-v4';     // Практика 13/14/15: статика
const DYNAMIC_CACHE_NAME = 'notes-dynamic-v1';   // Практика 15: динамический контент

// Всё, что кэшируем при установке (App Shell — Практика 15)
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './content/home.html',
  './content/about.html',
  // иконки (Практика 14)
  './icons/favicon.ico',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// -------- УСТАНОВКА: кэшируем статику (Практика 13) --------
self.addEventListener('install', event => {
  console.log('[SW] Установка...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())   // сразу активируемся без ожидания
  );
});

// -------- АКТИВАЦИЯ: удаляем старые кэши (Практика 13) --------
self.addEventListener('activate', event => {
  console.log('[SW] Активация...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== DYNAMIC_CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())  // берём управление всеми вкладками
  );
});

// -------- FETCH: стратегии кэширования (Практика 15) --------
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Не трогаем запросы к чужим доменам (Socket.IO, chota CDN и т.д.)
  if (url.origin !== location.origin) return;

  // Не трогаем POST-запросы (подписка, отписка, snooze)
  if (event.request.method !== 'GET') return;

  // /content/* — Network First (свежий HTML, но с фолбеком на кэш)
  if (url.pathname.includes('/content/')) {
    event.respondWith(
      fetch(event.request)
        .then(networkRes => {
          const clone = networkRes.clone();
          caches.open(DYNAMIC_CACHE_NAME).then(cache => cache.put(event.request, clone));
          return networkRes;
        })
        .catch(() =>
          caches.match(event.request)
            .then(cached => cached || caches.match('./content/home.html'))
        )
    );
    return;
  }

  // Всё остальное — Cache First (статика App Shell)
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request)
        .then(networkRes => {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return networkRes;
        })
      )
  );
});

// -------- PUSH: показываем уведомление (Практика 16/17) --------
self.addEventListener('push', event => {
  let data = { title: 'Новое уведомление', body: '', reminderId: null };
  if (event.data) {
    try { data = event.data.json(); } catch(e) { data.body = event.data.text(); }
  }

  const options = {
    body: data.body,
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data:  { reminderId: data.reminderId },  // нужно для кнопки «Отложить»
    vibrate: [200, 100, 200],
  };

  // Кнопка «Отложить на 5 минут» — только если это напоминание (Практика 17)
  if (data.reminderId) {
    options.actions = [
      { action: 'snooze', title: '⏰ Отложить на 5 минут' }
    ];
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// -------- NOTIFICATIONCLICK: обработка кнопки «Отложить» (Практика 17) --------
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  const action       = event.action;

  if (action === 'snooze') {
    const reminderId = notification.data.reminderId;
    event.waitUntil(
      fetch(`/snooze?reminderId=${reminderId}`, { method: 'POST' })
        .then(() => {
          console.log('[SW] Напоминание отложено');
          notification.close();
        })
        .catch(err => console.error('[SW] Snooze error:', err))
    );
  } else {
    // Обычный клик — открываем приложение
    notification.close();
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
