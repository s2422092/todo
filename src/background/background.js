// アイコンバッジとツールチップに最優先タスクを反映
function updateBadge(tasks) {
  const active = (tasks || []).filter(t => !t.completed);
  const topTask = active[0] || null;

  if (!topTask) {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: 'QuickTodo' });
    return;
  }

  // 未完了件数をバッジに表示
  const count = active.length;
  chrome.action.setBadgeText({ text: String(count) });
  chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' });
  chrome.action.setBadgeTextColor({ color: '#ffffff' });

  // ホバー時に最優先タスクを表示
  chrome.action.setTitle({ title: `TOP: ${topTask.text}` });
}

// ショートカットキーで最優先タスクを完了にする
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'complete-top-task') {
    const data = await chrome.storage.local.get('tasks');
    const tasks = data.tasks || [];
    const topTask = tasks.find(t => !t.completed);
    if (!topTask) return;

    topTask.completed = true;
    topTask.completedAt = Date.now();
    await chrome.storage.local.set({ tasks });

    // 全タブのcontent scriptに通知
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type: 'TASKS_UPDATED', tasks }).catch(() => {});
    }
  }
});

// storage変更をcontent scriptに伝える & バッジ更新
chrome.storage.onChanged.addListener(async (changes) => {
  if (!changes.tasks) return;
  const tasks = changes.tasks.newValue || [];
  updateBadge(tasks);
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, { type: 'TASKS_UPDATED', tasks }).catch(() => {});
  }
});

// 起動時にバッジを初期化
chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get('tasks');
  updateBadge(data.tasks || []);
});

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get('tasks');
  updateBadge(data.tasks || []);
});
