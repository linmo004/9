/* ============================================================
   settings.js — 设置 App 全部逻辑
   ============================================================ */

/* ---------- 工具 ---------- */
function sSave(key, val) {
  try { localStorage.setItem('halo9_' + key, JSON.stringify(val)); } catch (e) {}
}
function sLoad(key, def) {
  try {
    const v = localStorage.getItem('halo9_' + key);
    return v !== null ? JSON.parse(v) : def;
  } catch (e) { return def; }
}

/* ============================================================
   层级导航
   ============================================================ */
function showLayer(id) {
  document.querySelectorAll('.settings-layer').forEach(el => {
    el.style.display = 'none';
  });
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}
function hideAllSettings() {
  document.querySelectorAll('.settings-layer').forEach(el => {
    el.style.display = 'none';
  });
}

function bindSettingsEntry() {
  const dockSettings = document.getElementById('dock-settings');
  if (dockSettings) dockSettings.addEventListener('click', () => showLayer('settings-root'));
  document.querySelectorAll('[data-app="settings"]').forEach(el => {
    el.addEventListener('click', () => showLayer('settings-root'));
  });
}
bindSettingsEntry();

document.getElementById('settings-root-close').addEventListener('click', hideAllSettings);

document.querySelectorAll('.settings-back-btn[data-back]').forEach(btn => {
  btn.addEventListener('click', function () {
    showLayer(this.dataset.back);
  });
});

document.getElementById('goto-api').addEventListener('click', () => {
  renderApiArchiveList();
  showLayer('settings-api');
});

document.getElementById('goto-theme').addEventListener('click', () => {
  renderIconReplaceList();
  renderColorFields();
  renderAppNameFields();
  initWallpaper2Preview();
  showLayer('settings-theme');
});

document.getElementById('goto-data').addEventListener('click', () => showLayer('settings-data'));

document.getElementById('goto-devtools').addEventListener('click', () => {
  refreshAllKeysList();
  showLayer('settings-devtools');
});

/* ============================================================
   ① API 设置
   ============================================================ */
let apiArchives = sLoad('apiArchives', []);

function renderApiArchiveList() {
  const container = document.getElementById('api-archive-list');
  if (!container) return;
  if (!apiArchives.length) {
    container.innerHTML = '<div class="settings-desc" style="padding:4px 0;">暂无存档，保存后显示在这里</div>';
    return;
  }
  container.innerHTML = '';
  apiArchives.forEach((arc, idx) => {
    const row = document.createElement('div');
    row.className = 'api-archive-item';

    const info = document.createElement('div');
    info.className = 'api-archive-info';
    info.dataset.idx = idx;

    const nameDiv = document.createElement('div');
    nameDiv.className = 'api-archive-name';
    nameDiv.textContent = arc.name || '未命名';

    const urlDiv = document.createElement('div');
    urlDiv.className = 'api-archive-url';
    urlDiv.textContent = arc.url || '';

    info.appendChild(nameDiv);
    info.appendChild(urlDiv);

    const delBtn = document.createElement('button');
    delBtn.className = 'api-archive-del';
    delBtn.dataset.del = idx;
    delBtn.textContent = '删除';

    row.appendChild(info);
    row.appendChild(delBtn);
    container.appendChild(row);
  });

  container.querySelectorAll('.api-archive-info').forEach(info => {
    info.addEventListener('click', function () {
      const arc = apiArchives[parseInt(this.dataset.idx)];
      document.getElementById('api-config-name').value = arc.name || '';
      document.getElementById('api-url').value         = arc.url  || '';
      document.getElementById('api-key').value         = arc.key  || '';
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
  if (!el) return;
  el.textContent = msg;
  el.className = 'api-status-text' + (type ? ' ' + type : '');
}

function setApiModelVisible(show) {
  const label  = document.getElementById('api-model-label');
  const select = document.getElementById('api-model-select');
  const btn    = document.getElementById('api-model-confirm-btn');
  if (label)  label.style.display  = show ? '' : 'none';
  if (select) select.style.display = show ? '' : 'none';
  if (btn)    btn.style.display    = show ? '' : 'none';
}

document.getElementById('api-fetch-models-btn').addEventListener('click', async function () {
  const url = document.getElementById('api-url').value.trim();
  const key = document.getElementById('api-key').value.trim();
  if (!url) { setApiStatus('请先填写 API 地址', 'error'); return; }
  setApiStatus('正在请求模型列表…');
  this.disabled = true;
  try {
    const endpoint = url.replace(/\/$/, '') + '/models';
    const headers  = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = 'Bearer ' + key;
    const res = await fetch(endpoint, { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    let models = [];
    if (Array.isArray(json.data))        models = json.data.map(m => m.id || m.name).filter(Boolean);
    else if (Array.isArray(json.models)) models = json.models.map(m => m.name || m.id).filter(Boolean);
    else if (Array.isArray(json))        models = json.map(m => m.id || m.name).filter(Boolean);
    if (!models.length) throw new Error('未获取到模型列表');
    const sel = document.getElementById('api-model-select');
    sel.innerHTML = '';
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      sel.appendChild(opt);
    });
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
  const model = document.getElementById('api-model-select').value;
  sSave('apiCurrentModel', model);
  setApiStatus('已选择模型：' + model, 'success');
});

document.getElementById('api-save-btn').addEventListener('click', function () {
  const name = document.getElementById('api-config-name').value.trim() || '配置' + (apiArchives.length + 1);
  const url  = document.getElementById('api-url').value.trim();
  const key  = document.getElementById('api-key').value.trim();
  if (!url) { setApiStatus('API 地址不能为空', 'error'); return; }
  const existing = apiArchives.findIndex(a => a.name === name);
  if (existing >= 0) apiArchives[existing] = { name, url, key };
  else apiArchives.push({ name, url, key });
  sSave('apiArchives', apiArchives);
  sSave('apiActiveConfig', { name, url, key });
  renderApiArchiveList();
  setApiStatus('配置已保存', 'success');
});

(function restoreApiConfig() {
  const active = sLoad('apiActiveConfig', null);
  if (!active) return;
  const nameEl = document.getElementById('api-config-name');
  const urlEl  = document.getElementById('api-url');
  const keyEl  = document.getElementById('api-key');
  if (nameEl) nameEl.value = active.name || '';
  if (urlEl)  urlEl.value  = active.url  || '';
  if (keyEl)  keyEl.value  = active.key  || '';
})();

/* ============================================================
   ② 美化 / 主题
   ============================================================ */

/* ---- 暗色模式 ---- */
(function initDarkMode() {
  const DARK_KEY = 'halo9_darkMode';

  function applyDarkMode(enabled) {
    if (enabled) document.body.classList.add('dark-mode');
    else         document.body.classList.remove('dark-mode');
  }

  const saved   = localStorage.getItem(DARK_KEY);
  const enabled = saved === 'true';
  const toggle  = document.getElementById('dark-mode-toggle');
  if (toggle) toggle.checked = enabled;
  applyDarkMode(enabled);

  if (toggle) {
    toggle.addEventListener('change', function () {
      const isOn = this.checked;
      localStorage.setItem(DARK_KEY, isOn ? 'true' : 'false');
      applyDarkMode(isOn);
    });
  }
})();

/* ---- 主页壁纸 ---- */
let wallpaperSrc = sLoad('wallpaper', '');

function applyWallpaper(src) {
  wallpaperSrc = src;
  sSave('wallpaper', src);
  document.body.style.backgroundImage    = src ? 'url(' + src + ')' : '';
  document.body.style.backgroundSize     = src ? 'cover' : '';
  document.body.style.backgroundPosition = src ? 'center' : '';
  const preview = document.getElementById('wallpaper-preview');
  if (preview) {
    preview.style.backgroundImage = src ? 'url(' + src + ')' : '';
    preview.style.border          = src ? 'none' : '';
  }
  applyWallpaper2Fallback();
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

/* ---- 第二页独立壁纸 ---- */
let wallpaper2Src = sLoad('wallpaper2', '');

function applyWallpaper2(src) {
  wallpaper2Src = src;
  sSave('wallpaper2', src);
  setPage2Wallpaper(src || wallpaperSrc);
  const preview = document.getElementById('wallpaper2-preview');
  if (preview) {
    const ds = src || wallpaperSrc;
    preview.style.backgroundImage = ds ? 'url(' + ds + ')' : '';
    preview.style.border          = ds ? 'none' : '';
  }
}

function applyWallpaper2Fallback() {
  if (!wallpaper2Src) setPage2Wallpaper(wallpaperSrc);
}

function setPage2Wallpaper(src) {
  const page2 = document.getElementById('page2');
  if (!page2) return;
  page2.style.backgroundImage    = src ? 'url(' + src + ')' : '';
  page2.style.backgroundSize     = src ? 'cover' : '';
  page2.style.backgroundPosition = src ? 'center' : '';
}

function initWallpaper2Preview() {
  const preview = document.getElementById('wallpaper2-preview');
  if (!preview) return;
  const ds = wallpaper2Src || wallpaperSrc;
  preview.style.backgroundImage = ds ? 'url(' + ds + ')' : '';
  preview.style.border          = ds ? 'none' : '';
}

applyWallpaper2(wallpaper2Src);

document.getElementById('wallpaper2-url-btn').addEventListener('click', function () {
  document.getElementById('wallpaper2-url-input').value = wallpaper2Src || '';
  document.getElementById('wallpaper2-url-modal').classList.add('show');
});
document.getElementById('wallpaper2-url-confirm').addEventListener('click', function () {
  const url = document.getElementById('wallpaper2-url-input').value.trim();
  applyWallpaper2(url);
  document.getElementById('wallpaper2-url-modal').classList.remove('show');
});
document.getElementById('wallpaper2-url-cancel').addEventListener('click', function () {
  document.getElementById('wallpaper2-url-modal').classList.remove('show');
});
document.getElementById('wallpaper2-local-btn').addEventListener('click', function () {
  document.getElementById('wallpaper2-file-input').click();
});
document.getElementById('wallpaper2-file-input').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => applyWallpaper2(e.target.result);
  reader.readAsDataURL(file);
});
document.getElementById('wallpaper2-clear-btn').addEventListener('click', function () {
  applyWallpaper2('');
});

/* ---- App名称修改 ---- */
const appNameRegistry = [
  { key: 'app-name-dock-chat',     selector: '#dock-chat .app-name',            default: '了了'   },
  { key: 'app-name-dock-home',     selector: '#dock-home .app-name',            default: '家园'   },
  { key: 'app-name-dock-settings', selector: '#dock-settings .app-name',        default: '设置'   },
  { key: 'app-name-chat',          selector: '[data-app="chat"] .app-name',     default: '了了'   },
  { key: 'app-name-settings',      selector: '[data-app="settings"] .app-name', default: '设置'   },
  { key: 'app-name-music',         selector: '[data-app="0"] .app-name',        default: '音乐'   },
  { key: 'app-name-worldbook',     selector: '[data-app="worldbook"] .app-name',default: '世界书' },
  { key: 'app-name-calendar',      selector: '[data-app="2"] .app-name',        default: '日历'   },
  { key: 'app-name-gallery',       selector: '[data-app="3"] .app-name',        default: '相册'   },
];
let customAppNames = sLoad('customAppNames', {});

function applyAllAppNames() {
  appNameRegistry.forEach(reg => {
    const val = customAppNames[reg.key];
    if (val !== undefined) {
      document.querySelectorAll(reg.selector).forEach(el => { el.textContent = val; });
    }
  });
}
applyAllAppNames();

function renderAppNameFields() {
  const container = document.getElementById('app-name-fields');
  if (!container) return;
  container.innerHTML = '';
  appNameRegistry.forEach(reg => {
    const currentVal = customAppNames[reg.key] !== undefined ? customAppNames[reg.key] : reg.default;
    const iconEl     = document.querySelector(reg.selector.replace('.app-name', '.app-icon'));

    const row = document.createElement('div');
    row.className = 'app-name-row';

    const img = document.createElement('img');
    img.className = 'app-name-row-icon';
    img.alt = '';
    if (iconEl) img.src = iconEl.src;

    const label = document.createElement('span');
    label.className = 'app-name-row-label';
    label.textContent = reg.default;

    const input = document.createElement('input');
    input.className = 'app-name-row-input';
    input.dataset.key = reg.key;
    input.value = currentVal;
    input.placeholder = reg.default;

    row.appendChild(img);
    row.appendChild(label);
    row.appendChild(input);
    container.appendChild(row);
  });
}

document.getElementById('app-name-save-btn').addEventListener('click', function () {
  const container = document.getElementById('app-name-fields');
  if (!container) return;
  container.querySelectorAll('.app-name-row-input').forEach(input => {
    const val = input.value.trim();
    if (val) customAppNames[input.dataset.key] = val;
    else delete customAppNames[input.dataset.key];
  });
  sSave('customAppNames', customAppNames);
  applyAllAppNames();
  alert('App名称已保存');
});

document.getElementById('app-name-reset-btn').addEventListener('click', function () {
  customAppNames = {};
  sSave('customAppNames', {});
  appNameRegistry.forEach(reg => {
    document.querySelectorAll(reg.selector).forEach(el => { el.textContent = reg.default; });
  });
  renderAppNameFields();
  alert('已恢复默认名称');
});

/* ---- App 图标替换 ---- */
const iconRegistry = [
  { key: 'dock-chat',     label: 'Dock · 了了', selector: '#dock-chat .app-icon'           },
  { key: 'dock-home',     label: 'Dock · 家园', selector: '#dock-home .app-icon'           },
  { key: 'dock-settings', label: 'Dock · 设置', selector: '#dock-settings .app-icon'       },
  { key: 'app2-chat',     label: '了了 App',    selector: '[data-app="chat"] .app-icon'    },
  { key: 'app2-settings', label: '设置 App',    selector: '[data-app="settings"] .app-icon'},
  { key: 'app4-0',        label: '音乐',        selector: '[data-app="0"] .app-icon'       },
  { key: 'app4-wb',       label: '世界书',      selector: '[data-app="worldbook"] .app-icon'},
  { key: 'app4-2',        label: '日历',        selector: '[data-app="2"] .app-icon'       },
  { key: 'app4-3',        label: '相册',        selector: '[data-app="3"] .app-icon'       },
];
let customIcons = sLoad('customIcons', {});
let iconEditKey = '';
let iconTab = 'url';

function restoreAllIcons() {
  iconRegistry.forEach(reg => {
    if (customIcons[reg.key]) {
      document.querySelectorAll(reg.selector).forEach(el => { el.src = customIcons[reg.key]; });
    }
  });
}
restoreAllIcons();

function renderIconReplaceList() {
  const container = document.getElementById('icon-replace-list');
  if (!container) return;
  container.innerHTML = '';
  iconRegistry.forEach(reg => {
    const iconEl     = document.querySelector(reg.selector);
    const currentSrc = customIcons[reg.key] || (iconEl ? iconEl.src : '');

    const row = document.createElement('div');
    row.className = 'icon-replace-row';

    const img = document.createElement('img');
    img.className = 'icon-replace-preview';
    img.alt = '';
    img.src = currentSrc;

    const nameDiv = document.createElement('div');
    nameDiv.className = 'icon-replace-name';
    nameDiv.textContent = reg.label;

    const hintDiv = document.createElement('div');
    hintDiv.className = 'icon-replace-hint';
    hintDiv.textContent = '点击替换 ›';

    row.appendChild(img);
    row.appendChild(nameDiv);
    row.appendChild(hintDiv);
    row.addEventListener('click', () => openIconReplaceModal(reg.key, reg.label));
    container.appendChild(row);
  });
}

function openIconReplaceModal(key, label) {
  iconEditKey = key;
  iconTab = 'url';
  const titleEl = document.getElementById('icon-replace-modal-title');
  if (titleEl) titleEl.textContent = '替换：' + label;
  const urlInput  = document.getElementById('icon-url-input');
  const fileInput = document.getElementById('icon-file-input');
  if (urlInput)  urlInput.value  = '';
  if (fileInput) fileInput.value = '';
  setIconTab('url');
  document.getElementById('icon-replace-modal').classList.add('show');
}

document.querySelectorAll('[data-icon-tab]').forEach(btn => {
  btn.addEventListener('click', function () { setIconTab(this.dataset.iconTab); });
});

function setIconTab(tab) {
  iconTab = tab;
  document.querySelectorAll('[data-icon-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.iconTab === tab);
  });
  const urlPanel   = document.getElementById('icon-url-panel');
  const localPanel = document.getElementById('icon-local-panel');
  if (urlPanel)   urlPanel.style.display   = tab === 'url'   ? '' : 'none';
  if (localPanel) localPanel.style.display = tab === 'local' ? '' : 'none';
}

function applyIconSrc(key, src) {
  customIcons[key] = src;
  sSave('customIcons', customIcons);
  const reg = iconRegistry.find(r => r.key === key);
  if (reg) document.querySelectorAll(reg.selector).forEach(el => { el.src = src; });
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
  if (!container) return;
  container.innerHTML = '';
  colorDefs.forEach(def => {
    const currentVal = customColors[def.key] || def.default;

    const row = document.createElement('div');
    row.className = 'color-field-row';

    const labelDiv = document.createElement('div');
    labelDiv.className = 'color-field-label';
    labelDiv.textContent = def.label;

    const picker = document.createElement('input');
    picker.type = 'color';
    picker.className = 'color-field-input';
    picker.dataset.ckey = def.key;
    picker.value = /^#[0-9a-fA-F]{6}$/.test(currentVal) ? currentVal : def.default;

    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'color-field-hex';
    hexInput.dataset.hkey = def.key;
    hexInput.value = currentVal;
    hexInput.maxLength = 7;

    picker.addEventListener('input', function () {
      hexInput.value = this.value;
    });
    hexInput.addEventListener('input', function () {
      const val = this.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(val)) picker.value = val;
    });

    row.appendChild(labelDiv);
    row.appendChild(picker);
    row.appendChild(hexInput);
    container.appendChild(row);
  });
}

document.getElementById('color-apply-btn').addEventListener('click', function () {
  const container = document.getElementById('color-fields');
  if (!container) return;
  colorDefs.forEach(def => {
    const hexEl = container.querySelector('.color-field-hex[data-hkey="' + def.key + '"]');
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
  'cdItems','carouselUrls','userAvatar','userSig','msgData','textBars',
  'apiArchives','apiActiveConfig','apiCurrentModel','customIcons',
  'customColors','wallpaper','wallpaper2','customAppNames','pinAvatar',
  'p2UcBg','p2UcName','p2UcUid','p2UcFans','p2UcLikes',
  'p2AlbumBg','p2CdImg','page2Cards',
];
const THEME_DATA_KEYS = ['customIcons','customColors','wallpaper','wallpaper2','customAppNames'];

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
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function importJson(file, keys, callback) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      keys.forEach(k => {
        if (k in data) localStorage.setItem('halo9_' + k, JSON.stringify(data[k]));
      });
      callback && callback();
    } catch (err) { alert('导入失败：JSON 格式错误'); }
  };
  reader.readAsText(file);
}

/* 全局完整备份 */
document.getElementById('export-global-btn').addEventListener('click', function () {
  const allData = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    try { allData[key] = JSON.parse(localStorage.getItem(key)); }
    catch (e) { allData[key] = localStorage.getItem(key); }
  }
  const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'halo9_global_backup_' + Date.now() + '.json'; a.click();
  URL.revokeObjectURL(url);
  const msg = document.getElementById('global-backup-msg');
  if (msg) {
    msg.textContent = '导出成功，共 ' + localStorage.length + ' 个键';
    setTimeout(() => { msg.textContent = ''; }, 3000);
  }
});

document.getElementById('import-global-btn').addEventListener('click', function () {
  document.getElementById('import-global-file').click();
});
document.getElementById('import-global-file').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  if (!confirm('导入全局备份将覆盖当前所有数据，确定继续吗？')) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      Object.entries(data).forEach(([k, v]) => {
        try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (ex) {}
      });
      const msg = document.getElementById('global-backup-msg');
      if (msg) msg.textContent = '导入成功，即将刷新页面…';
      setTimeout(() => location.reload(), 1500);
    } catch (err) { alert('导入失败：JSON 格式错误'); }
  };
  reader.readAsText(file);
  this.value = '';
});

/* 主页数据 */
document.getElementById('export-all-btn').addEventListener('click', () =>
  downloadJson(collectData(ALL_DATA_KEYS), 'halo9_home_' + Date.now() + '.json'));
document.getElementById('import-all-btn').addEventListener('click', () =>
  document.getElementById('import-all-file').click());
document.getElementById('import-all-file').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  importJson(file, ALL_DATA_KEYS, () => {
    alert('主页数据导入成功，即将刷新页面');
    location.reload();
  });
  this.value = '';
});

/* 美化数据 */
document.getElementById('export-theme-btn').addEventListener('click', () =>
  downloadJson(collectData(THEME_DATA_KEYS), 'halo9_theme_' + Date.now() + '.json'));
document.getElementById('import-theme-btn').addEventListener('click', () =>
  document.getElementById('import-theme-file').click());
document.getElementById('import-theme-file').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  importJson(file, THEME_DATA_KEYS, () => {
    applyWallpaper(sLoad('wallpaper', ''));
    applyWallpaper2(sLoad('wallpaper2', ''));
    customColors   = sLoad('customColors', {});   applyColors(customColors);
    customIcons    = sLoad('customIcons', {});     restoreAllIcons();
    customAppNames = sLoad('customAppNames', {}); applyAllAppNames();
    alert('美化数据导入成功');
  });
  this.value = '';
});

/* 清除全部数据 */
document.getElementById('clear-all-data-btn').addEventListener('click', function () {
  if (!confirm('确定要清除全部本地数据吗？此操作不可恢复！')) return;
  localStorage.clear();
  alert('已清除全部数据，即将刷新页面');
  location.reload();
});

/* ============================================================
   ④ 隐私设置 — 锁屏头像
   ============================================================ */
const DEFAULT_PIN_AVATAR = 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=halo9';
let pinAvatarTab = 'url';

(function restorePinAvatar() {
  const saved     = sLoad('pinAvatar', null);
  const previewEl = document.getElementById('privacy-pin-avatar-preview');
  if (saved && previewEl) previewEl.src = saved;
})();

document.querySelectorAll('[data-pin-avatar-tab]').forEach(btn => {
  btn.addEventListener('click', function () { setPinAvatarTab(this.dataset.pinAvatarTab); });
});

function setPinAvatarTab(tab) {
  pinAvatarTab = tab;
  document.querySelectorAll('[data-pin-avatar-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.pinAvatarTab === tab);
  });
  const urlPanel   = document.getElementById('pin-avatar-url-panel');
  const localPanel = document.getElementById('pin-avatar-local-panel');
  if (urlPanel)   urlPanel.style.display   = tab === 'url'   ? '' : 'none';
  if (localPanel) localPanel.style.display = tab === 'local' ? '' : 'none';
}

document.getElementById('privacy-pin-avatar-url').addEventListener('input', function () {
  const url = this.value.trim();
  if (url) document.getElementById('privacy-pin-avatar-preview').src = url;
});

document.getElementById('privacy-pin-avatar-file').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { document.getElementById('privacy-pin-avatar-preview').src = e.target.result; };
  reader.readAsDataURL(file);
});

document.getElementById('privacy-pin-avatar-save-btn').addEventListener('click', function () {
  const msgEl = document.getElementById('privacy-pin-avatar-msg');
  msgEl.style.color = '#e07a7a';
  function applyAndSave(src) {
    sSave('pinAvatar', src);
    const pinAvatarEl = document.getElementById('pin-avatar-img');
    if (pinAvatarEl) pinAvatarEl.src = src;
    document.getElementById('privacy-pin-avatar-preview').src = src;
    msgEl.style.color = '#5aaa7a';
    msgEl.textContent = '头像已保存';
    setTimeout(() => { msgEl.textContent = ''; }, 2000);
  }
  if (pinAvatarTab === 'url') {
    const url = document.getElementById('privacy-pin-avatar-url').value.trim();
    if (!url) { msgEl.textContent = '请输入图片 URL'; return; }
    applyAndSave(url);
  } else {
    const file = document.getElementById('privacy-pin-avatar-file').files[0];
    if (!file) { msgEl.textContent = '请选择一张图片'; return; }
    const reader = new FileReader();
    reader.onload = e => applyAndSave(e.target.result);
    reader.readAsDataURL(file);
  }
});

document.getElementById('privacy-pin-avatar-reset-btn').addEventListener('click', function () {
  const msgEl = document.getElementById('privacy-pin-avatar-msg');
  sSave('pinAvatar', null);
  const pinAvatarEl = document.getElementById('pin-avatar-img');
  if (pinAvatarEl) pinAvatarEl.src = DEFAULT_PIN_AVATAR;
  document.getElementById('privacy-pin-avatar-preview').src = DEFAULT_PIN_AVATAR;
  document.getElementById('privacy-pin-avatar-url').value   = '';
  msgEl.style.color = '#5aaa7a';
  msgEl.textContent = '已恢复默认头像';
  setTimeout(() => { msgEl.textContent = ''; }, 2000);
});

/* ============================================================
   ⑤ 隐私设置 — 主屏幕密码
   ============================================================ */
const gotoPrivacyBtn = document.getElementById('goto-privacy');
if (gotoPrivacyBtn) {
  gotoPrivacyBtn.addEventListener('click', function () {
    const saved     = sLoad('pinAvatar', null);
    const previewEl = document.getElementById('privacy-pin-avatar-preview');
    if (previewEl) previewEl.src = saved || DEFAULT_PIN_AVATAR;
    setPinAvatarTab('url');
    const urlInput = document.getElementById('privacy-pin-avatar-url');
    if (urlInput) urlInput.value = '';
    showLayer('settings-privacy');
  });
}

const pinSaveBtn = document.getElementById('privacy-pin-save-btn');
if (pinSaveBtn) {
  pinSaveBtn.addEventListener('click', function () {
    const msgEl   = document.getElementById('privacy-pin-msg');
    const oldVal  = document.getElementById('privacy-old-pin').value;
    const newVal  = document.getElementById('privacy-new-pin').value;
    const confVal = document.getElementById('privacy-confirm-pin').value;
    msgEl.style.color = '#e07a7a';
    if (!oldVal || !newVal || !confVal) { msgEl.textContent = '请填写全部字段'; return; }
    if (!/^\d{6}$/.test(newVal))        { msgEl.textContent = '新密码必须为6位数字'; return; }
    if (newVal !== confVal)             { msgEl.textContent = '两次输入的新密码不一致'; return; }
    if (!window.LockScreen)             { msgEl.textContent = '锁屏模块未加载'; return; }
    const ok = window.LockScreen.changePin(oldVal, newVal);
    if (!ok) { msgEl.textContent = '当前密码错误'; return; }
    msgEl.style.color = '#5aaa7a';
    msgEl.textContent = '密码已更新';
    document.getElementById('privacy-old-pin').value     = '';
    document.getElementById('privacy-new-pin').value     = '';
    document.getElementById('privacy-confirm-pin').value = '';
    setTimeout(() => { msgEl.textContent = ''; }, 2000);
  });
}

/* ============================================================
   ⑥ 开发者工具
   ============================================================ */

/* ── AI 日志系统 ── */
let devLogEnabled = false;
let devLogEntries = [];

function devLogWrite(type, content) {
  if (!devLogEnabled) return;
  const now     = new Date();
  const timeStr = String(now.getHours()).padStart(2,'0') + ':' +
    String(now.getMinutes()).padStart(2,'0') + ':' +
    String(now.getSeconds()).padStart(2,'0') + '.' +
    String(now.getMilliseconds()).padStart(3,'0');

  devLogEntries.push({ type, content, time: timeStr });

  const win = document.getElementById('devtools-log-window');
  if (!win) return;

  const line = document.createElement('div');
  line.style.borderBottom  = '1px solid rgba(153,200,237,0.08)';
  line.style.paddingBottom = '4px';
  line.style.marginBottom  = '4px';

  const timeSpan = document.createElement('span');
  timeSpan.className   = 'devlog-entry-time';
  timeSpan.textContent = '[' + timeStr + '] ';

  const contentSpan = document.createElement('span');
  contentSpan.className = 'devlog-entry-' + type;
  const displayContent  = typeof content === 'string'
    ? content.slice(0, 1200) + (content.length > 1200 ? '…(已截断)' : '')
    : JSON.stringify(content).slice(0, 1200);
  contentSpan.textContent = displayContent;

  line.appendChild(timeSpan);
  line.appendChild(contentSpan);
  win.appendChild(line);
  win.scrollTop = win.scrollHeight;
}

window.halo9Log = devLogWrite;

/* 劫持 fetch 记录 AI API 请求响应 */
(function patchFetch() {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url      = typeof args[0] === 'string' ? args[0] : (args[0].url || '');
    const isAiCall = url.includes('/chat/completions') || url.includes('/completions');
    if (isAiCall && devLogEnabled) {
      try {
        const body = args[1] && args[1].body ? JSON.parse(args[1].body) : null;
        devLogWrite('request',
          '→ POST ' + url + '\n' +
          '  model: '    + (body && body.model    ? body.model    : '?') + '\n' +
          '  messages: ' + (body && body.messages ? body.messages.length : '?') + ' 条');
      } catch (e) {
        devLogWrite('request', '→ POST ' + url);
      }
    }
    let response;
    try {
      response = await originalFetch.apply(this, args);
    } catch (err) {
      if (isAiCall && devLogEnabled) devLogWrite('error', '✗ 网络错误: ' + err.message);
      throw err;
    }
    if (isAiCall && devLogEnabled) {
      response.clone().json().then(json => {
        const content = json.choices && json.choices[0] && json.choices[0].message
          ? json.choices[0].message.content
          : JSON.stringify(json).slice(0, 300);
        devLogWrite('response',
          '← ' + response.status + ' 回复: ' +
          (typeof content === 'string' ? content.slice(0, 500) : content));
      }).catch(() => {
        devLogWrite('response', '← ' + response.status + ' (无法解析响应体)');
      });
    }
    return response;
  };
})();

document.getElementById('devtools-log-toggle-btn').addEventListener('click', function () {
  devLogEnabled    = !devLogEnabled;
  this.textContent = devLogEnabled ? '关闭日志记录' : '开启日志记录';
  const statusEl   = document.getElementById('devtools-log-status');
  if (statusEl) {
    statusEl.textContent = '日志记录：' + (devLogEnabled ? '开启（API请求将被记录）' : '关闭');
    statusEl.style.color = devLogEnabled ? '#4caf84' : 'var(--text-light)';
  }
  if (devLogEnabled) devLogWrite('info', '✓ 日志记录已开启，将捕获所有 AI API 请求');
});

document.getElementById('devtools-log-clear-btn').addEventListener('click', function () {
  devLogEntries = [];
  const win = document.getElementById('devtools-log-window');
  if (win) win.innerHTML = '';
});

document.getElementById('devtools-log-export-btn').addEventListener('click', function () {
  if (!devLogEntries.length) { alert('暂无日志内容'); return; }
  const lines = devLogEntries.map(e => '[' + e.time + '][' + e.type + '] ' + e.content);
  const blob  = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href = url; a.download = 'halo9_log_' + Date.now() + '.txt'; a.click();
  URL.revokeObjectURL(url);
});

/* ── 存储键查看 ── */
function devtoolsViewKey(keyName) {
  const metaEl    = document.getElementById('devtools-result-meta');
  const contentEl = document.getElementById('devtools-result-content');
  if (!metaEl || !contentEl) return;

  if (keyName === '__all__') {
    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) allKeys.push(localStorage.key(i));
    metaEl.textContent    = '共 ' + allKeys.length + ' 个键';
    metaEl.style.color    = 'var(--text-mid)';
    contentEl.textContent = allKeys.sort().join('\n');
    return;
  }
  if (!keyName) { contentEl.textContent = '请先选择或输入键名'; return; }

  const raw = localStorage.getItem(keyName);
  if (raw === null) {
    metaEl.style.color    = '#e05c5c';
    metaEl.textContent    = '键名「' + keyName + '」不存在';
    contentEl.textContent = '（该键在 localStorage 中不存在）';
    return;
  }
  metaEl.style.color = '#4caf84';
  try {
    const parsed   = JSON.parse(raw);
    const isArray  = Array.isArray(parsed);
    const typeDesc = isArray
      ? '数组，共 ' + parsed.length + ' 条'
      : (typeof parsed === 'object' ? '对象' : typeof parsed);
    metaEl.textContent = '键：' + keyName + ' | 类型：' + typeDesc + ' | 大小：' + raw.length + ' 字节';
    if (isArray && parsed.length > 0) {
      const summary = parsed.map((item, idx) => {
        if (typeof item === 'object' && item !== null) {
          const name = item.nickname || item.realname || item.name || item.id || item.title || item.content || '';
          const keys = Object.keys(item).slice(0, 5).join(', ');
          return '[' + idx + '] ' + (name ? '「' + String(name).slice(0, 30) + '」 ' : '') + '{' + keys + '}';
        }
        return '[' + idx + '] ' + String(item).slice(0, 50);
      }).join('\n');
      contentEl.textContent = '── 摘要 ──\n' + summary +
        '\n\n── 完整数据（前3条）──\n' + JSON.stringify(parsed.slice(0, 3), null, 2);
    } else {
      contentEl.textContent = JSON.stringify(parsed, null, 2).slice(0, 3000);
    }
  } catch (e) {
    metaEl.style.color    = '#e05c5c';
    metaEl.textContent    = '键：' + keyName + ' | JSON解析失败 | 大小：' + raw.length + ' 字节';
    contentEl.textContent = raw.slice(0, 500);
  }
}

document.getElementById('devtools-view-btn').addEventListener('click', function () {
  const sel = document.getElementById('devtools-key-select');
  if (sel) devtoolsViewKey(sel.value);
});

function refreshAllKeysList() {
  const container = document.getElementById('devtools-all-keys');
  if (!container) return;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
  keys.sort();
  if (!keys.length) { container.textContent = '（localStorage 为空）'; return; }
  container.innerHTML = '';
  keys.forEach(k => {
    const size = (localStorage.getItem(k) || '').length;
    const span = document.createElement('span');
    span.style.cssText = 'display:block;padding:2px 0;border-bottom:1px solid rgba(153,200,237,0.1);';
    const bold = document.createElement('b');
    bold.textContent = k;
    const sizeSpan = document.createElement('span');
    sizeSpan.style.cssText = 'color:#9aafc4;margin-left:8px;';
    sizeSpan.textContent = size + ' 字节';
    span.appendChild(bold);
    span.appendChild(sizeSpan);
    container.appendChild(span);
  });
}

document.getElementById('devtools-list-all-btn').addEventListener('click', refreshAllKeysList);
document.getElementById('devtools-refresh-keys-btn').addEventListener('click', refreshAllKeysList);

/* ── 快速修复：角色库键名同步 ── */
document.getElementById('devtools-fix-roles-btn').addEventListener('click', function () {
  const msgEl         = document.getElementById('devtools-fix-msg');
  const candidateKeys = ['liao_roles', 'halo9_roles', 'roles'];
  let found = null, foundKey = '';
  for (let i = 0; i < candidateKeys.length; i++) {
    try {
      const raw = localStorage.getItem(candidateKeys[i]);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) { found = parsed; foundKey = candidateKeys[i]; break; }
    } catch (e) {}
  }
  if (!found) {
    msgEl.style.color = '#e05c5c';
    msgEl.textContent = '未找到任何角色数据，请先在了了中创建角色。';
    return;
  }
  try {
    const jsonStr = JSON.stringify(found);
    localStorage.setItem('liao_roles',  jsonStr);
    localStorage.setItem('halo9_roles', jsonStr);
    msgEl.style.color = '#4caf84';
    msgEl.textContent = '修复成功！从「' + foundKey + '」读取了 ' + found.length + ' 个角色，已同步写入 liao_roles 和 halo9_roles。';
  } catch (e) {
    msgEl.style.color = '#e05c5c';
    msgEl.textContent = '写入失败：' + e.message;
  }
  setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 5000);
});

/* ── 自定义键查询 ── */
document.getElementById('devtools-custom-view-btn').addEventListener('click', function () {
  const keyEl = document.getElementById('devtools-custom-key');
  const key   = keyEl ? keyEl.value.trim() : '';
  if (!key) { alert('请输入键名'); return; }
  devtoolsViewKey(key);
});

document.getElementById('devtools-custom-delete-btn').addEventListener('click', function () {
  const keyEl = document.getElementById('devtools-custom-key');
  const key   = keyEl ? keyEl.value.trim() : '';
  if (!key) { alert('请输入键名'); return; }
  if (!confirm('确定要删除键「' + key + '」吗？此操作不可恢复。')) return;
  localStorage.removeItem(key);
  alert('已删除键：' + key);
  refreshAllKeysList();
});

/* ── 强制刷新 ── */
document.getElementById('devtools-hard-refresh-btn').addEventListener('click', function () {
  const msgEl = document.getElementById('devtools-refresh-msg');
  if (msgEl) { msgEl.style.color = '#4caf84'; msgEl.textContent = '正在清除缓存并强制刷新…'; }
  if (typeof caches !== 'undefined') {
    caches.keys().then(function (keyList) {
      return Promise.all(keyList.map(function (key) { return caches.delete(key); }));
    }).then(function () {
      location.reload(true);
    }).catch(function () {
      location.reload(true);
    });
  } else {
    location.reload(true);
  }
});

document.getElementById('devtools-sw-clear-btn').addEventListener('click', function () {
  const msgEl = document.getElementById('devtools-refresh-msg');
  if (!('serviceWorker' in navigator)) {
    if (msgEl) { msgEl.style.color = '#e05c5c'; msgEl.textContent = '当前浏览器不支持 ServiceWorker'; }
    return;
  }
  navigator.serviceWorker.getRegistrations().then(function (registrations) {
    if (!registrations.length) {
      if (msgEl) { msgEl.style.color = '#f0c060'; msgEl.textContent = '没有发现已注册的 ServiceWorker'; }
      return;
    }
    return Promise.all(registrations.map(function (reg) { return reg.unregister(); }))
      .then(function () {
        if (typeof caches !== 'undefined') {
          return caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (k) { return caches.delete(k); }));
          });
        }
      }).then(function () {
        if (msgEl) {
          msgEl.style.color = '#4caf84';
          msgEl.textContent = '已清除 ' + registrations.length + ' 个 ServiceWorker 及全部缓存，即将刷新…';
        }
        setTimeout(function () { location.reload(true); }, 1200);
      });
  }).catch(function (e) {
    if (msgEl) { msgEl.style.color = '#e05c5c'; msgEl.textContent = '清除失败：' + e.message; }
  });
});

/* ============================================================
   弹窗遮罩关闭
   ============================================================ */
['wallpaper-url-modal', 'wallpaper2-url-modal', 'icon-replace-modal'].forEach(id => {
  const mask = document.getElementById(id);
  if (mask) {
    mask.addEventListener('click', function (e) {
      if (e.target === this) this.classList.remove('show');
    });
  }
});
