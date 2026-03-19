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

// storage変更をcontent scriptに伝える
chrome.storage.onChanged.addListener(async (changes) => {
  if (!changes.tasks) return;
  const tasks = changes.tasks.newValue || [];
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, { type: 'TASKS_UPDATED', tasks }).catch(() => {});
  }
});
