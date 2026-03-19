let tasks = [];

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

    // 最優先タスク（未完了の最初の1つ）にバッジ
    if (!task.completed && idx === 0) {
      const badge = document.createElement('span');
      badge.className = 'priority-badge';
      badge.textContent = 'TOP';
      item.appendChild(check);
      item.appendChild(text);
      item.appendChild(badge);
      item.appendChild(del);
    } else {
      item.appendChild(check);
      item.appendChild(text);
      item.appendChild(del);
    }

    list.appendChild(item);
  });
}

async function addTask(text) {
  if (!text.trim()) return;
  const task = {
    id: Date.now().toString(),
    text: text.trim(),
    completed: false,
    createdAt: Date.now()
  };
  // 最新が先頭（最優先）
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

// 入力欄でEnterキー
document.getElementById('task-input').addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const input = e.target;
    await addTask(input.value);
    input.value = '';
  }
});

document.getElementById('clear-completed').addEventListener('click', clearCompleted);

loadTasks();
