/* ============================================================
   garden.js — 家园App逻辑
   数据存储键：halo9_garden
   ============================================================ */

(function () {
  'use strict';

  /* ── 常量 ── */
  const STORAGE_KEY = 'halo9_garden';

  /* 家园等级配置 */
  const LEVELS = [
    {
      level: 1,
      name: '温馨小屋',
      activitiesNeeded: 5,
      rooms: ['living', 'kitchen', 'bedroom'],
      gridTemplate: '"living living" "kitchen bedroom"',
      gridCols: '1fr 1fr',
    },
    {
      level: 2,
      name: '舒适公寓',
      activitiesNeeded: 15,
      rooms: ['living', 'kitchen', 'bedroom', 'study'],
      gridTemplate: '"living living" "kitchen bedroom" "study study"',
      gridCols: '1fr 1fr',
    },
    {
      level: 3,
      name: '温馨别墅',
      activitiesNeeded: 35,
      rooms: ['living', 'kitchen', 'bedroom', 'study', 'garden', 'attic'],
      gridTemplate: '"living living living" "kitchen bedroom study" "garden garden attic"',
      gridCols: '1fr 1fr 1fr',
    },
  ];

  /* 房间配置 */
  const ROOM_CONFIG = {
    living:  { label: '客厅',   emoji: '🛋️',  furniture: ['🛋️','📺','🪴','☕'] },
    kitchen: { label: '厨房',   emoji: '🍳',  furniture: ['🍳','🥘','🫖','🍽️'] },
    bedroom: { label: '卧室',   emoji: '🛏️',  furniture: ['🛏️','🪞','📚','🌙'] },
    study:   { label: '书房',   emoji: '📖',  furniture: ['📖','🖥️','🖊️','🕯️'] },
    garden:  { label: '花园',   emoji: '🌸',  furniture: ['🌸','🌳','🦋','🌻'] },
    attic:   { label: '阁楼',   emoji: '🔭',  furniture: ['🔭','🎨','🧸','🎀'] },
  };

  /* 各房间状态文字池 */
  const ROOM_STATES = {
    living:  ['在客厅看书', '在客厅喝茶', '在客厅看电视', '在客厅发呆', '在客厅听音乐'],
    kitchen: ['在厨房做饭', '在厨房泡茶', '在厨房洗碗', '在厨房烤点心', '在厨房研究食谱'],
    bedroom: ['在卧室休息', '在卧室睡觉', '在卧室看手机', '在卧室整理床铺', '在卧室做梦'],
    study:   ['在书房写作', '在书房看书', '在书房上网', '在书房画画', '在书房思考'],
    garden:  ['在花园赏花', '在花园散步', '在花园浇水', '在花园晒太阳', '在花园捉蝴蝶'],
    attic:   ['在阁楼探索', '在阁楼看星星', '在阁楼画画', '在阁楼整理旧物', '在阁楼发呆'],
  };

  /* 每日活动事件池 */
  const ACTIVITY_POOL = [
    { icon: '🎂', name: '生日派对',    desc: '今天是一个特别的日子，一起来庆祝吧！',   narrative: '大家围坐在一起，蜡烛的光映照出温暖的笑脸。这一刻，家园充满了欢声笑语。' },
    { icon: '🍕', name: '共同做饭',    desc: '一起在厨房捣鼓一顿美味大餐！',           narrative: '厨房里飘出阵阵香气，大家分工合作，笑闹着完成了一顿丰盛的料理。' },
    { icon: '🎮', name: '游戏之夜',    desc: '客厅里摆出了游戏，谁来一决高下？',       narrative: '夜幕降临，游戏机的光芒照亮了每张专注的脸，欢呼声此起彼伏。' },
    { icon: '🌟', name: '发现新房间',  desc: '咦，墙角好像有扇新的门……',               narrative: '推开那扇略显陈旧的门，一个崭新的空间出现了，阳光从未知的窗户洒落进来。' },
    { icon: '🌱', name: '种一棵植物',  desc: '在花园里种下一颗种子，期待它发芽。',     narrative: '小小的种子埋进土里，大家轮流浇水，相信它终有一天会长成参天大树。' },
    { icon: '📸', name: '家庭合影',    desc: '难得聚在一起，来一张集体照吧！',         narrative: '大家挤在一起，比着各种手势，咔嚓一声，这个瞬间永远留存了下来。' },
    { icon: '🎵', name: '音乐下午茶',  desc: '午后阳光正好，来一场小小的音乐会。',     narrative: '旋律在房间里流淌，茶香与歌声交织，整个下午变得格外悠长而美好。' },
    { icon: '🧹', name: '大扫除',      desc: '一起把家园打扫得干干净净！',             narrative: '你擦这边，我扫那边，汗水换来了一个焕然一新的家园，心情也随之明亮。' },
    { icon: '🌙', name: '深夜聊天',    desc: '夜深了，大家还舍不得睡，聊到凌晨。',     narrative: '星光透过窗户洒落，悄悄话一句接一句，这样的夜晚总是过得太快。' },
    { icon: '🎁', name: '神秘礼物',    desc: '桌上出现了一个包裹严实的礼物盒……',       narrative: '拆开层层包装，里面是一份精心准备的惊喜，让收礼的人喜出望外。' },
  ];

  /* ── 数据读写 ── */
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function initData() {
    const existing = loadData();
    if (existing) return existing;
    const data = {
      level: 1,
      completedActivities: 0,
      dailyActivities: [],
      dailyDate: '',
      charStates: {},   /* roleId => { roomId, statusText } */
      userState: { roomId: 'living', statusText: '在客厅休息' },
      gardenChatHistory: {},  /* roleId => [{role, content, scene}] */
    };
    saveData(data);
    return data;
  }

  /* ── 工具函数 ── */
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getLevelConfig(level) {
    return LEVELS[Math.min(level - 1, LEVELS.length - 1)];
  }

  /* ── 获取了了角色列表 ── */
  function getLiaoRoles() {
    try {
      const raw = localStorage.getItem('halo9_roles');
      if (!raw) return [];
      const roles = JSON.parse(raw);
      return Array.isArray(roles) ? roles : [];
    } catch (e) { return []; }
  }

  /* 获取角色头像 */
  function getRoleAvatar(role) {
    return role.avatar ||
      'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=' + encodeURIComponent(role.name || 'char');
  }

  /* 获取用户头像 */
  function getUserAvatar() {
    try {
      const av = localStorage.getItem('halo9_userAvatar');
      return av ? JSON.parse(av) : 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=halo9';
    } catch (e) {
      return 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=halo9';
    }
  }

  /* ── 每日活动初始化 ── */
  function ensureDailyActivities(data) {
    const today = todayStr();
    if (data.dailyDate === today && data.dailyActivities.length > 0) return;
    /* 随机抽取3~4个活动 */
    const count = 3 + Math.floor(Math.random() * 2);
    const pool  = ACTIVITY_POOL.slice();
    const chosen = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      chosen.push({ ...pool[idx], done: false, id: pool[idx].name + '_' + today });
      pool.splice(idx, 1);
    }
    data.dailyActivities = chosen;
    data.dailyDate = today;
    saveData(data);
  }

  /* ── 角色状态分配 ── */
  function ensureCharStates(data, roles, levelConfig) {
    const availRooms = levelConfig.rooms;
    let changed = false;
    roles.forEach(function (role) {
      const id = role.id || role.name;
      if (!data.charStates[id]) {
        const roomId = pickRandom(availRooms);
        const statePool = ROOM_STATES[roomId] || ['在家园里'];
        data.charStates[id] = {
          roomId: roomId,
          statusText: pickRandom(statePool),
        };
        changed = true;
      }
    });
    /* 用户状态 */
    if (!data.userState || !availRooms.includes(data.userState.roomId)) {
      data.userState = { roomId: 'living', statusText: '在客厅休息' };
      changed = true;
    }
    if (changed) saveData(data);
  }

  /* 随机刷新所有角色状态（每次打开家园时调用） */
  function refreshCharStates(data, roles, levelConfig) {
    const availRooms = levelConfig.rooms;
    roles.forEach(function (role) {
      const id = role.id || role.name;
      const roomId = pickRandom(availRooms);
      const statePool = ROOM_STATES[roomId] || ['在家园里'];
      data.charStates[id] = {
        roomId: roomId,
        statusText: pickRandom(statePool),
      };
    });
    /* 用户也随机一次 */
    const userRoom = pickRandom(availRooms);
    data.userState = {
      roomId: userRoom,
      statusText: pickRandom(ROOM_STATES[userRoom] || ['在家园里']),
    };
    saveData(data);
  }

  /* ── 渲染地图 ── */
  function renderMap(data, roles, levelConfig) {
    const mapEl = document.getElementById('garden-map');
    if (!mapEl) return;

    mapEl.style.gridTemplateAreas   = levelConfig.gridTemplate;
    mapEl.style.gridTemplateColumns = levelConfig.gridCols;

    mapEl.innerHTML = '';

    /* 所有可能的房间 */
    const allRooms = ['living','kitchen','bedroom','study','garden','attic'];

    allRooms.forEach(function (roomId) {
      const cfg     = ROOM_CONFIG[roomId];
      const unlocked = levelConfig.rooms.includes(roomId);

      const roomEl = document.createElement('div');
      roomEl.className = 'garden-room' + (unlocked ? '' : ' locked');
      roomEl.style.gridArea = roomId;
      if (!unlocked) return; /* 锁定房间不渲染，直接跳过（只渲染解锁的） */

      /* 房间标签 */
      const labelEl = document.createElement('div');
      labelEl.className = 'garden-room-label';
      labelEl.innerHTML = '<span class="room-emoji">' + cfg.emoji + '</span>' + cfg.label;
      roomEl.appendChild(labelEl);

      /* 家具 */
      const furnitureRow = document.createElement('div');
      furnitureRow.className = 'garden-furniture-row';
      cfg.furniture.forEach(function (f) {
        const span = document.createElement('span');
        span.className = 'garden-furniture';
        span.textContent = f;
        furnitureRow.appendChild(span);
      });
      roomEl.appendChild(furnitureRow);

      /* 该房间的角色Pin */
      const pinsWrap = document.createElement('div');
      pinsWrap.style.display = 'flex';
      pinsWrap.style.flexWrap = 'wrap';
      pinsWrap.style.gap = '4px';
      pinsWrap.style.marginTop = '4px';

            /* 用户自己 */
      if (data.userState && data.userState.roomId === roomId) {
        const userPin = document.createElement('div');
        userPin.className = 'garden-char-pin garden-user-pin';
        userPin.innerHTML =
          '<img src="' + getUserAvatar() + '" alt="">' +
          '<div class="garden-char-pin-info">' +
            '<div class="garden-char-pin-name">我</div>' +
            '<div class="garden-char-pin-status">' + (data.userState.statusText || '') + '</div>' +
          '</div>';
        pinsWrap.appendChild(userPin);
      }

      /* 各角色 */
      roles.forEach(function (role) {
        const id = role.id || role.name;
        const state = data.charStates[id];
        if (!state || state.roomId !== roomId) return;
        const pin = document.createElement('div');
        pin.className = 'garden-char-pin';
        pin.dataset.roleId = id;
        pin.innerHTML =
          '<img src="' + getRoleAvatar(role) + '" alt="">' +
          '<div class="garden-char-pin-info">' +
            '<div class="garden-char-pin-name">' + (role.name || '角色') + '</div>' +
            '<div class="garden-char-pin-status">' + (state.statusText || '') + '</div>' +
          '</div>';
        pin.addEventListener('click', function () {
          openGardenChat(role, state, data);
        });
        pinsWrap.appendChild(pin);
      });

      roomEl.appendChild(pinsWrap);
      mapEl.appendChild(roomEl);
    });
  }

  /* ── 渲染底部状态栏 ── */
  function renderStatusBar(data, roles) {
    const bar = document.getElementById('garden-status-bar');
    if (!bar) return;
    bar.innerHTML = '';

    /* 用户自己 */
    const userChip = document.createElement('div');
    userChip.className = 'garden-status-chip';
    const userRoom = data.userState ? data.userState.roomId : 'living';
    const userRoomLabel = ROOM_CONFIG[userRoom] ? ROOM_CONFIG[userRoom].label : '';
    userChip.innerHTML =
      '<img src="' + getUserAvatar() + '" alt="">' +
      '<div class="garden-status-chip-info">' +
        '<div class="garden-status-chip-name">我</div>' +
        '<div class="garden-status-chip-status">' + (data.userState ? data.userState.statusText : '') + '</div>' +
      '</div>';
    bar.appendChild(userChip);

    /* 各角色 */
    roles.forEach(function (role) {
      const id    = role.id || role.name;
      const state = data.charStates[id];
      if (!state) return;
      const chip = document.createElement('div');
      chip.className = 'garden-status-chip';
      chip.dataset.roleId = id;
      chip.innerHTML =
        '<img src="' + getRoleAvatar(role) + '" alt="">' +
        '<div class="garden-status-chip-info">' +
          '<div class="garden-status-chip-name">' + (role.name || '角色') + '</div>' +
          '<div class="garden-status-chip-status">' + (state.statusText || '') + '</div>' +
        '</div>';
      chip.addEventListener('click', function () {
        openGardenChat(role, state, data);
      });
      bar.appendChild(chip);
    });
  }

  /* ── 渲染经验进度条 ── */
  function renderExpBar(data) {
    const levelCfg  = getLevelConfig(data.level);
    const nextLevel = getLevelConfig(data.level + 1);
    const fill      = document.getElementById('garden-exp-bar-fill');
    const text      = document.getElementById('garden-exp-text');
    const badge     = document.getElementById('garden-level-badge');
    const nameEl    = document.getElementById('garden-level-name');

    if (nameEl)  nameEl.textContent  = levelCfg.name;
    if (badge)   badge.textContent   = 'Lv.' + data.level;

    const needed  = levelCfg.activitiesNeeded;
    const prev    = data.level > 1 ? getLevelConfig(data.level - 1).activitiesNeeded : 0;
    const current = Math.max(0, data.completedActivities - prev);
    const total   = needed - prev;
    const pct     = Math.min(100, Math.round((current / total) * 100));

    if (fill) fill.style.width = pct + '%';
    if (text) {
      if (data.level >= LEVELS.length) {
        text.textContent = '已达最高等级';
      } else {
        text.textContent = current + ' / ' + total + ' 活动';
      }
    }
  }

  /* ── 渲染活动列表 ── */
  function renderActivityList(data) {
    const listEl = document.getElementById('garden-activity-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const dot = document.getElementById('garden-activity-dot');
    const hasNew = data.dailyActivities.some(function (a) { return !a.done; });
    if (dot) dot.classList.toggle('has-new', hasNew);

    if (!data.dailyActivities.length) {
      listEl.innerHTML = '<div style="color:#aaa;font-size:13px;text-align:center;padding:24px 0;">今天还没有活动</div>';
      return;
    }

    data.dailyActivities.forEach(function (activity, idx) {
      const item = document.createElement('div');
      item.className = 'garden-activity-item' + (activity.done ? ' done' : '');

      const btn = '<button class="garden-activity-join-btn"' +
        (activity.done ? ' disabled' : '') + '>' +
        (activity.done ? '已完成' : '参与') + '</button>';

      item.innerHTML =
        '<div class="garden-activity-icon">' + activity.icon + '</div>' +
        '<div class="garden-activity-info">' +
          '<div class="garden-activity-name">' + activity.name + '</div>' +
          '<div class="garden-activity-desc">' + activity.desc + '</div>' +
        '</div>' + btn;

      if (!activity.done) {
        item.querySelector('.garden-activity-join-btn').addEventListener('click', function () {
          triggerActivity(data, activity, idx);
        });
      }

      listEl.appendChild(item);
    });
  }

  /* ── 触发活动 ── */
  function triggerActivity(data, activity, idx) {
    /* 关闭活动面板 */
    const panel = document.getElementById('garden-activity-panel');
    if (panel) panel.style.display = 'none';

    /* 标记完成 */
    data.dailyActivities[idx].done = true;
    data.completedActivities = (data.completedActivities || 0) + 1;
    saveData(data);

    /* 检查升级 */
    checkLevelUp(data, function () {
      /* 显示叙事弹窗 */
      showNarrate(activity.icon, activity.name, activity.narrative);
      /* 刷新经验条 */
      renderExpBar(data);
      /* 刷新红点 */
      const dot = document.getElementById('garden-activity-dot');
      const hasNew = data.dailyActivities.some(function (a) { return !a.done; });
      if (dot) dot.classList.toggle('has-new', hasNew);
    });
  }

  /* ── 检查升级 ── */
  function checkLevelUp(data, callback) {
    if (data.level >= LEVELS.length) {
      if (callback) callback();
      return;
    }
    const cfg = getLevelConfig(data.level);
    if (data.completedActivities >= cfg.activitiesNeeded) {
      data.level += 1;
      saveData(data);
      /* 重新渲染地图 */
      const roles      = getLiaoRoles();
      const levelConfig = getLevelConfig(data.level);
      ensureCharStates(data, roles, levelConfig);
      renderMap(data, roles, levelConfig);
      renderStatusBar(data, roles);
      renderExpBar(data);
      /* 显示升级弹窗 */
      showUpgrade(data.level, levelConfig, callback);
    } else {
      if (callback) callback();
    }
  }

  /* ── 显示叙事弹窗 ── */
  function showNarrate(icon, title, text) {
    const mask  = document.getElementById('garden-narrate-mask');
    const iconEl  = document.getElementById('garden-narrate-icon');
    const titleEl = document.getElementById('garden-narrate-title');
    const textEl  = document.getElementById('garden-narrate-text');
    if (!mask) return;
    if (iconEl)  iconEl.textContent  = icon;
    if (titleEl) titleEl.textContent = title;
    if (textEl)  textEl.textContent  = text;
    mask.style.display = 'flex';
  }

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'garden-narrate-close') {
      const mask = document.getElementById('garden-narrate-mask');
      if (mask) mask.style.display = 'none';
    }
  });

  /* ── 显示升级弹窗 ── */
  function showUpgrade(level, levelConfig, callback) {
    const mask   = document.getElementById('garden-upgrade-mask');
    const titleEl = document.getElementById('garden-upgrade-title');
    const descEl  = document.getElementById('garden-upgrade-desc');
    if (!mask) return;
    if (titleEl) titleEl.textContent = '家园升级到 ' + levelConfig.name + '！';
    if (descEl)  descEl.textContent  =
      '恭喜！家园已升级为【' + levelConfig.name + '】，解锁了新的房间和场景，快去探索吧！';
    mask.style.display = 'flex';
    const closeBtn = document.getElementById('garden-upgrade-close');
    if (closeBtn) {
      closeBtn.onclick = function () {
        mask.style.display = 'none';
        if (callback) callback();
      };
    }
  }

  /* ── 临时对话弹窗 ── */
  var currentChatRole = null;
  var currentChatData = null;

  function openGardenChat(role, state, data) {
    currentChatRole = role;
    currentChatData = data;

    const mask    = document.getElementById('garden-chat-mask');
    const avatar  = document.getElementById('garden-chat-popup-avatar');
    const nameEl  = document.getElementById('garden-chat-popup-name');
    const sceneEl = document.getElementById('garden-chat-popup-scene');
    const msgs    = document.getElementById('garden-chat-popup-messages');
    const input   = document.getElementById('garden-chat-popup-input');

    if (!mask) return;

    const roomLabel = ROOM_CONFIG[state.roomId] ? ROOM_CONFIG[state.roomId].label : '家园';

    if (avatar)  avatar.src = getRoleAvatar(role);
    if (nameEl)  nameEl.textContent  = role.name || '角色';
    if (sceneEl) sceneEl.textContent = '📍 家园·' + roomLabel;

    /* 渲染历史消息 */
    const id      = role.id || role.name;
    const history = data.gardenChatHistory[id] || [];
    if (msgs) {
      msgs.innerHTML = '';
      history.forEach(function (msg) {
        appendChatMsg(msg.role, msg.content, role, msg.scene);
      });
      msgs.scrollTop = msgs.scrollHeight;
    }

    if (input) { input.value = ''; input.focus(); }
    mask.style.display = 'flex';
  }

  function appendChatMsg(role, content, charRole, scene) {
    const msgs = document.getElementById('garden-chat-popup-messages');
    if (!msgs) return;

    const isUser = role === 'user';
    const div    = document.createElement('div');
    div.className = 'garden-chat-msg' + (isUser ? ' user-msg' : '');

    const avatarSrc = isUser ? getUserAvatar() : getRoleAvatar(charRole);
    const tag       = '【家园临时对话】';

    div.innerHTML =
            '<img src="' + avatarSrc + '" alt="">' +
      '<div style="display:flex;flex-direction:column;align-items:' + (isUser ? 'flex-end' : 'flex-start') + ';gap:2px;">' +
        '<div class="garden-chat-tag">' + tag + (scene ? ' · ' + scene : '') + '</div>' +
        '<div class="garden-chat-bubble">' + content + '</div>' +
      '</div>';

    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function appendLoadingBubble() {
    const msgs = document.getElementById('garden-chat-popup-messages');
    if (!msgs) return null;
    const div = document.createElement('div');
    div.className = 'garden-chat-msg';
    div.id = 'garden-chat-loading-bubble';
    div.innerHTML =
      '<img src="' + (currentChatRole ? getRoleAvatar(currentChatRole) : '') + '" alt="">' +
      '<div class="garden-chat-loading"><span></span><span></span><span></span></div>';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function removeLoadingBubble() {
    const el = document.getElementById('garden-chat-loading-bubble');
    if (el) el.remove();
  }

  /* 发送临时对话消息 */
  function sendGardenChat() {
    const input = document.getElementById('garden-chat-popup-input');
    if (!input || !currentChatRole || !currentChatData) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    const role     = currentChatRole;
    const data     = currentChatData;
    const id       = role.id || role.name;
    const state    = data.charStates[id] || { roomId: 'living', statusText: '' };
    const roomLabel = ROOM_CONFIG[state.roomId] ? ROOM_CONFIG[state.roomId].label : '家园';
    const sceneStr = '家园·' + roomLabel;

    /* 初始化历史 */
    if (!data.gardenChatHistory[id]) data.gardenChatHistory[id] = [];

    /* 追加用户消息 */
    data.gardenChatHistory[id].push({ role: 'user', content: text, scene: sceneStr });
    saveData(data);
    appendChatMsg('user', text, role, sceneStr);

    /* 显示加载动画 */
    appendLoadingBubble();

    /* 构建发往了了的消息，同步到对应聊天界面 */
    const gardenSystemNote = '[家园临时对话] 当前场景：' + sceneStr + '，' + (role.name || '角色') + state.statusText + '。这是在家园里发生的临时对话，请以家园场景为背景回应。';

    /* 调用了了AI接口 */
    callLiaoAI(role, data.gardenChatHistory[id], gardenSystemNote, function (reply) {
      removeLoadingBubble();
      if (reply) {
        data.gardenChatHistory[id].push({ role: 'assistant', content: reply, scene: sceneStr });
        saveData(data);
        appendChatMsg('assistant', reply, role, sceneStr);

        /* 同步消息到对应聊天界面 */
        syncToLiaoChat(role, text, reply, sceneStr);
      } else {
        data.gardenChatHistory[id].push({ role: 'assistant', content: '（沉默地微笑着）', scene: sceneStr });
        saveData(data);
        appendChatMsg('assistant', '（沉默地微笑着）', role, sceneStr);
      }
    });
  }

  /* ── 调用了了AI接口 ── */
  function callLiaoAI(role, history, gardenNote, callback) {
    /* 尝试复用了了已有的AI调用逻辑 */
    try {
      if (typeof window.LiaoCore !== 'undefined' && typeof window.LiaoCore.sendMessage === 'function') {
        /* 构建messages数组 */
        const messages = [];

        /* system prompt */
        const sysPrompt = buildSystemPrompt(role, gardenNote);
        messages.push({ role: 'system', content: sysPrompt });

        /* 历史消息（最近10条） */
        const recentHistory = history.slice(-10);
        recentHistory.forEach(function (h) {
          if (h.role === 'user' || h.role === 'assistant') {
            messages.push({ role: h.role, content: h.content });
          }
        });

        window.LiaoCore.sendMessage(messages, function (reply) {
          callback(reply);
        });
        return;
      }
    } catch (e) {}

    /* 降级：直接调用API */
    callAPIDirectly(role, history, gardenNote, callback);
  }

  function buildSystemPrompt(role, gardenNote) {
    let base = '';
    if (role.systemPrompt) {
      base = role.systemPrompt;
    } else if (role.persona) {
      base = role.persona;
    } else {
      base = '你是' + (role.name || '一个角色') + '。';
    }
    return base + '\n\n' + gardenNote;
  }

  function callAPIDirectly(role, history, gardenNote, callback) {
    /* 读取API配置 */
    let apiKey = '', apiUrl = '', modelName = '';
    try {
      apiKey   = JSON.parse(localStorage.getItem('halo9_apiKey')   || '""');
      apiUrl   = JSON.parse(localStorage.getItem('halo9_apiUrl')   || '""');
      modelName = JSON.parse(localStorage.getItem('halo9_model')   || '""');
    } catch (e) {}

    if (!apiKey || !apiUrl) {
      callback('（暂时无法回应，请检查API配置）');
      return;
    }

    const messages = [];
    messages.push({ role: 'system', content: buildSystemPrompt(role, gardenNote) });
    history.slice(-10).forEach(function (h) {
      if (h.role === 'user' || h.role === 'assistant') {
        messages.push({ role: h.role, content: h.content });
      }
    });

    const endpoint = apiUrl.replace(/\/$/, '') + '/chat/completions';

    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: modelName || 'gpt-3.5-turbo',
        messages: messages,
        stream: false,
      }),
    })
    .then(function (res) { return res.json(); })
    .then(function (json) {
      const reply = json.choices &&
        json.choices[0] &&
        json.choices[0].message &&
        json.choices[0].message.content;
      callback(reply || '（沉默地微笑着）');
    })
    .catch(function () {
      callback('（暂时无法回应）');
    });
  }

  /* ── 同步消息到了了聊天界面 ── */
  function syncToLiaoChat(role, userText, aiReply, sceneStr) {
    try {
      const id = role.id || role.name;
      /* 读取了了聊天记录 */
      const chatKey = 'halo9_chat_' + id;
      let chatHistory = [];
      try {
        const raw = localStorage.getItem(chatKey);
        if (raw) chatHistory = JSON.parse(raw);
      } catch (e) {}

      const tag = '[家园·' + sceneStr + '] ';

      chatHistory.push({
        role: 'user',
        content: tag + userText,
        timestamp: Date.now(),
        fromGarden: true,
      });
      chatHistory.push({
        role: 'assistant',
        content: tag + aiReply,
        timestamp: Date.now() + 1,
        fromGarden: true,
      });

      localStorage.setItem(chatKey, JSON.stringify(chatHistory));

      /* 如果了了聊天界面当前打开着该角色，刷新显示 */
      if (typeof window.LiaoChat !== 'undefined' &&
          typeof window.LiaoChat.refreshIfActive === 'function') {
        window.LiaoChat.refreshIfActive(id);
      }
    } catch (e) {}
  }

  /* ── 关闭临时对话弹窗 ── */
  function closeGardenChat() {
    const mask = document.getElementById('garden-chat-mask');
    if (mask) mask.style.display = 'none';
    currentChatRole = null;
  }

  /* ── 事件绑定 ── */
  function bindEvents(data) {
    /* 返回按钮 */
    const backBtn = document.getElementById('garden-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        closeGardenApp();
      });
    }

    /* 活动按钮 */
    const activityBtn = document.getElementById('garden-activity-btn');
    if (activityBtn) {
      activityBtn.addEventListener('click', function () {
        renderActivityList(data);
        const panel = document.getElementById('garden-activity-panel');
        if (panel) panel.style.display = 'flex';
      });
    }

    /* 关闭活动面板 */
    const panelClose = document.getElementById('garden-activity-panel-close');
    if (panelClose) {
      panelClose.addEventListener('click', function () {
        const panel = document.getElementById('garden-activity-panel');
        if (panel) panel.style.display = 'none';
      });
    }

    /* 点击活动面板遮罩关闭 */
    const activityPanel = document.getElementById('garden-activity-panel');
    if (activityPanel) {
      activityPanel.addEventListener('click', function (e) {
        if (e.target === this) this.style.display = 'none';
      });
    }

    /* 关闭临时对话弹窗 */
    const chatClose = document.getElementById('garden-chat-popup-close');
    if (chatClose) {
      chatClose.addEventListener('click', function () {
        closeGardenChat();
      });
    }

    /* 点击临时对话遮罩关闭 */
    const chatMask = document.getElementById('garden-chat-mask');
    if (chatMask) {
      chatMask.addEventListener('click', function (e) {
        if (e.target === this) closeGardenChat();
      });
    }

    /* 发送按钮 */
    const sendBtn = document.getElementById('garden-chat-popup-send');
    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        sendGardenChat();
      });
    }

    /* 回车发送 */
    const chatInput = document.getElementById('garden-chat-popup-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendGardenChat();
        }
      });
    }

    /* 关闭叙事弹窗 */
    const narrateClose = document.getElementById('garden-narrate-close');
    if (narrateClose) {
      narrateClose.addEventListener('click', function () {
        const mask = document.getElementById('garden-narrate-mask');
        if (mask) mask.style.display = 'none';
      });
    }

    /* 关闭升级弹窗 */
    const upgradeClose = document.getElementById('garden-upgrade-close');
    if (upgradeClose) {
      upgradeClose.addEventListener('click', function () {
        const mask = document.getElementById('garden-upgrade-mask');
        if (mask) mask.style.display = 'none';
      });
    }
  }

  /* ── 打开家园App ── */
  function openGardenApp() {
    const appEl = document.getElementById('garden-app');
    if (!appEl) return;
    appEl.style.display = 'flex';

    /* 初始化数据 */
    const data = initData();

    /* 确保每日活动 */
    ensureDailyActivities(data);

    /* 获取角色列表 */
    const roles = getLiaoRoles();

    /* 获取当前等级配置 */
    const levelConfig = getLevelConfig(data.level);

    /* 刷新角色状态（每次打开随机刷新） */
    refreshCharStates(data, roles, levelConfig);

    /* 渲染 */
    renderExpBar(data);
    renderMap(data, roles, levelConfig);
    renderStatusBar(data, roles);

    /* 红点 */
    const dot = document.getElementById('garden-activity-dot');
    const hasNew = data.dailyActivities.some(function (a) { return !a.done; });
    if (dot) dot.classList.toggle('has-new', hasNew);

    /* 绑定事件（只绑定一次） */
    if (!appEl.dataset.eventsbound) {
      bindEvents(data);
      appEl.dataset.eventsbound = '1';
    }
  }

  /* ── 关闭家园App ── */
  function closeGardenApp() {
    const appEl = document.getElementById('garden-app');
    if (appEl) appEl.style.display = 'none';
  }

  /* ── 暴露全局接口 ── */
  window.GardenApp = {
    open:  openGardenApp,
    close: closeGardenApp,
  };

})();

