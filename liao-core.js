/* ============================================================
   liao-core.js — 数据初始化 / 工具函数 / 入口 / 标签切换
   ============================================================ */

/* ---------- 存取工具 ---------- */
function lSave(key, val) {
  const fullKey = 'liao_' + key;
  if (typeof window.LIAO_BIG_KEYS !== 'undefined' &&
      window.LIAO_BIG_KEYS.includes(fullKey) &&
      typeof window.liaoDbSave === 'function') {
    window.liaoDbSave(fullKey, val);
    return;
  }
  try { localStorage.setItem(fullKey, JSON.stringify(val)); } catch (e) {}
}

function lLoad(key, def) {
  try {
    const v = localStorage.getItem('liao_' + key);
    return v !== null ? JSON.parse(v) : def;
  } catch (e) { return def; }
}


/* ---------- 全局数据 ---------- */
let liaoRoles      = [];
let liaoChats      = [];
let liaoSuiyan     = [];
let liaoUserName   = lLoad('userName', '用户');
let liaoUserAvatar = lLoad('userAvatar', 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=user');
let liaoBgSrc      = lLoad('suiyanBg', '');

/* 从 IndexedDB 异步加载大数据，加载完后刷新界面 */
(async function loadBigData() {
  try {
    if (typeof window.liaoDbLoad === 'function') {
      liaoRoles  = await window.liaoDbLoad('liao_roles',  []);
      liaoChats  = await window.liaoDbLoad('liao_chats',  []);
      liaoSuiyan = await window.liaoDbLoad('liao_suiyan', []);
    } else {
      liaoRoles  = lLoad('roles',  []);
      liaoChats  = lLoad('chats',  []);
      liaoSuiyan = lLoad('suiyan', []);
    }
    liaoChats.forEach(c => { if (typeof initChatMemory === 'function') initChatMemory(c); });
  } catch (e) {
    liaoRoles  = lLoad('roles',  []);
    liaoChats  = lLoad('chats',  []);
    liaoSuiyan = lLoad('suiyan', []);
  }
  /* 数据加载完成标记 */
  window._liaoDataReady = true;
})();


let currentChatIdx = -1;

/* ---------- 工具函数 ---------- */
function defaultAvatar() {
  return 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=default';
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(ts) {
  if (!ts) return '';
  const now  = new Date();
  const date = new Date(ts);
  const diff = now - date;
  if (diff < 60000)    return '刚刚';
  if (diff < 3600000)  return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  const h  = String(date.getHours()).padStart(2, '0');
  const m  = String(date.getMinutes()).padStart(2, '0');
  const mo = date.getMonth() + 1;
  const d  = date.getDate();
  if (now.getFullYear() === date.getFullYear()) return mo + '/' + d + ' ' + h + ':' + m;
  return date.getFullYear() + '/' + mo + '/' + d;
}

function loadApiConfig() {
  try {
    const v = localStorage.getItem('halo9_apiActiveConfig');
    return v ? JSON.parse(v) : null;
  } catch (e) { return null; }
}

function loadApiModel() {
  try {
    const v = localStorage.getItem('halo9_apiCurrentModel');
    return v ? JSON.parse(v) : '';
  } catch (e) { return ''; }
}

function removeEmoji(str) {
  return str.replace(
    /[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu,
    ''
  ).replace(/[\u2702-\u27B0]/gu, '').trim();
}

function calcBubbleDelay(text) {
  const len = (text || '').replace(/\s/g, '').length;
  if (len <= 2)  return 200;
  if (len <= 5)  return 500;
  if (len <= 10) return 900;
  if (len <= 20) return 1400;
  return 2000;
}

/* ---------- 入口绑定 ---------- */
function bindLiaoEntry() {
  document.querySelectorAll('[data-app="chat"]').forEach(el => {
    el.addEventListener('click', openLiaoApp);
  });
  const dockChat = document.getElementById('dock-chat');
  if (dockChat) dockChat.addEventListener('click', openLiaoApp);
}
bindLiaoEntry();

function openLiaoApp() {
  document.getElementById('liao-app').classList.add('show');
  switchLiaoTab('chatlist');
  renderChatList();
}

function closeLiaoApp() {
  document.getElementById('liao-app').classList.remove('show');
}

/* ---------- 标签切换 ---------- */
function switchLiaoTab(tabId) {
  // 切换 tab 时，强制关闭聊天界面和聊天设置覆盖层
  const chatView = document.getElementById('liao-chat-view');
  const chatSettings = document.getElementById('liao-chat-settings');
  if (chatView) chatView.classList.remove('show');
  if (chatSettings) chatSettings.classList.remove('show');
  currentChatIdx = -1;

  document.querySelectorAll('.liao-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.liao-panel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.panel === tabId);
  });

  if (tabId === 'chatlist') renderChatList();
  if (tabId === 'rolelib') {
    const countEl = document.getElementById('lcb-cover-count');
    if (countEl) {
      const count = typeof liaoRoles !== 'undefined' ? liaoRoles.length : 0;
      countEl.textContent = count + ' 位角色';
    }
  }
  if (tabId === 'myhome') {
    if (typeof window.initMyhomePanel === 'function') window.initMyhomePanel();
  }
  if (tabId === 'suiyan') renderSuiyan();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ---------- 标签点击事件委托 ---------- */
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.liao-tab-btn');
  if (!btn) return;
  if (btn.id === 'liao-close-btn') {
    closeLiaoApp();
    return;
  }
  const tabId = btn.dataset.tab;
  if (!tabId) return;
  switchLiaoTab(tabId);
});

/* ---------- 弹窗遮罩点击关闭 ---------- */
[
  'liao-new-role-modal',
  'liao-new-group-modal',
  'liao-import-modal',
  'liao-post-modal',
  'liao-comment-modal'
].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('show');
  });
});

[
  'liao-suiyan-bg-modal',
  'liao-suiyan-avatar-modal',
  'liao-suiyan-name-modal'
].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none';
  });
});
