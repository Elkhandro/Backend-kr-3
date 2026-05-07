// ============================================================
//  app.js — клиентская логика (Практики 13–17)
// ============================================================

// ---------- Практика 16: подключение к Socket.IO серверу ----------
// Если сервер не запущен — socket просто не подключится, всё остальное работает
const socket = io('http://localhost:3001', { transports: ['websocket', 'polling'] });

socket.on('connect', () => console.log('✅ WebSocket подключён'));
socket.on('connect_error', () => console.warn('⚠️ WebSocket недоступен (сервер не запущен?)'));

// ---------- Практика 16: получаем чужие задачи через WebSocket ----------
socket.on('taskAdded', (task) => {
  showToast(`Новая задача от другого клиента: ${task.text}`);
});

// ---------- Навигация App Shell (Практика 15) ----------
const contentDiv = document.getElementById('app-content');
const homeBtn    = document.getElementById('home-btn');
const aboutBtn   = document.getElementById('about-btn');

function setActiveButton(id) {
  [homeBtn, aboutBtn].forEach(btn => btn.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Загружаем HTML-фрагмент через fetch (Network First — Практика 15)
async function loadContent(page) {
  try {
    // Используем относительный путь — работает при любом расположении сервера
    const response = await fetch(`content/${page}.html`);
    if (!response.ok) throw new Error('Ответ сервера: ' + response.status);
    contentDiv.innerHTML = await response.text();
    if (page === 'home') initNotes();
  } catch (err) {
    contentDiv.innerHTML = `<p class="text-error">⚠️ Ошибка загрузки страницы (офлайн?)</p>`;
    console.error(err);
  }
}

homeBtn.addEventListener('click', () => { setActiveButton('home-btn');  loadContent('home'); });
aboutBtn.addEventListener('click', () => { setActiveButton('about-btn'); loadContent('about'); });

// При старте грузим главную
loadContent('home');

// ============================================================
//  ЛОГИКА ЗАМЕТОК (Практики 13, 17)
// ============================================================
function initNotes() {
  const form         = document.getElementById('note-form');
  const input        = document.getElementById('note-input');
  const reminderForm = document.getElementById('reminder-form');
  const reminderText = document.getElementById('reminder-text');
  const reminderTime = document.getElementById('reminder-time');
  const list         = document.getElementById('notes-list');

  // --- Отображение списка ---
  function loadNotes() {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    if (notes.length === 0) {
      list.innerHTML = '<li style="color:#999">Заметок пока нет. Добавьте первую!</li>';
      return;
    }
    list.innerHTML = notes.map(note => {
      let reminderInfo = '';
      if (note.reminder) {
        const d = new Date(note.reminder);
        reminderInfo = `<br><small style="color:#4285f4">⏰ Напоминание: ${d.toLocaleString()}</small>`;
      }
      return `
        <li class="card" style="margin-bottom:0.5rem; padding:0.75rem; display:flex; justify-content:space-between; align-items:flex-start;">
          <span>${note.text}${reminderInfo}</span>
          <button class="button error" style="padding:0.2rem 0.6rem; font-size:0.8rem;" onclick="deleteNote(${note.id})">✕</button>
        </li>`;
    }).join('');
  }

  // --- Сохранение заметки ---
  // reminderTimestamp — число (timestamp) или null
  function addNote(text, reminderTimestamp = null) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const newNote = { id: Date.now(), text, reminder: reminderTimestamp };
    notes.push(newNote);
    localStorage.setItem('notes', JSON.stringify(notes));
    loadNotes();

    // Практика 16/17: отправляем событие на сервер
    if (reminderTimestamp) {
      // Напоминание — сервер запланирует push (Практика 17)
      socket.emit('newReminder', { id: newNote.id, text, reminderTime: reminderTimestamp });
    } else {
      // Обычная задача — WebSocket-рассылка + push (Практика 16)
      socket.emit('newTask', { text, timestamp: Date.now() });
    }
  }

  // Обработчик обычной формы
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) { addNote(text); input.value = ''; }
  });

  // Обработчик формы с напоминанием (Практика 17)
  reminderForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = reminderText.value.trim();
    const datetime = reminderTime.value;
    if (!text || !datetime) return;
    const timestamp = new Date(datetime).getTime();
    if (timestamp <= Date.now()) {
      alert('⚠️ Дата напоминания должна быть в будущем!');
      return;
    }
    addNote(text, timestamp);
    reminderText.value = '';
    reminderTime.value = '';
  });

  loadNotes();
}

// Глобальная функция удаления (вызывается из onclick в HTML)
window.deleteNote = function(id) {
  const notes = JSON.parse(localStorage.getItem('notes') || '[]');
  localStorage.setItem('notes', JSON.stringify(notes.filter(n => n.id !== id)));
  // Перезагружаем список (initNotes уже вызван, просто обновляем DOM)
  const list = document.getElementById('notes-list');
  if (list) {
    const updatedNotes = JSON.parse(localStorage.getItem('notes') || '[]');
    if (updatedNotes.length === 0) {
      list.innerHTML = '<li style="color:#999">Заметок пока нет. Добавьте первую!</li>';
    } else {
      // Перерисовываем — просто повторяем логику
      list.innerHTML = updatedNotes.map(note => {
        let reminderInfo = '';
        if (note.reminder) {
          const d = new Date(note.reminder);
          reminderInfo = `<br><small style="color:#4285f4">⏰ Напоминание: ${d.toLocaleString()}</small>`;
        }
        return `
          <li class="card" style="margin-bottom:0.5rem; padding:0.75rem; display:flex; justify-content:space-between; align-items:flex-start;">
            <span>${note.text}${reminderInfo}</span>
            <button class="button error" style="padding:0.2rem 0.6rem; font-size:0.8rem;" onclick="deleteNote(${note.id})">✕</button>
          </li>`;
      }).join('');
    }
  }
};

// ============================================================
//  TOAST (всплывающее сообщение)
// ============================================================
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

// ============================================================
//  ПРАКТИКА 16: Push-уведомления
// ============================================================

// Переводим публичный VAPID-ключ из base64 в Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

// ВАЖНО: вставьте сюда ваш публичный VAPID-ключ из генерации!
const PUBLIC_VAPID_KEY = 'BOI9VU3lOyRt6sPquGG-6DPGxIQfIfjyJC4DwPGVnv7pQT166r-qQ821pFO5O_fXIlcLiP1HoBMKz3Zp-TNBM9M';

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('Push-уведомления не поддерживаются в этом браузере');
    return;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
    });
    await fetch('http://localhost:3001/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });
    console.log('✅ Подписка на push оформлена');
  } catch (err) {
    console.error('❌ Ошибка подписки на push:', err);
    alert('Не удалось подписаться на уведомления. Убедитесь, что сервер запущен.');
  }
}

async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const registration  = await navigator.serviceWorker.ready;
  const subscription  = await registration.pushManager.getSubscription();
  if (subscription) {
    await fetch('http://localhost:3001/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint })
    });
    await subscription.unsubscribe();
    console.log('✅ Отписка выполнена');
  }
}

// ============================================================
//  РЕГИСТРАЦИЯ SERVICE WORKER (Практика 13) + кнопки push (Практика 16)
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker зарегистрирован, scope:', reg.scope);

      const enableBtn  = document.getElementById('enable-push');
      const disableBtn = document.getElementById('disable-push');

      if (enableBtn && disableBtn) {
        // Проверяем, есть ли уже подписка
        const existingSub = await reg.pushManager.getSubscription();
        if (existingSub) {
          enableBtn.style.display  = 'none';
          disableBtn.style.display = 'inline-block';
        }

        enableBtn.addEventListener('click', async () => {
          if (Notification.permission === 'denied') {
            alert('Уведомления запрещены в настройках браузера. Разрешите их вручную.');
            return;
          }
          if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
              alert('Необходимо разрешить уведомления.');
              return;
            }
          }
          await subscribeToPush();
          enableBtn.style.display  = 'none';
          disableBtn.style.display = 'inline-block';
        });

        disableBtn.addEventListener('click', async () => {
          await unsubscribeFromPush();
          disableBtn.style.display = 'none';
          enableBtn.style.display  = 'inline-block';
        });
      }
    } catch (err) {
      console.error('❌ Ошибка регистрации Service Worker:', err);
    }
  });
}
