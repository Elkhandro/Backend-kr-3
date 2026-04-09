// ========== Работа с заметками ==========
const form = document.getElementById("note-form");
const input = document.getElementById("note-input");
const list = document.getElementById("notes-list");
const clearBtn = document.getElementById("clear-btn");
const statusDiv = document.getElementById("status");

// Загрузка заметок из localStorage
function loadNotes() {
  const notes = JSON.parse(localStorage.getItem("notes") || "[]");

  if (notes.length === 0) {
    list.innerHTML =
      '<li style="color: #999; text-align: center; padding: 20px;">✨ Нет заметок. Добавьте первую!</li>';
    return;
  }

  list.innerHTML = notes
    .map(
      (note, index) => `
        <li style="background: #f5f5f5; margin: 10px 0; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span style="flex: 1;">${escapeHtml(note)}</span>
            <button class="delete-btn" data-index="${index}" style="background: #ff9800; color: white; border: none; padding: 5px 12px; border-radius: 5px; cursor: pointer;">✖️ Удалить</button>
        </li>
    `,
    )
    .join("");

  // Добавляем обработчики для кнопок удаления
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(btn.dataset.index);
      deleteNote(index);
    });
  });
}

// Экранирование HTML для безопасности
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Добавление заметки
function addNote(text) {
  const notes = JSON.parse(localStorage.getItem("notes") || "[]");
  notes.push(text);
  localStorage.setItem("notes", JSON.stringify(notes));
  loadNotes();
  showStatus("✅ Заметка добавлена!", "#e8f5e9");
}

// Удаление заметки
function deleteNote(index) {
  const notes = JSON.parse(localStorage.getItem("notes") || "[]");
  notes.splice(index, 1);
  localStorage.setItem("notes", JSON.stringify(notes));
  loadNotes();
  showStatus("🗑️ Заметка удалена", "#fff3e0");
}

// Очистка всех заметок
function clearAllNotes() {
  if (confirm("Удалить все заметки?")) {
    localStorage.setItem("notes", JSON.stringify([]));
    loadNotes();
    showStatus("🧹 Все заметки очищены", "#ffebee");
  }
}

// Отображение статуса
function showStatus(message, bgColor) {
  statusDiv.textContent = message;
  statusDiv.style.background = bgColor;
  setTimeout(() => {
    if (navigator.onLine) {
      statusDiv.innerHTML = "✅ Приложение готово к работе";
      statusDiv.style.background = "#e8f5e9";
    } else {
      statusDiv.innerHTML = "📡 Офлайн-режим. Данные сохранятся локально.";
      statusDiv.style.background = "#fff3e0";
    }
  }, 2000);
}

// Отслеживание статуса сети
function updateNetworkStatus() {
  if (!navigator.onLine) {
    statusDiv.innerHTML = "📡 Офлайн-режим. Данные сохранятся локально.";
    statusDiv.style.background = "#fff3e0";
  } else {
    statusDiv.innerHTML = "✅ Приложение готово к работе (Online)";
    statusDiv.style.background = "#e8f5e9";
  }
}

// Обработка формы
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (text) {
    addNote(text);
    input.value = "";
  }
});

clearBtn.addEventListener("click", clearAllNotes);

// Следим за статусом сети
window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

// ========== Регистрация Service Worker ==========
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("✅ ServiceWorker зарегистрирован:", registration.scope);

      // Проверяем обновления
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        console.log("🔄 Обнаружено обновление ServiceWorker");
        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            showStatus(
              "🔄 Обновление готово! Перезагрузите страницу.",
              "#e3f2fd",
            );
          }
        });
      });

      updateNetworkStatus();
    } catch (err) {
      console.error("❌ Ошибка регистрации ServiceWorker:", err);
      showStatus("⚠️ Service Worker не зарегистрирован", "#ffebee");
    }
  });

  // Принудительное обновление при активации нового SW
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
} else {
  console.warn("⚠️ Service Worker не поддерживается браузером");
  statusDiv.innerHTML =
    "⚠️ Ваш браузер не поддерживает Service Worker. Офлайн-режим недоступен.";
  statusDiv.style.background = "#ffebee";
}

// Первоначальная загрузка
loadNotes();
