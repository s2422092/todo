(function () {
  'use strict';

  const ROOT_ID = 'qt-root';
  if (document.getElementById(ROOT_ID)) return; // 二重実行防止

  let tasks = [];
  let categories = [];
  let activeCategoryId = 'all';
  let isExpanded = false;
  let isComposing = false;
  let dragSrcId = null;

  // ===== データ =====

  async function loadData() {
    const data = await chrome.storage.local.get(['tasks', 'categories']);
    tasks = data.tasks || [];
    categories = data.categories || [];
  }

  async function saveAll() {
    await chrome.storage.local.set({ tasks, categories });
  }

  // storage変更を監視（他タブや background からの変更を反映）
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.tasks) tasks = changes.tasks.newValue || [];
    if (changes.categories) categories = changes.categories.newValue || [];
    renderPanel();
    updateCollapsedBar();
  });

  // ===== ルートDOM構築 =====

  function buildRoot() {
    const root = document.createElement('div');
    root.id = ROOT_ID;

    // 折りたたみバー（常時表示）
    const bar = document.createElement('div');
    bar.id = 'qt-bar';
    bar.addEventListener('click', togglePanel);

    const barIcon = document.createElement('span');
    barIcon.id = 'qt-bar-icon';
    barIcon.textContent = '✓';

    const barText = document.createElement('span');
    barText.id = 'qt-bar-text';

    const barToggle = document.createElement('span');
    barToggle.id = 'qt-bar-toggle';

    bar.appendChild(barIcon);
    bar.appendChild(barText);
    bar.appendChild(barToggle);

    // 展開パネル
    const panel = document.createElement('div');
    panel.id = 'qt-panel';

    // パネルヘッダー
    const header = document.createElement('div');
    header.id = 'qt-header';

    const title = document.createElement('span');
    title.id = 'qt-title';
    title.textContent = 'QuickTodo';

    const closeBtn = document.createElement('button');
    closeBtn.id = 'qt-close';
    closeBtn.textContent = '×';
    closeBtn.title = '閉じる';
    closeBtn.addEventListener('click', togglePanel);

    header.appendChild(title);
    header.appendChild(closeBtn);

    // カテゴリータブ
    const catBar = document.createElement('div');
    catBar.id = 'qt-cat-bar';

    // タスク入力
    const inputWrap = document.createElement('div');
    inputWrap.id = 'qt-input-wrap';

    const input = document.createElement('input');
    input.id = 'qt-input';
    input.type = 'text';
    input.placeholder = 'タスクを追加... (Enter)';
    input.maxLength = 100;
    input.addEventListener('compositionstart', () => { isComposing = true; });
    input.addEventListener('compositionend', () => { isComposing = false; });
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && !isComposing) {
        await addTask(input.value);
        input.value = '';
      }
    });
    inputWrap.appendChild(input);

    // タスクリスト
    const taskList = document.createElement('div');
    taskList.id = 'qt-task-list';

    // 空状態
    const empty = document.createElement('div');
    empty.id = 'qt-empty';
    empty.textContent = 'タスクなし';

    // フッター
    const footer = document.createElement('div');
    footer.id = 'qt-footer';

    const clearBtn = document.createElement('button');
    clearBtn.id = 'qt-clear';
    clearBtn.textContent = '完了済みを削除';
    clearBtn.addEventListener('click', clearCompleted);
    footer.appendChild(clearBtn);

    panel.appendChild(header);
    panel.appendChild(catBar);
    panel.appendChild(inputWrap);
    panel.appendChild(taskList);
    panel.appendChild(empty);
    panel.appendChild(footer);

    root.appendChild(panel);
    root.appendChild(bar);
    document.body.appendChild(root);
  }

  function togglePanel() {
    isExpanded = !isExpanded;
    const panel = document.getElementById('qt-panel');
    const toggle = document.getElementById('qt-bar-toggle');
    panel.classList.toggle('qt-visible', isExpanded);
    toggle.textContent = isExpanded ? '▼' : '▲';
    if (isExpanded) {
      renderPanel();
      setTimeout(() => document.getElementById('qt-input')?.focus(), 50);
    }
  }

  // ===== カテゴリータブ描画 =====

  function renderCategoryTabs() {
    const bar = document.getElementById('qt-cat-bar');
    if (!bar) return;
    bar.innerHTML = '';

    const allTab = makeCatTab('all', 'すべて');
    bar.appendChild(allTab);

    // ルートカテゴリーのみ表示（フラット）
    categories.filter(c => !c.parentId).forEach(cat => {
      bar.appendChild(makeCatTab(cat.id, cat.name));
    });

    // カテゴリー追加ボタン
    const addBtn = document.createElement('button');
    addBtn.className = 'qt-cat-add';
    addBtn.textContent = '+';
    addBtn.title = 'カテゴリーを追加';
    addBtn.addEventListener('click', () => showCatInput(bar));
    bar.appendChild(addBtn);
  }

  function makeCatTab(id, name) {
    const tab = document.createElement('button');
    tab.className = 'qt-cat-tab' + (activeCategoryId === id ? ' qt-active' : '');
    tab.textContent = name;
    tab.addEventListener('click', () => {
      activeCategoryId = id;
      renderPanel();
    });
    return tab;
  }

  function showCatInput(bar) {
    if (bar.querySelector('.qt-cat-input')) return;
    const input = document.createElement('input');
    input.className = 'qt-cat-input';
    input.placeholder = 'カテゴリー名...';
    input.maxLength = 20;

    let comp = false;
    input.addEventListener('compositionstart', () => { comp = true; });
    input.addEventListener('compositionend', () => { comp = false; });
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && !comp) {
        if (input.value.trim()) {
          categories.push({ id: Date.now().toString(), name: input.value.trim(), parentId: null, collapsed: false });
          await saveAll();
        }
        input.remove();
        renderPanel();
      }
      if (e.key === 'Escape') input.remove();
    });
    input.addEventListener('blur', () => setTimeout(() => input.remove(), 150));

    bar.insertBefore(input, bar.querySelector('.qt-cat-add'));
    input.focus();
  }

  // ===== タスク描画 =====

  function getVisible() {
    if (activeCategoryId === 'all') return tasks;
    function desc(pid) {
      return categories.filter(c => c.parentId === pid)
        .reduce((a, c) => [...a, c.id, ...desc(c.id)], []);
    }
    const ids = [activeCategoryId, ...desc(activeCategoryId)];
    return tasks.filter(t => ids.includes(t.categoryId));
  }

  function renderTasks() {
    const list = document.getElementById('qt-task-list');
    const empty = document.getElementById('qt-empty');
    if (!list || !empty) return;

    list.innerHTML = '';
    const visible = getVisible();
    const active = visible.filter(t => !t.completed);
    const done = visible.filter(t => t.completed);
    const sorted = [...active, ...done];

    empty.style.display = sorted.length === 0 ? 'block' : 'none';

    sorted.forEach((task, idx) => {
      const item = document.createElement('div');
      item.className = 'qt-task' + (task.completed ? ' qt-done' : '') + (!task.completed && idx === 0 ? ' qt-top' : '');
      item.dataset.id = task.id;

      if (!task.completed) {
        item.draggable = true;
        item.addEventListener('dragstart', e => {
          dragSrcId = e.currentTarget.dataset.id;
          e.currentTarget.classList.add('qt-dragging');
          e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragover', e => {
          e.preventDefault();
          if (e.currentTarget.dataset.id !== dragSrcId)
            e.currentTarget.classList.add('qt-dragover');
        });
        item.addEventListener('dragleave', e => e.currentTarget.classList.remove('qt-dragover'));
        item.addEventListener('drop', async e => {
          e.preventDefault();
          const targetId = e.currentTarget.dataset.id;
          e.currentTarget.classList.remove('qt-dragover');
          if (targetId === dragSrcId) return;
          const act = tasks.filter(t => !t.completed);
          const don = tasks.filter(t => t.completed);
          const si = act.findIndex(t => t.id === dragSrcId);
          const di = act.findIndex(t => t.id === targetId);
          if (si === -1 || di === -1) return;
          const [m] = act.splice(si, 1);
          act.splice(di, 0, m);
          tasks = [...act, ...don];
          await saveAll();
          renderPanel();
        });
        item.addEventListener('dragend', e => {
          e.currentTarget.classList.remove('qt-dragging');
          list.querySelectorAll('.qt-dragover').forEach(el => el.classList.remove('qt-dragover'));
        });
      }

      item.addEventListener('click', (e) => {
        if (e.target.closest('.qt-del')) return;
        toggleTask(task.id);
      });

      const check = document.createElement('span');
      check.className = 'qt-check' + (task.completed ? ' qt-checked' : '');

      const text = document.createElement('span');
      text.className = 'qt-text';
      text.textContent = task.text;

      const del = document.createElement('button');
      del.className = 'qt-del';
      del.textContent = '×';
      del.addEventListener('click', () => deleteTask(task.id));

      item.appendChild(check);
      item.appendChild(text);

      if (!task.completed && idx === 0) {
        const badge = document.createElement('span');
        badge.className = 'qt-badge';
        badge.textContent = 'TOP';
        item.appendChild(badge);
      }

      item.appendChild(del);
      list.appendChild(item);
    });
  }

  function renderPanel() {
    renderCategoryTabs();
    renderTasks();
    updateCollapsedBar();
  }

  // ===== 折りたたみバー更新 =====

  function updateCollapsedBar() {
    const barText = document.getElementById('qt-bar-text');
    const toggle = document.getElementById('qt-bar-toggle');
    if (!barText) return;
    const top = tasks.find(t => !t.completed);
    barText.textContent = top ? top.text : 'タスクなし';
    toggle.textContent = isExpanded ? '▼' : '▲';
  }

  // ===== CRUD =====

  async function addTask(text) {
    if (!text.trim()) return;
    tasks.unshift({
      id: Date.now().toString(),
      text: text.trim(),
      completed: false,
      categoryId: activeCategoryId === 'all' ? null : activeCategoryId,
      createdAt: Date.now()
    });
    await saveAll();
    renderPanel();
  }

  async function toggleTask(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    t.completed = !t.completed;
    t.completedAt = t.completed ? Date.now() : null;
    await saveAll();
    renderPanel();
  }

  async function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    await saveAll();
    renderPanel();
  }

  async function clearCompleted() {
    const ids = getVisible().filter(t => t.completed).map(t => t.id);
    tasks = tasks.filter(t => !ids.includes(t.id));
    await saveAll();
    renderPanel();
  }

  // ===== 初期化 =====

  async function init() {
    await loadData();
    buildRoot();
    renderPanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
