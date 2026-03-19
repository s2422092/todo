let tasks = [];
let dragSrcId = null;

async function loadTasks() {
  const data = await chrome.storage.local.get('tasks');
  tasks = data.tasks || [];
  renderTasks();
}

async function saveTasks() {
  await chrome.storage.local.set({ tasks });
}

function renderTasks() {
  const list = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const sorted = [...activeTasks, ...completedTasks];

  list.innerHTML = '';

  if (sorted.length === 0) {
    emptyState.classList.add('visible');
    return;
  }
  emptyState.classList.remove('visible');

  sorted.forEach((task, idx) => {
    const item = document.createElement('div');
    item.className = 'task-item' + (task.completed ? ' completed' : '');
    item.dataset.id = task.id;

    // 未完了タスクのみドラッグ可能
    if (!task.completed) {
      item.draggable = true;
      item.addEventListener('dragstart', onDragStart);
      item.addEventListener('dragover', onDragOver);
      item.addEventListener('dragleave', onDragLeave);
      item.addEventListener('drop', onDrop);
      item.addEventListener('dragend', onDragEnd);
    }

    const handle = document.createElement('span');
    handle.className = 'drag-handle' + (task.completed ? ' hidden' : '');
    handle.innerHTML = '&#8942;&#8942;';
    handle.title = 'ドラッグして並び替え';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'task-check';
    check.checked = task.completed;
    check.addEventListener('change', () => toggleTask(task.id));

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = task.text;

    const del = document.createElement('button');
    del.className = 'task-delete';
    del.innerHTML = '×';
    del.title = '削除';
    del.addEventListener('click', () => deleteTask(task.id));

    item.appendChild(handle);
    item.appendChild(check);
    item.appendChild(text);

    if (!task.completed && idx === 0) {
      const badge = document.createElement('span');
      badge.className = 'priority-badge';
      badge.textContent = 'TOP';
      item.appendChild(badge);
    }

    item.appendChild(del);
    list.appendChild(item);
  });
}

// --- ドラッグ&ドロップ ---

function onDragStart(e) {
  dragSrcId = e.currentTarget.dataset.id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const target = e.currentTarget;
  if (target.dataset.id !== dragSrcId) {
    target.classList.add('drag-over');
  }
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function onDrop(e) {
  e.preventDefault();
  const targetId = e.currentTarget.dataset.id;
  e.currentTarget.classList.remove('drag-over');
  if (targetId === dragSrcId) return;

  // 未完了タスクのみ並び替え対象
  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  const srcIdx = activeTasks.findIndex(t => t.id === dragSrcId);
  const dstIdx = activeTasks.findIndex(t => t.id === targetId);
  if (srcIdx === -1 || dstIdx === -1) return;

  const [moved] = activeTasks.splice(srcIdx, 1);
  activeTasks.splice(dstIdx, 0, moved);

  tasks = [...activeTasks, ...completedTasks];
  await saveTasks();
  renderTasks();
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

// --- CRUD ---

async function addTask(text) {
  if (!text.trim()) return;
  const task = {
    id: Date.now().toString(),
    text: text.trim(),
    completed: false,
    createdAt: Date.now()
  };
  tasks.unshift(task);
  await saveTasks();
  renderTasks();
}

async function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  task.completedAt = task.completed ? Date.now() : null;
  await saveTasks();
  renderTasks();
}

async function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  await saveTasks();
  renderTasks();
}

async function clearCompleted() {
  tasks = tasks.filter(t => !t.completed);
  await saveTasks();
  renderTasks();
}

// --- 入力欄（IME対応）---
let isComposing = false;
const taskInput = document.getElementById('task-input');
taskInput.addEventListener('compositionstart', () => { isComposing = true; });
taskInput.addEventListener('compositionend', () => { isComposing = false; });
taskInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && !isComposing) {
    await addTask(e.target.value);
    e.target.value = '';
  }
});

document.getElementById('clear-completed').addEventListener('click', clearCompleted);

loadTasks();
