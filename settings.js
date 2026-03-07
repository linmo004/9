/* ============================================================
   settings.js — 设置 App 全部逻辑
   ============================================================ */

/* ---------- 工具（复用主app的save/load） ---------- */
function sSave(key, val) {
  try { localStorage.setItem('halo9_' + key, JSON.stringify(val)); } catch (e) {}
}
function sLoad(key, def) {
  try {
    const v = localStorage.getItem('halo9_' + key);
    return v !== null ? JSON.parse(v) : def;
  } catch (e) {
    return def;
  }
}

/* ============================================================
   层级导航
   ============================================================ */
function showLayer(id) {
  document.querySelectorAll('.settings-layer').forEach(el => {
    el.style.display = 'none';
  });
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'flex';
  }
}
function hideAllSettings() {
  document.querySelectorAll('.settings-layer').forEach(el => {
    el.style.display = 'none';
  });
}

/* 设置App入口 — 找到所有设置App图标并绑定 */
function bindSettingsEntry() {
  const dockSettings = document.getElementById('dock-settings');
  if (dockSettings) {
    dockSettings.addEventListener('click', () => showLayer('settings-root'));
  }
  document.querySelectorAll('[data-app="settings"]').forEach(el => {
    el.addEventListener('click', () => showLayer('settings-root'));
  });
}
bindSettingsEntry();

/* 设置主列表关闭 */
document.getElementById('settings-root-close')
  .addEventListener('click', hideAllSettings);

/* 通用返回按钮（data-back 指向目标层） */
document.querySelectorAll('.settings-back-btn[data-back]').forEach(btn => {
  btn.addEventListener('click', function () {
    showLayer(this.dataset.back);
  });
});

/* 三个条目导航 */
document.getElementById('goto-api')
  .addEventListener('click', () => {
    renderApiArchiveList();
    showLayer('settings-api');
  });
document.getElementById('goto-theme')
  .addEventListener('click', () => {
    renderIconReplaceList();
    renderColorFields();
    showLayer('settings-theme');
  });
document.getElementById('goto-data')
  .addEventListener('click', () => showLayer('settings-data'));

/* ============================================================
   ① API 设置
   ============================================================ */
let apiArchives = sLoad('apiArchives', []);
let currentApiModel = '';

function renderApiArchiveList() {
  const container = document.getElementById('api-archive-list');
  if (!apiArchives.length) {
    container.innerHTML =
      '<div class="settings-desc" style="padding:4px 0;">暂无存档，保存后显示在这里</div>';
    return;
  }
  container.innerHTML = '';
  apiArchives.forEach((arc, idx) => {
    const row = document.createElement('div');
    row.className = 'api-archive-item';
    row.innerHTML = `
      <div class="api-archive-info" data-idx="${idx}">
        <div class="api-archive-name">${arc.name || '未命名'}</div>
        <div class="api-archive-url">${arc.url || ''}</div>
      </div>
      <button class="api-archive-del" data-del="${idx}">删除</button>`;
    container.appendChild(row);
  });
  container.querySelectorAll('.api-archive-info').forEach(info => {
    info.addEventListener('click', function () {
      const arc = apiArchives[parseInt(this.dataset.idx)];
      document.getElementById('api-config-name').value = arc.name || '';
      document.getElementById('api-url').value = arc.url || '';
      document.getElementById('api-key').value = arc.key || '';
      setApiModelVisible(false);
      setApiStatus('');
    });
  });
  container.querySelectorAll('.api-archive-del').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      apiArchives.splice(parseInt(this.dataset.del), 1);
      sSave('apiArchives', apiArchives);
      renderApiArchiveList();
    });
  });
}
function setApiStatus(msg, type) {
  const el = document.getElementById('api-fetch-status');
  el.textContent = msg;
  el.className = 'api-status-text' + (type ? ' ' + type : '');
}
function setApiModelVisible(show) {
  document.getElementById('api-model-label').style.display = show ? '' : 'none';
  document.getElementById('api-model-select').style.display = show ? '' : 'none';
  document.getElementById('api-model-confirm-btn').style.display = show ? '' : 'none';
}

document.getElementById('api-fetch-models-btn').addEventListener('click', async function () {
  const url = document.getElementById('api-url').value.trim();
  const key = document.getElementById('api-key').value.trim();
  if (!url) {
    setApiStatus('请先填写 API 地址', 'error');
    return;
  }
  setApiStatus('正在请求模型列表…');
  this.disabled = true;
  try {
    const endpoint = url.replace(/\/$/, '') + '/models';
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = 'Bearer ' + key;
    const res = await fetch(endpoint, { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    let models = [];
    if (Array.isArray(json.data)) {
      models = json.data.map(m => m.id || m.name).filter(Boolean);
    } else if (Array.isArray(json.models)) {
      models = json.models.map(m => m.name || m.id).filter(Boolean);
    } else if (Array.isArray(json)) {
      models = json.map(m => m.id || m.name).filter(Boolean);
    }
    if (!models.length) throw new Error('未获取到模型列表');
    const sel = document.getElementById('api-model-select');
    sel.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
    setApiModelVisible(true);
    setApiStatus('获取到 ' + models.length + ' 个模型', 'success');
  } catch (err) {
    setApiStatus('请求失败：' + err.message, 'error');
    setApiModelVisible(false);
  } finally {
    this.disabled = false;
  }
});

document.getElementById('api-model-confirm-btn').addEventListener('click', function () {
  currentApiModel = document.getElementById('api-model-select').value;
  sSave('apiCurrentModel', currentApiModel);
  setApiStatus('已选择模型：' + currentApiModel, 'success');
});

document.getElementById('api-save-btn').addEventListener('click', function () {
  const name = document.getElementById('api-config-name').value.trim() ||
    '配置' + (apiArchives.length + 1);
  const url = document.getElementById('api-url').value.trim();
  const key = document.getElementById('api-key').value.trim();
  if (!url) {
    setApiStatus('API 地址不能为空', 'error');
    return;
  }
  const existing = apiArchives.findIndex(a => a.name === name);
  if (existing >= 0) {
    apiArchives[existing] = { name, url, key };
  } else {
    apiArchives.push({ name, url, key });
  }
  sSave('apiArchives', apiArchives);
  sSave('apiActiveConfig', { name, url, key });
  renderApiArchiveList();
  setApiStatus('配置已保存', 'success');
});

(function restoreApiConfig() {
  const active = sLoad('apiActiveConfig', null);
  if (!active) return;
  document.getElementById('api-config-name').value = active.name || '';
  document.getElementById('api-url').value = active.url || '';
  document.getElementById('api-key').value = active.key || '';
})();

/* ============================================================
   ② 美化 / 主题
   ============================================================ */

/* ---- 壁纸 ---- */
let wallpaperSrc = sLoad('wallpaper', '');

function applyWallpaper(src) {
  wallpaperSrc = src;
  sSave('wallpaper', src);
  document.body.style.backgroundImage = src ? `url(${src})` : '';
  document.body.style.backgroundSize = src ? 'cover' : '';
  document.body.style.backgroundPosition = src ? 'center' : '';
  const preview = document.getElementById('wallpaper-preview');
  if (preview) {
    preview.style.backgroundImage = src ? `url(${src})` : '';
    preview.style.border = src ? 'none' : '';
  }
}
applyWallpaper(wallpaperSrc);

document.getElementById('wallpaper-url-btn').addEventListener('click', function () {
  document.getElementById('wallpaper-url-input').value = wallpaperSrc || '';
  document.getElementById('wallpaper-url-modal').classList.add('show');
});
document.getElementById('wallpaper-url-confirm').addEventListener('click', function () {
  const url = document.getElementById('wallpaper-url-input').value.trim();
  applyWallpaper(url);
  document.getElementById('wallpaper-url-modal').classList.remove('show');
});
document.getElementById('wallpaper-url-cancel').addEventListener('click', function () {
  document.getElementById('wallpaper-url-modal').classList.remove('show');
});
document.getElementById('wallpaper-local-btn').addEventListener('click', function () {
  document.getElementById('wallpaper-file-input').click();
});
document.getElementById('wallpaper-file-input').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => applyWallpaper(e.target.result);
  reader.readAsDataURL(file);
});
document.getElementById('wallpaper-clear-btn').addEventListener('click', function () {
  applyWallpaper('');
});

/* ---- App 图标替换 ---- */
const iconRegistry = [
  { key: 'dock-chat',     label: 'Dock · 聊天', selector: '#dock-chat .app-icon' },
  { key: 'dock-home',     label: 'Dock · 主页', selector: '#dock-home .app-icon' },
  { key: 'dock-settings', label: 'Dock · 设置', selector: '#dock-settings .app-icon' },
  { key: 'app2-chat',     label: '聊天 App',    selector: '[data-app="chat"] .app-icon' },
  { key: 'app2-settings', label: '设置 App',    selector: '[data-app="settings"] .app-icon' },
  { key: 'app4-0',        label: '音乐',        selector: '[data-app="0"] .app-icon' },
  { key: 'app4-1',        label: '相机',        selector: '[data-app="1"] .app-icon' },
  { key: 'app4-2',        label: '日历',        selector: '[data-app="2"] .app-icon' },
  { key: 'app4-3',        label: '相册',        selector: '[data-app="3"] .app-icon' },
];
let customIcons = sLoad('customIcons', {});
let iconEditKey = '';
let iconTab = 'url';

function restoreAllIcons() {
  iconRegistry.forEach(reg => {
    if (customIcons[reg.key]) {
      document.querySelectorAll(reg.selector).forEach(el => {
        el.src = customIcons[reg.key];
      });
    }
  });
}
restoreAllIcons();

function renderIconReplaceList() {
  const container = document.getElementById('icon-replace-list');
  container.innerHTML = '';
  iconRegistry.forEach(reg => {
    const row = document.createElement('div');
    row.className = 'icon-replace-row';
    const currentSrc =
      customIcons[reg.key] ||
      (document.querySelector(reg.selector) ? document.querySelector(reg.selector).src : '');
    row.innerHTML = `
      <img class="icon-replace-preview" src="${currentSrc}" alt="">
      <div class="icon-replace-name">${reg.label}</div>
      <div class="icon-replace-hint">点击替换 ›</div>`;
    row.addEventListener('click', () => openIconReplaceModal(reg.key, reg.label));
    container.appendChild(row);
  });
}
function openIconReplaceModal(key, label) {
  iconEditKey = key;
  iconTab = 'url';
  document.getElementById('icon-replace-modal-title').textContent = '替换：' + label;
  document.getElementById('icon-url-input').value = '';
  document.getElementById('icon-file-input').value = '';
  setIconTab('url');
  document.getElementById('icon-replace-modal').classList.add('show');
}
document.querySelectorAll('[data-icon-tab]').forEach(btn => {
  btn.addEventListener('click', function () {
    setIconTab(this.dataset.iconTab);
  });
});
function setIconTab(tab) {
  iconTab = tab;
  document.querySelectorAll('[data-icon-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.iconTab === tab);
  });
  document.getElementById('icon-url-panel').style.display = tab === 'url' ? '' : 'none';
  document.getElementById('icon-local-panel').style.display = tab === 'local' ? '' : 'none';
}
function applyIconSrc(key, src) {
  customIcons[key] = src;
  sSave('customIcons', customIcons);
  const reg = iconRegistry.find(r => r.key === key);
  if (reg) {
    document.querySelectorAll(reg.selector).forEach(el => {
      el.src = src;
    });
  }
  renderIconReplaceList();
}
document.getElementById('icon-replace-confirm').addEventListener('click', function () {
  if (iconTab === 'url') {
    const url = document.getElementById('icon-url-input').value.trim();
    if (!url) return;
    applyIconSrc(iconEditKey, url);
    document.getElementById('icon-replace-modal').classList.remove('show');
  } else {
    const file = document.getElementById('icon-file-input').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      applyIconSrc(iconEditKey, e.target.result);
      document.getElementById('icon-replace-modal').classList.remove('show');
    };
    reader.readAsDataURL(file);
  }
});
document.getElementById('icon-replace-cancel').addEventListener('click', function () {
  document.getElementById('icon-replace-modal').classList.remove('show');
});

/* ---- 整体配色 ---- */
const colorDefs = [
  { key: '--primary',    label: '主色调',   default: '#99C8ED' },
  { key: '--light-blue', label: '亮蓝色',   default: '#B3D8F4' },
  { key: '--mid-blue',   label: '中蓝色',   default: '#7a9abf' },
  { key: '--bg',         label: '背景色',   default: '#F5F5F0' },
  { key: '--bg2',        label: '辅助背景', default: '#F8F9FA' },
  { key: '--dark-bg',    label: '深色背景', default: '#1a1f2e' },
  { key: '--text-dark',  label: '主文字色', default: '#2c3448' },
  { key: '--text-mid',   label: '次文字色', default: '#5a6a80' },
  { key: '--text-light', label: '淡文字色', default: '#9aafc4' },
];
let customColors = sLoad('customColors', {});

function applyColors(colorMap) {
  Object.entries(colorMap).forEach(([k, v]) => {
    document.documentElement.style.setProperty(k, v);
  });
}
applyColors(customColors);

function renderColorFields() {
  const container = document.getElementById('color-fields');
  container.innerHTML = '';
  colorDefs.forEach(def => {
    const currentVal = customColors[def.key] || def.default;
    const row = document.createElement('div');
    row.className = 'color-field-row';
    row.innerHTML = `
      <div class="color-field-label">${def.label}</div>
      <input type="color" class="color-field-input" data-ckey="${def.key}" value="${currentVal}">
      <input type="text" class="color-field-hex" data-hkey="${def.key}" value="${currentVal}" maxlength="7">`;
    container.appendChild(row);
  });

  container.querySelectorAll('.color-field-input').forEach(picker => {
    picker.addEventListener('input', function () {
      const hexEl = container.querySelector(`.color-field-hex[data-hkey="${this.dataset.ckey}"]`);
      if (hexEl) hexEl.value = this.value;
    });
  });
  container.querySelectorAll('.color-field-hex').forEach(hexEl => {
    hexEl.addEventListener('input', function () {
      const val = this.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        const picker = container.querySelector(`.color-field-input[data-ckey="${this.dataset.hkey}"]`);
        if (picker) picker.value = val;
      }
    });
  });
}
document.getElementById('color-apply-btn').addEventListener('click', function () {
  const container = document.getElementById('color-fields');
  colorDefs.forEach(def => {
    const hexEl = container.querySelector(`.color-field-hex[data-hkey="${def.key}"]`);
    if (hexEl) {
      const val = hexEl.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(val)) customColors[def.key] = val;
    }
  });
  sSave('customColors', customColors);
  applyColors(customColors);
});
document.getElementById('color-reset-btn').addEventListener('click', function () {
  customColors = {};
  sSave('customColors', {});
  colorDefs.forEach(def => {
    document.documentElement.style.setProperty(def.key, def.default);
  });
  renderColorFields();
});

/* ============================================================
   ③ 数据管理
   ============================================================ */
const ALL_DATA_KEYS = [
  'cdItems', 'carouselUrls', 'userAvatar', 'userSig',
  'msgData', 'textBars', 'apiArchives', 'apiActiveConfig',
  'apiCurrentModel', 'customIcons', 'customColors', 'wallpaper',
  'pinAvatar'
];
const THEME_DATA_KEYS = ['customIcons', 'customColors', 'wallpaper'];

function collectData(keys) {
  const result = {};
  keys.forEach(k => {
    const v = localStorage.getItem('halo9_' + k);
    if (v !== null) result[k] = JSON.parse(v);
  });
  return result;
}
function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function importJson(file, keys, callback) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      keys.forEach(k => {
        if (k in data) {
          localStorage.setItem('halo9_' + k, JSON.stringify(data[k]));
        }
      });
      callback && callback();
    } catch (err) {
      alert('导入失败：JSON 格式错误');
    }
  };
  reader.readAsText(file);
}

document.getElementById('export-all-btn')
  .addEventListener('click', () => downloadJson(collectData(ALL_DATA_KEYS), 'halo9_all_' + Date.now() + '.json'));

document.getElementById('import-all-btn')
  .addEventListener('click', () => document.getElementById('import-all-file').click());
document.getElementById('import-all-file')
  .addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    importJson(file, ALL_DATA_KEYS, () => {
      alert('全部数据导入成功，即将刷新页面');
      location.reload();
    });
    this.value = '';
  });

document.getElementById('export-theme-btn')
  .addEventListener('click', () => downloadJson(collectData(THEME_DATA_KEYS), 'halo9_theme_' + Date.now() + '.json'));

document.getElementById('import-theme-btn')
  .addEventListener('click', () => document.getElementById('import-theme-file').click());
document.getElementById('import-theme-file')
  .addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    importJson(file, THEME_DATA_KEYS, () => {
      const wp = sLoad('wallpaper', '');
      applyWallpaper(wp);
      customColors = sLoad('customColors', {});
      applyColors(customColors);
      customIcons = sLoad('customIcons', {});
      restoreAllIcons();
      alert('美化数据导入成功');
    });
    this.value = '';
  });

document.getElementById('clear-all-data-btn')
  .addEventListener('click', function () {
    if (!confirm('确定要清除全部本地数据吗？此操作不可恢复！')) return;
    ALL_DATA_KEYS.forEach(k => localStorage.removeItem('halo9_' + k));
    alert('已清除全部数据，即将刷新页面');
    location.reload();
  });

/* ============================================================
   ④ 隐私设置 — 锁屏头像
   ============================================================ */
const DEFAULT_PIN_AVATAR = 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=halo9';
let pinAvatarTab = 'url';

/* 初始化：恢复已保存的锁屏头像预览 */
(function restorePinAvatar() {
  const saved = sLoad('pinAvatar', null);
  const previewEl = document.getElementById('privacy-pin-avatar-preview');
  if (saved && previewEl) previewEl.src = saved;
})();

/* Tab 切换 */
document.querySelectorAll('[data-pin-avatar-tab]').forEach(btn => {
  btn.addEventListener('click', function () {
    setPinAvatarTab(this.dataset.pinAvatarTab);
  });
});

function setPinAvatarTab(tab) {
  pinAvatarTab = tab;
  document.querySelectorAll('[data-pin-avatar-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.pinAvatarTab === tab);
  });
  document.getElementById('pin-avatar-url-panel').style.display  = tab === 'url'   ? '' : 'none';
  document.getElementById('pin-avatar-local-panel').style.display = tab === 'local' ? '' : 'none';
}

/* URL 输入实时预览 */
document.getElementById('privacy-pin-avatar-url').addEventListener('input', function () {
  const url = this.value.trim();
  if (url) document.getElementById('privacy-pin-avatar-preview').src = url;
});

/* 本地上传实时预览 */
document.getElementById('privacy-pin-avatar-file').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('privacy-pin-avatar-preview').src = e.target.result;
  };
  reader.readAsDataURL(file);
});

/* 保存头像 */
document.getElementById('privacy-pin-avatar-save-btn').addEventListener('click', function () {
  const msgEl = document.getElementById('privacy-pin-avatar-msg');
  msgEl.style.color = '#e07a7a';

  function applyAndSavePinAvatar(src) {
    sSave('pinAvatar', src);
    /* 同步到密码输入界面的头像元素 */
    const pinAvatarEl = document.getElementById('pin-avatar-img');
    if (pinAvatarEl) pinAvatarEl.src = src;
    /* 更新预览 */
    document.getElementById('privacy-pin-avatar-preview').src = src;
    msgEl.style.color = '#5aaa7a';
    msgEl.textContent = '头像已保存';
    setTimeout(() => { msgEl.textContent = ''; }, 2000);
  }

  if (pinAvatarTab === 'url') {
    const url = document.getElementById('privacy-pin-avatar-url').value.trim();
    if (!url) { msgEl.textContent = '请输入图片 URL'; return; }
    applyAndSavePinAvatar(url);
  } else {
    const file = document.getElementById('privacy-pin-avatar-file').files[0];
    if (!file) { msgEl.textContent = '请选择一张图片'; return; }
    const reader = new FileReader();
    reader.onload = e => applyAndSavePinAvatar(e.target.result);
    reader.readAsDataURL(file);
  }
});

/* 恢复默认头像 */
document.getElementById('privacy-pin-avatar-reset-btn').addEventListener('click', function () {
  const msgEl = document.getElementById('privacy-pin-avatar-msg');
  sSave('pinAvatar', null);
  const pinAvatarEl = document.getElementById('pin-avatar-img');
  if (pinAvatarEl) pinAvatarEl.src = DEFAULT_PIN_AVATAR;
  document.getElementById('privacy-pin-avatar-preview').src = DEFAULT_PIN_AVATAR;
  document.getElementById('privacy-pin-avatar-url').value = '';
  msgEl.style.color = '#5aaa7a';
  msgEl.textContent = '已恢复默认头像';
  setTimeout(() => { msgEl.textContent = ''; }, 2000);
});

/* ============================================================
   ⑤ 隐私设置 — 主屏幕密码（原内联脚本逻辑，统一移至此处）
   ============================================================ */

/* 跳转到隐私设置页 */
const gotoPrivacyBtn = document.getElementById('goto-privacy');
if (gotoPrivacyBtn) {
  gotoPrivacyBtn.addEventListener('click', function () {
    /* 进入隐私设置时恢复头像预览 */
    const saved = sLoad('pinAvatar', null);
    const previewEl = document.getElementById('privacy-pin-avatar-preview');
    if (previewEl) previewEl.src = saved || DEFAULT_PIN_AVATAR;
    /* 重置 tab 状态 */
    setPinAvatarTab('url');
    document.getElementById('privacy-pin-avatar-url').value = '';
    showLayer('settings-privacy');
  });
}

/* 保存新密码 */
const pinSaveBtn = document.getElementById('privacy-pin-save-btn');
if (pinSaveBtn) {
  pinSaveBtn.addEventListener('click', function () {
    const msgEl   = document.getElementById('privacy-pin-msg');
    const oldVal  = document.getElementById('privacy-old-pin').value;
    const newVal  = document.getElementById('privacy-new-pin').value;
    const confVal = document.getElementById('privacy-confirm-pin').value;

    msgEl.style.color = '#e07a7a';

    if (!oldVal || !newVal || !confVal) {
      msgEl.textContent = '请填写全部字段'; return;
    }
    if (!/^\d{6}$/.test(newVal)) {
      msgEl.textContent = '新密码必须为6位数字'; return;
    }
    if (newVal !== confVal) {
      msgEl.textContent = '两次输入的新密码不一致'; return;
    }
    if (!window.LockScreen) {
      msgEl.textContent = '锁屏模块未加载'; return;
    }
    const ok = window.LockScreen.changePin(oldVal, newVal);
    if (!ok) {
      msgEl.textContent = '当前密码错误'; return;
    }
    msgEl.style.color = '#5aaa7a';
    msgEl.textContent = '密码已更新';
    document.getElementById('privacy-old-pin').value    = '';
    document.getElementById('privacy-new-pin').value    = '';
    document.getElementById('privacy-confirm-pin').value = '';
    setTimeout(() => { msgEl.textContent = ''; }, 2000);
  });
}

/* ============================================================
   弹窗遮罩关闭
   ============================================================ */
['wallpaper-url-modal', 'icon-replace-modal'].forEach(id => {
  const mask = document.getElementById(id);
  if (mask) {
    mask.addEventListener('click', function (e) {
      if (e.target === this) this.classList.remove('show');
    });
  }
});
