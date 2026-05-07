// ============================================================
//  server.js — Node.js сервер (Практики 16, 17)
//  Запуск: node server.js
// ============================================================

const express    = require('express');
const http       = require('http');
const socketIo   = require('socket.io');
const webpush    = require('web-push');
const bodyParser = require('body-parser');
const cors       = require('cors');
const path       = require('path');

// -------- VAPID-ключи (Практика 16) --------
// Эти ключи были сгенерированы командой: npx web-push generate-vapid-keys
const vapidKeys = {
  publicKey:  'BOI9VU3lOyRt6sPquGG-6DPGxIQfIfjyJC4DwPGVnv7pQT166r-qQ821pFO5O_fXIlcLiP1HoBMKz3Zp-TNBM9M',
  privateKey: '8DVMIb5v8WJ0y4EX31y0jGEF8kkxqZkj8L7XNqOY9n4'
};

webpush.setVapidDetails(
  'mailto:student@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// -------- Настройка Express --------
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Раздаём статические файлы из текущей папки (index.html, app.js, sw.js и т.д.)
app.use(express.static(path.join(__dirname)));

// -------- HTTP + Socket.IO (Практика 16) --------
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// -------- Хранилища --------
let subscriptions = [];           // push-подписки клиентов
const reminders   = new Map();    // активные напоминания (Практика 17)

// -------- WebSocket-события --------
io.on('connection', (socket) => {
  console.log(`✅ Клиент подключён: ${socket.id}`);

  // Практика 16: обычная новая задача — рассылаем всем + push
  socket.on('newTask', (task) => {
    console.log('📝 Новая задача:', task.text);

    // Рассылаем событие всем подключённым клиентам
    io.emit('taskAdded', task);

    // Отправляем push всем подписанным
    const payload = JSON.stringify({ title: 'Новая задача', body: task.text });
    subscriptions.forEach(sub => {
      webpush.sendNotification(sub, payload)
        .catch(err => {
          console.error('Push error:', err.statusCode);
          // Удаляем невалидные подписки
          if (err.statusCode === 410) {
            subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
          }
        });
    });
  });

  // Практика 17: заметка с напоминанием — планируем push через setTimeout
  socket.on('newReminder', (reminder) => {
    const { id, text, reminderTime } = reminder;
    const delay = reminderTime - Date.now();

    if (delay <= 0) {
      console.warn('⚠️ Время напоминания уже прошло, пропускаем');
      return;
    }

    console.log(`⏰ Напоминание запланировано: "${text}" через ${Math.round(delay/1000)}с`);

    const timeoutId = setTimeout(() => {
      const payload = JSON.stringify({
        title: '⏰ Напоминание!',
        body: text,
        reminderId: id
      });
      subscriptions.forEach(sub => {
        webpush.sendNotification(sub, payload)
          .catch(err => console.error('Push error:', err.statusCode));
      });
      reminders.delete(id);
      console.log(`🔔 Push отправлен: "${text}"`);
    }, delay);

    reminders.set(id, { timeoutId, text, reminderTime });
  });

  socket.on('disconnect', () => {
    console.log(`❌ Клиент отключён: ${socket.id}`);
  });
});

// -------- REST-эндпоинты --------

// Сохранить push-подписку
app.post('/subscribe', (req, res) => {
  const sub = req.body;
  const exists = subscriptions.some(s => s.endpoint === sub.endpoint);
  if (!exists) {
    subscriptions.push(sub);
    console.log(`🔔 Новая подписка (всего: ${subscriptions.length})`);
  }
  res.status(201).json({ message: 'Подписка сохранена' });
});

// Удалить push-подписку
app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
  console.log(`🔕 Подписка удалена (осталось: ${subscriptions.length})`);
  res.status(200).json({ message: 'Подписка удалена' });
});

// Практика 17: Отложить напоминание на 5 минут
app.post('/snooze', (req, res) => {
  const reminderId = parseInt(req.query.reminderId, 10);

  if (!reminderId || !reminders.has(reminderId)) {
    return res.status(404).json({ error: 'Напоминание не найдено' });
  }

  const reminder = reminders.get(reminderId);
  clearTimeout(reminder.timeoutId);

  const newDelay = 5 * 60 * 1000; // 5 минут

  const newTimeoutId = setTimeout(() => {
    const payload = JSON.stringify({
      title: '⏰ Отложенное напоминание',
      body: reminder.text,
      reminderId: reminderId
    });
    subscriptions.forEach(sub => {
      webpush.sendNotification(sub, payload)
        .catch(err => console.error('Push error:', err.statusCode));
    });
    reminders.delete(reminderId);
    console.log(`🔔 Отложенный push отправлен: "${reminder.text}"`);
  }, newDelay);

  reminders.set(reminderId, {
    timeoutId: newTimeoutId,
    text: reminder.text,
    reminderTime: Date.now() + newDelay
  });

  console.log(`⏰ Напоминание отложено на 5 минут: "${reminder.text}"`);
  res.status(200).json({ message: 'Отложено на 5 минут' });
});

// -------- Запуск --------
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 Сервер запущен: http://localhost:${PORT}`);
  console.log(`📝 Откройте браузер по адресу: http://localhost:${PORT}\n`);
});
