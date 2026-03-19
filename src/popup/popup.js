let tasks = [];
let categories = [];
let activeCategoryId = 'all'; // 'all' or category id
let dragSrcId = null;

// --- 初期化 ---

async function load() {
  const data = await chrome.storage.local.get(['tasks', 'categories']);
  tasks = data.tasks || [];
  categories = data.categories || [];
  renderCategories();
  renderTasks();
}

async function saveAll() {
  await chrome.storage.local.set({ tasks, categories });
}

// --- カテゴリー ---

function renderCategories() {
  const tabs = document.getElementById('category-tabs');
  tabs.innerHTML = '';

  // 「すべて」タブ
  const allTab = createCategoryTab('all', 'すべて');
  tabs.appendChild(allTab);

  categories.forEach(cat => {
    const tab = createCategoryTab(cat.id, cat.name, true);
    tabs.appendChild(tab);
  });
}

function createCategoryTab(id, name, deletable = false) {
  const tab = document.createElement('div');
  tab.className = 'category-tab' + (activeCategoryId === id ? ' active' : '');
  tab.dataset.id = id;

  const label = document.createElement('span');
  label.textContent = name;
  tab.appendChild(label);

  if (deletable) {
    const del = document.createElement('button');
    del.className = 'category-tab-delete';
    del.innerHTML = '×';
    del.title = 'カテゴリーを削除';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCategory(id);
    });
    tab.appendChild(del);
  }

  tab.addEventListener('click', () => selectCategory(id));
  return tab;
}

function selectCategory(id) {
  activeCategoryId = id;
  renderCategories();
  renderTasks();
}

async function addCategory(name) {
  if (!name.trim()) return;
  const cat = { id: Date.now().toString(), name: name.trim() };
  categories.push(cat);
  activeCategoryId = cat.id;
  await saveAll();
  renderCategories();
  renderTasks();
}

async function deleteCategory(id) {
  categories = categories.filter(c => c.id !== id);
  // そのカテゴリーのタスクは「すべて」に戻す
  tasks.forEach(t => { if (t.categoryId === id) t.categoryId = null; });
  if (activeCategoryId === id) activeCategoryId = 'all';
  await saveAll();
  renderCategories();
  renderTasks();
}

// カテゴリー追加フォームの表示制御
document.getElementById('add-category-btn').addEventListener('click', () => {
  document.getElementById('category-form').classList.remove('hidden');
  document.getElementById('category-input').focus();
});

document.getElementById('category-cancel').addEventListener('click', () => {
  document.getElementById('category-form').classList.add('hidden');
  document.getElementById('category-input').value = '';
});

document.getElementById('category-submit').addEventListener('click', async () => {
  const input = document.getElementById('category-input');
  await addCategory(input.value);
  input.value = '';
  document.getElementById('category-form').classList.add('hidden');
});

const catInput = document.getElementById('category-input');
let catComposing = false;
catInput.addEventListener('compositionstart', () => { catComposing = true; });
catInput.addEventListener('compositionend', () => { catComposing = false; });
catInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && !catComposing) {
    await addCategory(catInput.value);
    catInput.value = '';
    document.getElementById('category-form').classList.add('hidden');
  }
  if (e.key === 'Escape') {
    document.getElementById('category-form').classList.add('hidden');
    catInput.value = '';
  }
});

// --- タスク描画 ---

function getFilteredTasks() {
  if (activeCategoryId === 'all') return tasks;
  return tasks.filter(t => t.categoryId === activeCategoryId);
}

function renderTasks() {
  const list = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  const filtered = getFilteredTasks();
  const activeTasks = filtered.filter(t => !t.completed);
  const completedTasks = filtered.filter(t => t.completed);
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

    if (!task.completed) {
      item.draggable = true;
      item.addEventListener('dragstart', onDragStart);
      item.addEventListener('dragover', onDragOver);
      item.addEventListener('dragleave', onDragLeave);
      item.addEventListener('drop', onDrop);
      item.addEventListener('dragend', onDragEnd);
    }

    item.addEventListener('click', (e) => {
      if (e.target.closest('.task-delete') || e.target.closest('.drag-handle')) return;
      toggleTask(task.id);
    });

    const handle = document.createElement('span');
    handle.className = 'drag-handle' + (task.completed ? ' hidden' : '');
    handle.innerHTML = '&#8942;&#8942;';
    handle.title = 'ドラッグして並び替え';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'task-check';
    check.checked = task.completed;
    check.tabIndex = -1;
    check.style.pointerEvents = 'none';

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

    // カテゴリーバッジ（「すべて」表示時のみ）
    if (activeCategoryId === 'all' && task.categoryId) {
      const cat = categories.find(c => c.id === task.categoryId);
      if (cat) {
        const catBadge = document.createElement('span');
        catBadge.className = 'category-badge';
        catBadge.textContent = cat.name;
        item.appendChild(catBadge);
      }
    }

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
  if (target.dataset.id !== dragSrcId) target.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function onDrop(e) {
  e.preventDefault();
  const targetId = e.currentTarget.dataset.id;
  e.currentTarget.classList.remove('drag-over');
  if (targetId === dragSrcId) return;

  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const srcIdx = activeTasks.findIndex(t => t.id === dragSrcId);
  const dstIdx = activeTasks.findIndex(t => t.id === targetId);
  if (srcIdx === -1 || dstIdx === -1) return;

  const [moved] = activeTasks.splice(srcIdx, 1);
  activeTasks.splice(dstIdx, 0, moved);
  tasks = [...activeTasks, ...completedTasks];
  await saveAll();
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
    categoryId: activeCategoryId === 'all' ? null : activeCategoryId,
    createdAt: Date.now()
  };
  tasks.unshift(task);
  await saveAll();
  renderTasks();
}

async function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  task.completedAt = task.completed ? Date.now() : null;
  await saveAll();
  renderTasks();
}

async function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  await saveAll();
  renderTasks();
}

async function clearCompleted() {
  const filtered = getFilteredTasks().filter(t => t.completed).map(t => t.id);
  tasks = tasks.filter(t => !filtered.includes(t.id));
  await saveAll();
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

load();
