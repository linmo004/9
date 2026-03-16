/* ============================================================
   couple-core.js — 我们的小窝 数据层 / 入口 / Tab 切换
   ============================================================ */

/* ---- 数据存取 ---- */
function cpSave(key, val) {
  try { localStorage.setItem('couple_' + key, JSON.stringify(val)); } catch(e) {}
}
function cpLoad(key, def) {
  try {
    const v = localStorage.getItem('couple_' + key);
    return v !== null ? JSON.parse(v) : def;
  } catch(e) { return def; }
}

/* ---- 当前角色 ---- */
let cpCurrentRoleId = null;
let cpCurrentRole   = null;
let cpCurrentSpace  = null; // 当前角色的完整小窝数据

/* ---- 获取小窝数据（按角色ID隔离） ---- */
function cpGetSpace(roleId) {
  return cpLoad('space_' + roleId, {
    roleId,
    settings: {
      togetherDate:    '',
      blogInterval:    0,
      blogTimes:       [],
      whisperInterval: 0,
      whisperTimes:    [],
      diaryTimes:      [],
      fanAvatars:      []
    },
    home: {
      bannerUrl: '',
      quote:     ''
    },
    radio: {
      userStatus: '',
      userStatusTs: 0,
      roleStatus:  '',
      roleStatusTs: 0,
      timeline:    []
    },
    blog: {
      posts:   [],
      fanCount: 0
    },
    album: {
      photos: []
    },
    diary: {
      entries: []
    },
    anniversary: {
      items: []
    },
    whisper: {
      notes: []
    },
    pet: {
      type:      '',
      name:      '',
      mood:      80,
      food:      80,
      love:      80,
      actionPts: 10,
      lastReset: '',
      decors:    [],
      log:       [],
      visits:    [],
      speech:    '汪！'
    }
  });
}

function cpSaveSpace() {
  if (!cpCurrentRoleId || !cpCurrentSpace) return;
  cpSave('space_' + cpCurrentRoleId, cpCurrentSpace);
}

/* ---- 获取用户名和头像 ---- */
function cpGetUserName() {
  return lLoad('userName', '我');
}

function cpGetUserAvatar() {
  return lLoad('userAvatar',
    'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=user');
}

function cpGetRoleName(role) {
  if (!role) return '他/她';
  return role.nickname || role.realname || '对方';
}

function cpGetRoleAvatar(role) {
  if (!role) return defaultAvatar ? defaultAvatar() :
    'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=role';
  return role.avatar || (defaultAvatar ? defaultAvatar() :
    'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=role');
}

/* ---- 打开小窝 App ---- */
function openCoupleApp() {
  const app = document.getElementById('couple-app');
  if (!app) return;
  app.style.display = 'flex';
  cpRenderRoleSelect();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeCoupleApp() {
  const app = document.getElementById('couple-app');
  if (app) app.style.display = 'none';
  cpStopAllTimers();
}

/* ---- 渲染角色选择列表 ---- */
function cpRenderRoleSelect() {
  const list  = document.getElementById('couple-role-list');
  const empty = document.getElementById('couple-role-empty');
  if (!list) return;
  list.innerHTML = '';

  const roles = (typeof liaoRoles !== 'undefined') ? liaoRoles : [];

  if (!roles.length) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  roles.forEach(role => {
    const hasSpace = !!localStorage.getItem('couple_space_' + role.id);
    const name     = cpGetRoleName(role);
    const avatar   = cpGetRoleAvatar(role);

    const card = document.createElement('div');
    card.className = 'cp-role-card' + (hasSpace ? ' has-space' : '');
    card.innerHTML =
      '<img class="cp-role-card-avatar" src="' + escHtml(avatar) + '" alt="">' +
      '<div class="cp-role-card-info">' +
        '<div class="cp-role-card-name">' + escHtml(name) + '</div>' +
        '<div class="cp-role-card-sub">' +
          (hasSpace ? '已有小窝 · 点击进入' : '点击创建小窝') +
        '</div>' +
      '</div>' +
      '<div class="cp-role-card-arrow">›</div>';

    card.addEventListener('click', () => cpEnterSpace(role));
    list.appendChild(card);
  });
}

/* ---- 进入某角色的小窝 ---- */
function cpEnterSpace(role) {
  cpCurrentRoleId = role.id;
  cpCurrentRole   = role;
  cpCurrentSpace  = cpGetSpace(role.id);

  /* 更新顶部栏 */
  const titleEl = document.getElementById('couple-topbar-title');
  const subEl   = document.getElementById('couple-topbar-sub');
  const userName = cpGetUserName();
  const roleName = cpGetRoleName(role);
  if (titleEl) titleEl.textContent = userName + ' & ' + roleName + ' 的小窝';
  if (subEl) {
    const days = cpCalcTogetherDays();
    subEl.textContent = days > 0 ? '在一起第 ' + days + ' 天' : '你们的专属空间';
  }

  /* 切换界面 */
  document.getElementById('couple-role-select').style.display = 'none';
  document.getElementById('couple-main').style.display = 'flex';

  /* 初始化各模块 */
  cpSwitchTab('home');
  cpStartAllTimers();

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ---- 计算在一起天数 ---- */
function cpCalcTogetherDays() {
  const d = cpCurrentSpace && cpCurrentSpace.settings &&
            cpCurrentSpace.settings.togetherDate;
  if (!d) return 0;
  const start = new Date(d); start.setHours(0,0,0,0);
  const today = new Date();  today.setHours(0,0,0,0);
  const diff  = Math.round((today - start) / 86400000);
  return Math.max(0, diff);
}

/* ---- Tab 切换 ---- */
let cpCurrentTab = 'home';

function cpSwitchTab(tabId) {
  cpCurrentTab = tabId;

  document.querySelectorAll('.cp-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.couple-panel').forEach(panel => {
    panel.classList.remove('cp-active');
  });

  const panel = document.getElementById('couple-panel-' + tabId);
  if (panel) panel.classList.add('cp-active');

  /* 各模块渲染 */
  if (tabId === 'home'        && typeof cpRenderHome        === 'function') cpRenderHome();
  if (tabId === 'radio'       && typeof cpRenderRadio       === 'function') cpRenderRadio();
  if (tabId === 'blog'        && typeof cpRenderBlog        === 'function') cpRenderBlog();
  if (tabId === 'album'       && typeof cpRenderAlbum       === 'function') cpRenderAlbum();
  if (tabId === 'diary'       && typeof cpRenderDiary       === 'function') cpRenderDiary();
  if (tabId === 'anniversary' && typeof cpRenderAnniversary === 'function') cpRenderAnniversary();
  if (tabId === 'whisper'     && typeof cpRenderWhisper     === 'function') cpRenderWhisper();
  if (tabId === 'pet'         && typeof cpRenderPet         === 'function') cpRenderPet();

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ---- 设置面板 ---- */
function cpOpenSettings() {
  if (!cpCurrentSpace) return;
  const s = cpCurrentSpace.settings;

  const togetherEl = document.getElementById('cp-together-date');
  if (togetherEl) togetherEl.value = s.togetherDate || '';

  const blogIntEl = document.getElementById('cp-blog-interval');
  if (blogIntEl) blogIntEl.value = s.blogInterval || 0;

  const whisperIntEl = document.getElementById('cp-whisper-interval');
  if (whisperIntEl) whisperIntEl.value = s.whisperInterval || 0;

  cpRenderSettingTimeList('cp-blog-times-list',    s.blogTimes    || []);
  cpRenderSettingTimeList('cp-whisper-times-list', s.whisperTimes || []);
  cpRenderSettingTimeList('cp-diary-times-list',   s.diaryTimes   || []);
  cpRenderFanAvatarList(s.fanAvatars || []);

  const panel = document.getElementById('couple-settings-panel');
  if (panel) {
    panel.style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function cpCloseSettings() {
  const panel = document.getElementById('couple-settings-panel');
  if (panel) panel.style.display = 'none';
}

function cpRenderSettingTimeList(containerId, times) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  times.forEach(t => {
    const tag = document.createElement('span');
    tag.className   = 'cp-time-tag';
    tag.textContent = t + ' ×';
    tag.dataset.time = t;
    tag.addEventListener('click', () => {
      tag.remove();
    });
    el.appendChild(tag);
  });
}

function cpGetTimeListValues(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return [];
  return Array.from(el.querySelectorAll('[data-time]')).map(t => t.dataset.time);
}

function cpRenderFanAvatarList(avatars) {
  const el = document.getElementById('cp-fan-avatar-list');
  if (!el) return;
  el.innerHTML = '';
  avatars.forEach((url, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'cp-fan-avatar-item';
    wrap.innerHTML =
      '<img src="' + escHtml(url) + '" alt="">' +
      '<button class="cp-fan-avatar-del" data-idx="' + idx + '">×</button>';
    wrap.querySelector('.cp-fan-avatar-del').addEventListener('click', function() {
      const i = parseInt(this.dataset.idx);
      avatars.splice(i, 1);
      cpRenderFanAvatarList(avatars);
    });
    el.appendChild(wrap);
  });
}

/* ---- 定时器管理 ---- */
let cpTimers = [];

function cpStartAllTimers() {
  cpStopAllTimers();
  if (!cpCurrentSpace) return;
  const s = cpCurrentSpace.settings;

  /* 博客定时间隔 */
  if (s.blogInterval > 0) {
    const t = setInterval(() => {
      if (typeof cpAutoPost === 'function') cpAutoPost();
    }, s.blogInterval * 60 * 1000);
    cpTimers.push(t);
  }

  /* 悄悄话定时间隔 */
  if (s.whisperInterval > 0) {
    const t = setInterval(() => {
      if (typeof cpAutoWhisper === 'function') cpAutoWhisper();
    }, s.whisperInterval * 60 * 1000);
    cpTimers.push(t);
  }

  /* 固定时间点检查器（每30秒检查一次） */
  const firedToday = new Set();
  const timeChecker = setInterval(() => {
    const now = new Date();
    const hh  = String(now.getHours()).padStart(2, '0');
    const mm  = String(now.getMinutes()).padStart(2, '0');
    const key = hh + ':' + mm;

    if (key === '00:00') firedToday.clear();

    const allTimes = [
      ...((s.blogTimes    || []).map(t => ({ t, type: 'blog'    }))),
      ...((s.whisperTimes || []).map(t => ({ t, type: 'whisper' }))),
      ...((s.diaryTimes   || []).map(t => ({ t, type: 'diary'   })))
    ];

    allTimes.forEach(({ t, type }) => {
      const fireKey = type + '_' + t;
      if (t === key && !firedToday.has(fireKey)) {
        firedToday.add(fireKey);
        if (type === 'blog'    && typeof cpAutoPost    === 'function') cpAutoPost();
        if (type === 'whisper' && typeof cpAutoWhisper === 'function') cpAutoWhisper();
        if (type === 'diary'   && typeof cpAutoDiary   === 'function') cpAutoDiary();
      }
    });
  }, 30000);
  cpTimers.push(timeChecker);
}

function cpStopAllTimers() {
  cpTimers.forEach(t => clearInterval(t));
  cpTimers = [];
}

/* ---- 小窝动态注入到聊天 System Prompt ---- */
function cpGetSpaceInjection(roleId) {
  const space = cpLoad('space_' + roleId, null);
  if (!space) return '';

  const userName = cpGetUserName();
  const lines    = [];

  /* 宠物状态 */
  if (space.pet && space.pet.type && space.pet.name) {
    lines.push('· 你们共同养的' + space.pet.type + '「' + space.pet.name +
      '」心情值' + space.pet.mood + '，饱食度' + space.pet.food +
      '，亲密度' + space.pet.love);
  }

  /* 最新日记 */
  if (space.diary && space.diary.entries && space.diary.entries.length) {
    const last = space.diary.entries[space.diary.entries.length - 1];
    if (last && last.author === userName && last.text) {
      lines.push('· ' + userName + '最近在日记里写道：「' +
        last.text.slice(0, 40) + (last.text.length > 40 ? '…' : '') + '」');
    }
  }

  /* 最新博客 */
  if (space.blog && space.blog.posts && space.blog.posts.length) {
    const userPosts = space.blog.posts.filter(p => p.authorType === 'user');
    if (userPosts.length) {
      const last = userPosts[userPosts.length - 1];
      lines.push('· ' + userName + '最近在博客发了一篇帖子：「' +
        (last.content || '').slice(0, 30) + '」');
    }
  }

  /* 最新悄悄话 */
  if (space.whisper && space.whisper.notes && space.whisper.notes.length) {
    const userNotes = space.whisper.notes.filter(n => n.authorType === 'user' && !n.reply);
    if (userNotes.length) {
      lines.push('· ' + userName + '在悄悄话里留了一条消息（尚未调用回复）');
    }
  }

  /* 心情电台 */
  if (space.radio && space.radio.userStatus && space.radio.userStatusTs) {
    const diffMin = Math.round((Date.now() - space.radio.userStatusTs) / 60000);
    if (diffMin < 120) {
      lines.push('· ' + userName + '刚才的状态：' + space.radio.userStatus);
    }
  }

  /* 纪念日临近 */
  if (space.anniversary && space.anniversary.items) {
    space.anniversary.items.forEach(item => {
      const target = new Date(item.date); target.setHours(0,0,0,0);
      const today  = new Date();          today.setHours(0,0,0,0);
      const diff   = Math.round((target - today) / 86400000);
      if (diff >= 0 && diff <= 7) {
        lines.push('· 纪念日「' + item.title + '」还有 ' + diff + ' 天');
      }
    });
  }

  if (!lines.length) return '';

  return '\n\n【我们的小窝 · 近期动态】\n' + lines.join('\n');
}

/* ---- 事件绑定（全部合并到一个委托） ---- */
document.addEventListener('click', function(e) {

  /* 打开小窝 App */
  if (e.target.closest('.app-item[data-app="couple"]')) {
    openCoupleApp(); return;
  }

  /* 返回角色选择 */
  if (e.target.closest('#couple-back-btn')) {
    cpCurrentRoleId = null; cpCurrentRole = null; cpCurrentSpace = null;
    cpStopAllTimers();
    document.getElementById('couple-main').style.display        = 'none';
    document.getElementById('couple-role-select').style.display = 'flex';
    cpRenderRoleSelect(); return;
  }

  /* 关闭整个 App */
  if (e.target.closest('#couple-select-close')) { closeCoupleApp(); return; }

  /* 设置按钮 */
  if (e.target.closest('#couple-settings-btn'))  { cpOpenSettings(); return; }

  /* 设置返回 */
  if (e.target.closest('#couple-settings-back')) { cpCloseSettings(); return; }

  /* 保存设置 */
  if (e.target.closest('#cp-settings-save')) {
    if (!cpCurrentSpace) return;
    const s = cpCurrentSpace.settings;
    const togetherEl   = document.getElementById('cp-together-date');
    const blogIntEl    = document.getElementById('cp-blog-interval');
    const whisperIntEl = document.getElementById('cp-whisper-interval');
    if (togetherEl)   s.togetherDate    = togetherEl.value;
    if (blogIntEl)    s.blogInterval    = parseInt(blogIntEl.value)    || 0;
    if (whisperIntEl) s.whisperInterval = parseInt(whisperIntEl.value) || 0;
    s.blogTimes    = cpGetTimeListValues('cp-blog-times-list');
    s.whisperTimes = cpGetTimeListValues('cp-whisper-times-list');
    s.diaryTimes   = cpGetTimeListValues('cp-diary-times-list');
    const fanList = document.getElementById('cp-fan-avatar-list');
    if (fanList) s.fanAvatars = Array.from(fanList.querySelectorAll('img')).map(img => img.src);
    cpSaveSpace();
    cpCloseSettings();
    cpStopAllTimers();
    cpStartAllTimers();
    const subEl = document.getElementById('couple-topbar-sub');
    if (subEl) {
      const days = cpCalcTogetherDays();
      subEl.textContent = days > 0 ? '在一起第 ' + days + ' 天' : '你们的专属空间';
    }
    alert('设置已保存'); return;
  }

  /* 添加时间标签 */
  ['blog', 'whisper', 'diary'].forEach(type => {
    if (e.target.closest('#cp-' + type + '-time-add')) {
      const input = document.getElementById('cp-' + type + '-time-input');
      if (!input || !input.value) return;
      const existing = cpGetTimeListValues('cp-' + type + '-times-list');
      if (existing.includes(input.value)) { alert('该时间已添加'); return; }
      existing.push(input.value);
      existing.sort();
      cpRenderSettingTimeList('cp-' + type + '-times-list', existing);
      input.value = '';
    }
  });

  /* 添加粉丝头像 */
  if (e.target.closest('#cp-fan-avatar-add')) {
    const input = document.getElementById('cp-fan-avatar-input');
    if (!input || !input.value.trim()) return;
    if (!cpCurrentSpace) return;
    const s = cpCurrentSpace.settings;
    if (!s.fanAvatars) s.fanAvatars = [];
    s.fanAvatars.push(input.value.trim());
    cpRenderFanAvatarList(s.fanAvatars);
    input.value = ''; return;
  }

  /* Tab 切换 */
  const tabBtn = e.target.closest('.cp-tab-btn');
  if (tabBtn && tabBtn.dataset.tab) {
    cpSwitchTab(tabBtn.dataset.tab); return;
  }
});
