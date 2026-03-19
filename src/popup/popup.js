let tasks = [];
let categories = [];          // [{ id, name, parentId, collapsed }]
let activeCategoryId = 'all'; // 'all' | category.id
let dragSrcId = null;

// ===== 初期化 =====

async function load() {
  const data = await chrome.storage.local.get(['tasks', 'categories']);
  tasks = data.tasks || [];
  categories = data.categories || [];
  renderSidebar();
  renderTasks();
}

async function saveAll() {
  await chrome.storage.local.set({ tasks, categories });
}

// ===== カテゴリーツリー =====

function buildTree(parentId = null) {
  return categories
    .filter(c => (c.parentId || null) === parentId)
    .map(c => ({ ...c, children: buildTree(c.id) }));
}

function renderSidebar() {
  const tree = document.getElementById('category-tree');
  tree.innerHTML = '';

  // 「すべて」行
  const allItem = makeAllItem();
  tree.appendChild(allItem);

  buildTree(null).forEach(node => {
    tree.appendChild(renderCatNode(node, 0));
  });
}

function makeAllItem() {
  const row = document.createElement('div');
  row.className = 'cat-item' + (activeCategoryId === 'all' ? ' active' : '');
  row.style.paddingLeft = '4px';

  const toggle = document.createElement('button');
  toggle.className = 'cat-toggle leaf';
  toggle.innerHTML = '&#9654;';
  row.appendChild(toggle);

  const name = document.createElement('span');
  name.className = 'cat-name';
  name.textContent = 'すべて';
  row.appendChild(name);

  row.addEventListener('click', () => selectCategory('all'));
  return row;
}

function renderCatNode(node, depth) {
  const wrapper = document.createElement('div');

  // 行
  const row = document.createElement('div');
  row.className = 'cat-item' + (activeCategoryId === node.id ? ' active' : '');
  row.style.paddingLeft = (4 + depth * 14) + 'px';
  row.dataset.id = node.id;

  // 展開矢印
  const toggle = document.createElement('button');
  toggle.className = 'cat-toggle' +
    (node.children.length === 0 ? ' leaf' : '') +
    (!node.collapsed && node.children.length > 0 ? ' expanded' : '');
  toggle.innerHTML = '&#9654;';
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCollapse(node.id);
  });
  row.appendChild(toggle);

  // 名前
  const name = document.createElement('span');
  name.className = 'cat-name';
  name.textContent = node.name;
  row.appendChild(name);

  // アクションボタン
  const actions = document.createElement('div');
  actions.className = 'cat-actions';

  const addBtn = document.createElement('button');
  addBtn.className = 'cat-action-btn';
  addBtn.title = 'サブカテゴリーを追加';
  addBtn.innerHTML = '+';
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showInlineForm(node.id, wrapper, depth + 1);
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'cat-action-btn del';
  delBtn.title = '削除';
  delBtn.innerHTML = '&times;';
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteCategory(node.id);
  });

  actions.appendChild(addBtn);
  actions.appendChild(delBtn);
  row.appendChild(actions);

  row.addEventListener('click', () => selectCategory(node.id));
  wrapper.appendChild(row);

  // 子カテゴリー
  if (node.children.length > 0) {
    const childrenEl = document.createElement('div');
    childrenEl.className = 'cat-children' + (node.collapsed ? ' collapsed' : '');
    childrenEl.style.maxHeight = node.collapsed ? '0' : '1000px';
    node.children.forEach(child => {
      childrenEl.appendChild(renderCatNode(child, depth + 1));
    });
    wrapper.appendChild(childrenEl);
  }

  return wrapper;
}

function showInlineForm(parentId, wrapper, depth) {
  // 既存フォームがあれば削除
  const existing = wrapper.querySelector('.cat-inline-form');
  if (existing) { existing.remove(); return; }

  const form = document.createElement('div');
  form.className = 'cat-inline-form';
  form.style.paddingLeft = (4 + depth * 14) + 'px';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cat-inline-input';
  input.placeholder = 'カテゴリー名...';
  input.maxLength = 20;

  const ok = document.createElement('button');
  ok.className = 'cat-inline-ok';
  ok.innerHTML = '&#10003;';

  const submit = async () => {
    if (!input.value.trim()) { form.remove(); return; }
    await addCategory(input.value.trim(), parentId);
  };

  ok.addEventListener('click', submit);

  let composing = false;
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; });
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !composing) await submit();
    if (e.key === 'Escape') form.remove();
  });

  form.appendChild(input);
  form.appendChild(ok);

  // 子コンテナの後ろか、行の直後に挿入
  const childrenEl = wrapper.querySelector('.cat-children');
  if (childrenEl) {
    childrenEl.appendChild(form);
  } else {
    wrapper.appendChild(form);
  }

  // 親を展開
  const cat = categories.find(c => c.id === parentId);
  if (cat && cat.collapsed) toggleCollapse(parentId);

  input.focus();
}

function showRootInlineForm() {
  const tree = document.getElementById('category-tree');
  const existing = tree.querySelector('.cat-inline-form.root-form');
  if (existing) { existing.remove(); return; }

  const form = document.createElement('div');
  form.className = 'cat-inline-form root-form';
  form.style.paddingLeft = '4px';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cat-inline-input';
  input.placeholder = 'カテゴリー名...';
  input.maxLength = 20;

  const ok = document.createElement('button');
  ok.className = 'cat-inline-ok';
  ok.innerHTML = '&#10003;';

  const submit = async () => {
    if (!input.value.trim()) { form.remove(); return; }
    await addCategory(input.value.trim(), null);
  };

  ok.addEventListener('click', submit);

  let composing = false;
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; });
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !composing) await submit();
    if (e.key === 'Escape') form.remove();
  });

  form.appendChild(input);
  form.appendChild(ok);
  tree.appendChild(form);
  input.focus();
}

function toggleCollapse(id) {
  const cat = categories.find(c => c.id === id);
  if (!cat) return;
  cat.collapsed = !cat.collapsed;
  saveAll();
  renderSidebar();
}

function selectCategory(id) {
  activeCategoryId = id;
  // ヘッダー名更新
  const label = id === 'all' ? 'すべて' : (categories.find(c => c.id === id)?.name || '');
  document.getElementById('current-category-name').textContent = label;
  renderSidebar();
  renderTasks();
}

async function addCategory(name, parentId) {
  const cat = { id: Date.now().toString(), name, parentId: parentId || null, collapsed: false };
  categories.push(cat);
  activeCategoryId = cat.id;
  document.getElementById('current-category-name').textContent = cat.name;
  await saveAll();
  renderSidebar();
  renderTasks();
}

async function deleteCategory(id) {
  // 子孫カテゴリーをすべて収集
  function collectDescendants(pid) {
    const children = categories.filter(c => c.parentId === pid);
    return children.reduce((acc, c) => [...acc, c.id, ...collectDescendants(c.id)], []);
  }
  const toDelete = [id, ...collectDescendants(id)];

  categories = categories.filter(c => !toDelete.includes(c.id));
  // 削除したカテゴリーに属するタスクはカテゴリーなしに
  tasks.forEach(t => { if (toDelete.includes(t.categoryId)) t.categoryId = null; });
  if (toDelete.includes(activeCategoryId)) {
    activeCategoryId = 'all';
    document.getElementById('current-category-name').textContent = 'すべて';
  }
  await saveAll();
  renderSidebar();
  renderTasks();
}

document.getElementById('btn-add-root-cat').addEventListener('click', showRootInlineForm);

// ===== タスク =====

function getVisibleTasks() {
  if (activeCategoryId === 'all') return tasks;

  // 選択カテゴリーとその子孫すべてのタスクを表示
  function descendants(pid) {
    const children = categories.filter(c => c.parentId === pid);
    return children.reduce((acc, c) => [...acc, c.id, ...descendants(c.id)], []);
  }
  const ids = [activeCategoryId, ...descendants(activeCategoryId)];
  return tasks.filter(t => ids.includes(t.categoryId));
}

function renderTasks() {
  const list = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  const visible = getVisibleTasks();
  const active = visible.filter(t => !t.completed);
  const done = visible.filter(t => t.completed);
  const sorted = [...active, ...done];

  list.innerHTML = '';

  if (sorted.length === 0) {
    emptyState.classList.add('visible');
    return;
  }
  emptyState.classList.remove('visible');

  sorted.forEach((task, idx) => {
    const item = document.createElement('div');
    const isTop = !task.completed && idx === 0;
    item.className = 'task-item' +
      (task.completed ? ' completed' : '') +
      (isTop ? ' top-task' : '');
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
    del.innerHTML = '&times;';
    del.addEventListener('click', () => deleteTask(task.id));

    item.appendChild(handle);
    item.appendChild(check);
    item.appendChild(text);

    // 「すべて」表示時にカテゴリーバッジを表示
    if (activeCategoryId === 'all' && task.categoryId) {
      const cat = categories.find(c => c.id === task.categoryId);
      if (cat) {
        const badge = document.createElement('span');
        badge.className = 'category-badge';
        badge.textContent = cat.name;
        item.appendChild(badge);
      }
    }

    if (isTop) {
      const topBadge = document.createElement('span');
      topBadge.className = 'priority-badge';
      topBadge.textContent = 'TOP';
      item.appendChild(topBadge);
    }

    item.appendChild(del);
    list.appendChild(item);
  });
}

// ===== ドラッグ&ドロップ =====

function onDragStart(e) {
  dragSrcId = e.currentTarget.dataset.id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e) {
  e.preventDefault();
  if (e.currentTarget.dataset.id !== dragSrcId)
    e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }

async function onDrop(e) {
  e.preventDefault();
  const targetId = e.currentTarget.dataset.id;
  e.currentTarget.classList.remove('drag-over');
  if (targetId === dragSrcId) return;

  const active = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);
  const si = active.findIndex(t => t.id === dragSrcId);
  const di = active.findIndex(t => t.id === targetId);
  if (si === -1 || di === -1) return;
  const [moved] = active.splice(si, 1);
  active.splice(di, 0, moved);
  tasks = [...active, ...done];
  await saveAll();
  renderTasks();
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

// ===== CRUD =====

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
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.completed = !t.completed;
  t.completedAt = t.completed ? Date.now() : null;
  await saveAll();
  renderTasks();
}

async function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  await saveAll();
  renderTasks();
}

async function clearCompleted() {
  const ids = getVisibleTasks().filter(t => t.completed).map(t => t.id);
  tasks = tasks.filter(t => !ids.includes(t.id));
  await saveAll();
  renderTasks();
}

// ===== 入力欄 =====
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
