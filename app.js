"use strict";

const storageKey = "na-segodnya.tasks.v1";
const themeKey = "na-segodnya.theme.v1";
const themeButtons = Array.from(document.querySelectorAll("[data-theme-choice]"));
const themeColor = document.querySelector('meta[name="theme-color"]');
const form = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const taskError = document.querySelector("#task-error");
const storageError = document.querySelector("#storage-error");
const taskList = document.querySelector("#task-list");
const template = document.querySelector("#task-template");
const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
const empty = document.querySelector("#empty");
const emptyTitle = document.querySelector("#empty-title");
const emptyHint = document.querySelector("#empty-hint");
const progress = document.querySelector("#progress");
const progressText = document.querySelector("#progress-text");
const progressValue = document.querySelector("#progress-value");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const status = document.querySelector("#status");

const emptyMessages = {
  all: ["Список пока пуст", "Добавьте задачу, чтобы начать."],
  active: ["Нет активных задач", "Новые задачи появятся здесь."],
  done: ["Пока ничего не выполнено", "Отметьте задачу, и она появится здесь."],
};

let tasks = loadTasks();
let filter = "all";
let displayedPercent = 0;
let targetPercent = 0;
let progressFrame = 0;

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter(task =>
      typeof task?.text === "string" &&
      task.text.trim().length > 0 &&
      typeof task.done === "boolean"
    );
  } catch {
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(tasks));
    storageError.hidden = true;
  } catch {
    storageError.hidden = false;
  }
}

function renderTasks() {
  const visibleTasks = tasks.filter(task =>
    filter === "all" || task.done === (filter === "done")
  );
  const rows = document.createDocumentFragment();

  for (const [index, task] of visibleTasks.entries()) {
    const row = template.content.firstElementChild.cloneNode(true);
    const checkbox = row.querySelector("input");
    const deleteButton = row.querySelector(".delete");
    row.querySelector(".task-text").textContent = task.text;
    checkbox.checked = task.done;
    deleteButton.setAttribute("aria-label", `Удалить задачу «${task.text}»`);

    checkbox.addEventListener("change", () => {
      task.done = checkbox.checked;
      saveTasks();
      renderTasks();
      focusTaskControl(index, "input");
    });

    deleteButton.addEventListener("click", () => {
      tasks.splice(tasks.indexOf(task), 1);
      saveTasks();
      renderTasks();
      focusTaskControl(index, ".delete");
      status.textContent = `Задача «${task.text}» удалена.`;
    });

    rows.append(row);
  }

  taskList.replaceChildren(rows);
  empty.hidden = visibleTasks.length > 0;
  [emptyTitle.textContent, emptyHint.textContent] = emptyMessages[filter];

  for (const button of filterButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.filter === filter));
  }

  const completed = tasks.filter(task => task.done).length;
  const percent = tasks.length ? Math.round(100 * completed / tasks.length) : 0;
  const summary = `${completed} из ${tasks.length} выполнено`;
  if (progressText.textContent !== summary) progressText.textContent = summary;
  animateProgress(percent);
}

function setProgress(percent) {
  displayedPercent = percent;
  progress.style.setProperty("--completion", `${percent}%`);
  const label = `${Math.round(percent)}%`;
  if (progressValue.textContent !== label) progressValue.textContent = label;
}

function animateProgress(percent) {
  if (percent === targetPercent) return;
  targetPercent = percent;
  cancelAnimationFrame(progressFrame);

  if (reducedMotion.matches) {
    setProgress(percent);
    return;
  }

  const startPercent = displayedPercent;
  const startTime = performance.now();
  const duration = 500;

  function update(time) {
    const elapsed = Math.min(1, Math.max(0, (time - startTime) / duration));
    const eased = 1 - (1 - elapsed) ** 3;
    setProgress(startPercent + (percent - startPercent) * eased);
    if (elapsed < 1) progressFrame = requestAnimationFrame(update);
  }

  progressFrame = requestAnimationFrame(update);
}

function focusTaskControl(index, selector) {
  const row = taskList.children[Math.min(index, taskList.children.length - 1)];
  const control = row?.querySelector(selector) ??
    (filter === "all" ? taskInput : filterButtons.find(button => button.dataset.filter === filter));
  control.focus();
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const text = taskInput.value.trim();
  if (!text) {
    taskError.hidden = false;
    taskInput.setAttribute("aria-invalid", "true");
    taskInput.focus();
    return;
  }

  tasks.unshift({ text, done: false });
  saveTasks();
  if (filter === "done") filter = "all";
  form.reset();
  taskInput.removeAttribute("aria-invalid");
  taskError.hidden = true;
  renderTasks();
  taskInput.focus();
  status.textContent = `Задача «${text}» добавлена.`;
});

taskInput.addEventListener("input", () => {
  taskError.hidden = true;
  taskInput.removeAttribute("aria-invalid");
});

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    renderTasks();
  });
}

function readTheme() {
  try {
    return localStorage.getItem(themeKey) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  themeColor.content = getComputedStyle(root).backgroundColor;

  for (const button of themeButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
  }
}

for (const button of themeButtons) {
  button.addEventListener("click", () => {
    const theme = button.dataset.themeChoice;
    applyTheme(theme);
    try {
      localStorage.setItem(themeKey, theme);
    } catch {
      // Keep the selected theme for this visit when storage is unavailable.
    }
  });
}

applyTheme(readTheme());
renderTasks();
