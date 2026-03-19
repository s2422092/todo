(function () {
  'use strict';

  const BAR_ID = 'quicktodo-bar';

  function getTopTask(tasks) {
    return (tasks || []).find(t => !t.completed) || null;
  }

  function createBar(task) {
    const bar = document.createElement('div');
    bar.id = BAR_ID;

    const label = document.createElement('span');
    label.className = 'qt-label';
    label.textContent = '▶ ';

    const text = document.createElement('span');
    text.className = 'qt-text';
    text.textContent = task.text;

    const shortcut = document.createElement('span');
    shortcut.className = 'qt-shortcut';
    shortcut.textContent = 'Alt+Shift+D で完了';

    const close = document.createElement('button');
    close.className = 'qt-close';
    close.innerHTML = '×';
    close.title = 'バーを隠す';
    close.addEventListener('click', () => {
      bar.style.display = 'none';
      sessionStorage.setItem('quicktodo-hidden', '1');
    });

    bar.appendChild(label);
    bar.appendChild(text);
    bar.appendChild(shortcut);
    bar.appendChild(close);

    return bar;
  }

  function updateBar(tasks) {
    const topTask = getTopTask(tasks);
    let bar = document.getElementById(BAR_ID);
    const hidden = sessionStorage.getItem('quicktodo-hidden') === '1';

    if (!topTask) {
      if (bar) bar.remove();
      return;
    }

    if (!bar) {
      bar = createBar(topTask);
      document.body.appendChild(bar);
    } else {
      bar.querySelector('.qt-text').textContent = topTask.text;
      if (!hidden) bar.style.display = '';
    }

    if (hidden) bar.style.display = 'none';
  }

  async function init() {
    const data = await chrome.storage.local.get('tasks');
    updateBar(data.tasks || []);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TASKS_UPDATED') {
      // タスクが更新されたらセッションの非表示フラグをリセット
      sessionStorage.removeItem('quicktodo-hidden');
      updateBar(msg.tasks);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
