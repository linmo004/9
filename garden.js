/* ============================================================
   garden.js — 家园App完整逻辑（重写版）
   存储键：halo9_garden
   ============================================================ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════
     ── 顶部可配置常量（后续直接替换这些值）──
     ══════════════════════════════════════════════ */
  const INTRO_IMG_URL   = 'https://img.icons8.com/fluency/200/cottage.png'; /* 开场动画图片URL */
  const ROOM_BG_URL     = 'https://img.icons8.com/fluency/200/interior.png'; /* 房间户型图背景URL */
  const APT_BG_COLOR    = '#1a2f1a'; /* 公寓楼背景色（无图时使用） */

  /* 房间内头像坐标点（相对背景图百分比，共5个） */
  const ROOM_AVATAR_POINTS = [
    { left: '18%', top: '35%' }, /* 卧室 */
    { left: '38%', top: '30%' }, /* 卫生间 */
    { left: '55%', top: '28%' }, /* 书房 */
    { left: '72%', top: '38%' }, /* 厨房餐厅 */
    { left: '42%', top: '42%' }, /* 客厅 */
  ];

  /* 地图地点配置（位置用百分比绝对定位） */
  const MAP_SPOTS = [
    { id: 'home',      label: '住所',   emoji: '🏠', left: '22%', top: '38%' },
    { id: 'plaza',     label: '广场',   emoji: '⛲', left: '52%', top: '25%' },
    { id: 'park',      label: '游乐场', emoji: '🎡', left: '78%', top: '42%' },
    { id: 'mall',      label: '商场',   emoji: '🏬', left: '62%', top: '65%' },
    { id: 'cafe',      label: '咖啡厅', emoji: '☕', left: '30%', top: '68%' },
    { id: 'farm',      label: '菜园',   emoji: '🌿', left: '16%', top: '62%' },
  ];

  /* 各地点状态文字池 */
  const LOCATION_STATES = {
    home:   ['在房间里休息', '在客厅看书', '在厨房做饭', '在卧室睡觉', '在书房写作'],
    plaza:  ['在广场散步', '在广场晒太阳', '在广场聊天', '在广场看活动', '在广场发呆'],
    park:   ['在游乐场玩耍', '在游乐场坐旋转木马', '在游乐场排队', '在游乐场吃棉花糖'],
    mall:   ['在商场逛街', '在商场购物', '在商场吃饭', '在商场看电影', '在商场休息'],
    cafe:   ['在咖啡厅喝咖啡', '在咖啡厅看书', '在咖啡厅工作', '在咖啡厅发呆', '在咖啡厅聊天'],
    farm:   ['在菜园浇水', '在菜园除草', '在菜园摘菜', '在菜园种花', '在菜园赏蝴蝶'],
  };

  /* 地点场景描述 */
  const LOCATION_DESC = {
    plaza:  '阳光明媚的广场，微风轻拂，大家在这里自由活动。角落里有人在下棋，草坪上有人在野餐。',
    park:   '欢乐的游乐场，旋转木马缓缓转动，笑声此起彼伏，空气里飘着爆米花的香气。',
    mall:   '宽敞明亮的商场，各种店铺琳琅满目，人来人往，热闹非凡。',
    cafe:   '温馨的咖啡厅，木质桌椅，柔和的灯光，咖啡香气弥漫，适合放松和交流。',
    farm:   '生机勃勃的菜园，绿油油的蔬菜整齐排列，蜜蜂飞舞，泥土散发着清新的气息。',
  };

  /* 每日活动池 */
  const ACTIVITY_POOL = [
    { icon: '🎂', name: '生日派对',   desc: '今天是特别的日子，一起来庆祝吧！',
      narrative: '蜡烛的光映出温暖的笑脸，大家的祝福声此起彼伏，生日快乐的歌声在广场上空回荡。' },
    { icon: '🍕', name: '广场野餐',   desc: '铺开野餐毯，一起在广场享用美食！',
      narrative: '草地上铺开了格子毯，大家带来各自的拿手菜，阳光正好，微风不燥，这是最美好的下午。' },
    { icon: '🎮', name: '游戏对决',   desc: '来一场公平的游戏对决，谁是最强者？',
      narrative: '游戏开始了！每个人都全力以赴，欢呼声和惋惜声交织在一起，胜负已分，却笑声不断。' },
    { icon: '🌟', name: '许愿时刻',   desc: '夜幕降临，流星划过，许下心愿吧。',
      narrative: '抬头仰望星空，一颗流星悄然滑落，大家闭上眼睛，把最深的愿望悄悄放在心里。' },
    { icon: '🌱', name: '菜园劳动',   desc: '一起去菜园劳动，感受泥土的气息。',
      narrative: '锄头翻动泥土的声音，种子落入土壤的触感，汗水换来的是对收获的期待。' },
    { icon: '📸', name: '集体合影',   desc: '难得聚齐，来一张大合照吧！',
      narrative: '大家挤在一起，比出各种手势，镜头定格了这个珍贵的瞬间，笑容永远留在了照片里。' },
    { icon: '🎵', name: '音乐下午茶', desc: '咖啡厅里有人开始弹吉他了……',
      narrative: '指尖拨动琴弦，旋律在咖啡厅里流淌，大家放下手机，静静地沉浸在音乐里。' },
    { icon: '🧹', name: '大扫除',     desc: '一起把家园打扫得焕然一新！',
      narrative: '分工明确，动作麻利，不知不觉间，家园变得窗明几净，心情也跟着明亮起来。' },
    { icon: '🌙', name: '深夜聊天',   desc: '夜深了，大家聚在广场上聊到凌晨。',
      narrative: '星星越来越多，话题越来越深，这种只属于深夜的坦诚，让彼此的距离更近了一些。' },
    { icon: '🎁', name: '神秘礼物',   desc: '广场中央出现了一个大包裹……',
      narrative: '拆开层层包装，里面是一份让所有人都感到惊喜的礼物，欢呼声响彻整个广场。' },
  ];

  /* ══════════════════════════════════════════════
     ── 数据管理 ──
     ══════════════════════════════════════════════ */
  const STORAGE_KEY = 'halo9_garden';

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
            invitedRoles:    [],   /* 已入住角色id数组 */
      positions:       {},   /* roleId => locationId */
      userPosition:    'home',
      charStatuses:    {},   /* roleId => statusText */
      userStatus:      '在房间里休息',
      dailyActivities: [],
      dailyDate:       '',
      voteData:        null,
    };
    saveData(data);
    return data;
  }

  /* ── 工具 ── */
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function nowTimeStr() {
    const d = new Date();
    const h = String(d.getHours()).padStart(2,'0');
    const m = String(d.getMinutes()).padStart(2,'0');
    const s = String(d.getSeconds()).padStart(2,'0');
    const mo = d.getMonth()+1;
    const day = d.getDate();
    return mo + '月' + day + '日 ' + h + ':' + m + ':' + s;
  }

  /* ── 读取了了角色库 ── */
  function getAllRoles() {
    try {
      const raw = localStorage.getItem('halo9_roles');
      if (!raw) return [];
      const roles = JSON.parse(raw);
      return Array.isArray(roles) ? roles : [];
    } catch (e) { return []; }
  }

  function getRoleById(id) {
    return getAllRoles().find(r => (r.id || r.name) === id) || null;
  }

  function getRoleAvatar(role) {
    if (!role) return 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=char';
    return role.avatar ||
      'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=' + encodeURIComponent(role.name || 'char');
  }

  function getUserAvatar() {
    try {
      const av = localStorage.getItem('halo9_userAvatar');
      return av ? JSON.parse(av) : 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=halo9';
    } catch (e) {
      return 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=halo9';
    }
  }

  /* ── 读取API配置（与liao-special.js一致） ── */
  function getApiConfig() {
    try {
      const v = localStorage.getItem('halo9_apiActiveConfig');
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }

  function getApiModel() {
    try {
      const v = localStorage.getItem('halo9_apiCurrentModel');
      return v ? JSON.parse(v) : '';
    } catch (e) { return ''; }
  }

  /* ── 调用API ── */
  function callAPI(messages, onSuccess, onError) {
    const cfg   = getApiConfig();
    const model = getApiModel();
    if (!cfg || !cfg.url) { onError('未配置API'); return; }
    const endpoint = cfg.url.replace(/\/$/, '') + '/chat/completions';
    const headers  = { 'Content-Type': 'application/json' };
    if (cfg.key) headers['Authorization'] = 'Bearer ' + cfg.key;
    fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: model || 'gpt-3.5-turbo', messages, stream: false }),
    })
    .then(function (r) { return r.json(); })
    .then(function (json) {
      const reply = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
      onSuccess(reply || '');
    })
    .catch(function (e) { onError(e.message || '请求失败'); });
  }

  /* ── 每日活动初始化 ── */
  function ensureDailyActivities(data) {
    const today = todayStr();
    if (data.dailyDate === today && data.dailyActivities.length > 0) return;
    const count = 3 + Math.floor(Math.random() * 2);
    const pool  = ACTIVITY_POOL.slice();
    const chosen = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      chosen.push(Object.assign({}, pool[idx], { done: false }));
      pool.splice(idx, 1);
    }
    data.dailyActivities = chosen;
    data.dailyDate = today;
    saveData(data);
  }

  /* ── 随机分配角色位置和状态 ── */
  function randomizePositions(data) {
    const locationIds = MAP_SPOTS.map(function (s) { return s.id; });
    const invitedRoles = data.invitedRoles || [];
    invitedRoles.forEach(function (roleId) {
      data.positions[roleId]    = pickRandom(locationIds);
      data.charStatuses[roleId] = pickRandom(LOCATION_STATES[data.positions[roleId]] || ['在家园里']);
    });
    /* 用户总在住所 */
    data.userPosition = 'home';
    data.userStatus   = pickRandom(LOCATION_STATES['home']);
    saveData(data);
  }

  /* ══════════════════════════════════════════════
     ── 界面切换管理 ──
     ══════════════════════════════════════════════ */
  const VIEWS = ['garden-map-view','garden-apt-view','garden-room-view','garden-plaza-view','garden-location-view'];

  function showView(id) {
    VIEWS.forEach(function (v) {
      const el = document.getElementById(v);
      if (el) el.style.display = (v === id) ? 'flex' : 'none';
    });
  }

  /* ══════════════════════════════════════════════
     ── 开场动画 ──
     ══════════════════════════════════════════════ */
  function playIntro(callback) {
    const intro   = document.getElementById('garden-intro');
    const img     = document.getElementById('garden-intro-img');
    const overlay = document.getElementById('garden-intro-overlay');
    if (!intro) { callback(); return; }

    intro.style.display = 'flex';
    img.src = INTRO_IMG_URL;
    img.style.opacity = '0';
    overlay.style.background = 'rgba(0,0,0,0)';

    setTimeout(function () {
      img.style.opacity = '1';
    }, 100);

    setTimeout(function () {
      overlay.style.background = 'rgba(0,0,0,0.7)';
    }, 1800);

    setTimeout(function () {
      intro.style.display = 'none';
      img.style.opacity = '0';
      overlay.style.background = 'rgba(0,0,0,0)';
      callback();
    }, 2800);
  }

  /* ══════════════════════════════════════════════
     ── 地图界面 ──
     ══════════════════════════════════════════════ */
  function renderMap(data) {
    showView('garden-map-view');
    const spotsEl = document.getElementById('garden-map-spots');
    if (!spotsEl) return;
    spotsEl.innerHTML = '';

    MAP_SPOTS.forEach(function (spot) {
      const div = document.createElement('div');
      div.className = 'gdn-spot';
      div.style.left = spot.left;
      div.style.top  = spot.top;

      /* 收集在该地点的人 */
      const here = [];
      /* 用户 */
      if (data.userPosition === spot.id) {
        here.push({ avatar: getUserAvatar(), name: '我' });
      }
      /* 角色 */
      (data.invitedRoles || []).forEach(function (rid) {
        if (data.positions[rid] === spot.id) {
          const role = getRoleById(rid);
          here.push({ avatar: getRoleAvatar(role), name: role ? (role.nickname || role.name || '角色') : '角色' });
        }
      });

      /* 头像小图 */
      let avatarsHtml = '';
      const shown = here.slice(0, 3);
      const extra = here.length - shown.length;
      shown.forEach(function (p) {
        avatarsHtml += '<img src="' + p.avatar + '" alt="' + p.name + '">';
      });
      if (extra > 0) {
        avatarsHtml += '<div class="gdn-spot-count">+' + extra + '</div>';
      }

      div.innerHTML =
        '<div class="gdn-spot-circle">' +
          '<span class="gdn-spot-emoji">' + spot.emoji + '</span>' +
        '</div>' +
        '<div class="gdn-spot-label">' + spot.label + '</div>' +
        '<div class="gdn-spot-avatars">' + avatarsHtml + '</div>';

      div.addEventListener('click', function () {
        handleSpotClick(spot.id, data);
      });

      spotsEl.appendChild(div);
    });
  }

  function handleSpotClick(spotId, data) {
    if (spotId === 'home') {
      renderAptView(data);
    } else if (spotId === 'plaza') {
      renderPlazaView(data);
    } else {
      renderLocationView(spotId, data);
    }
  }

  /* ══════════════════════════════════════════════
     ── 住所（公寓楼）界面 ──
     ══════════════════════════════════════════════ */
  function renderAptView(data) {
    showView('garden-apt-view');
    const building = document.getElementById('garden-apt-building');
    if (!building) return;
    building.innerHTML = '';

    const invited   = data.invitedRoles || [];
    const allRoles  = getAllRoles();
    const invitedRoleObjs = invited.map(function (id) {
      return allRoles.find(function (r) { return (r.id || r.name) === id; }) || { id: id, name: id };
    });

    /* 计算总楼层：用户1间 + 角色数间，每层2间 */
    const totalRooms = 1 + invitedRoleObjs.length;
    const totalFloors = Math.ceil(totalRooms / 2) + 1; /* +1 for 一楼设置室 */

    /* 所有房间数据（用户+角色） */
    const rooms = [];
    rooms.push({ type: 'user', name: '我', avatar: getUserAvatar() });
    invitedRoleObjs.forEach(function (role) {
      rooms.push({ type: 'role', name: role.nickname || role.name || '角色', avatar: getRoleAvatar(role), roleId: role.id || role.name });
    });

    /* 从高楼层到低楼层渲染 */
    for (let floor = totalFloors; floor >= 1; floor--) {
      const floorEl = document.createElement('div');
      floorEl.className = 'gdn-apt-floor';

      const labelEl = document.createElement('div');
      labelEl.className = 'gdn-floor-label';
      labelEl.textContent = floor + 'F';
      floorEl.appendChild(labelEl);

      const roomsEl = document.createElement('div');
      roomsEl.className = 'gdn-floor-rooms';

      if (floor === 1) {
        /* 一楼：设置室 */
        const settingsRoom = document.createElement('div');
        settingsRoom.className = 'gdn-settings-room';
        settingsRoom.innerHTML =
          '<div class="gdn-settings-room-frame">⚙️</div>' +
          '<div class="gdn-settings-room-name">设置室</div>';
        settingsRoom.addEventListener('click', function () {
          openInviteModal(data);
        });
        roomsEl.appendChild(settingsRoom);
      } else {
        /* 普通楼层，每层2间 */
        const floorIdx = floor - 2; /* floor 2 => idx 0, floor 3 => idx 2 ... */
        const startIdx = floorIdx * 2;
        for (let i = startIdx; i < startIdx + 2; i++) {
          if (i >= rooms.length) break;
          const room = rooms[i];
          const doorEl = document.createElement('div');
          doorEl.className = 'gdn-room-door';
          doorEl.innerHTML =
            '<div class="gdn-room-door-frame">' +
              '<img class="gdn-room-door-avatar" src="' + room.avatar + '" alt="">' +
              '<div class="gdn-room-door-knob"></div>' +
            '</div>' +
            '<div class="gdn-room-door-name">' + room.name + '</div>';

          (function (r) {
            doorEl.addEventListener('click', function () {
              renderRoomView(r, data);
            });
          })(room);

          roomsEl.appendChild(doorEl);
        }
      }

      floorEl.appendChild(roomsEl);
      building.appendChild(floorEl);
    }
  }

  /* ══════════════════════════════════════════════
     ── 房间内部界面 ──
     ══════════════════════════════════════════════ */
  function renderRoomView(roomOwner, data) {
    showView('garden-room-view');

    const titleEl = document.getElementById('gdn-room-title');
    if (titleEl) titleEl.textContent = roomOwner.name + ' 的房间';

    const bgImg = document.getElementById('garden-room-bg-img');
    if (bgImg) bgImg.src = ROOM_BG_URL;

    const avatarsEl = document.getElementById('garden-room-avatars');
    if (!avatarsEl) return;
    avatarsEl.innerHTML = '';

    /* 在住所的角色和用户 */
    const presentChars = [];
    const absentChars  = [];

    /* 用户 */
    if (data.userPosition === 'home') {
      presentChars.push({ isUser: true, name: '我', avatar: getUserAvatar(), status: data.userStatus || '在房间里' });
    } else {
      absentChars.push({ isUser: true, name: '我', avatar: getUserAvatar(), location: data.userPosition });
    }

    /* 已入住角色 */
    (data.invitedRoles || []).forEach(function (rid) {
      const role = getRoleById(rid);
      const name = role ? (role.nickname || role.name || '角色') : '角色';
      const avatar = getRoleAvatar(role);
      if (data.positions[rid] === 'home') {
        presentChars.push({
          isUser: false, roleId: rid, name: name, avatar: avatar,
          status: data.charStatuses[rid] || '在房间里',
          role: role,
        });
      } else {
        absentChars.push({
          isUser: false, roleId: rid, name: name, avatar: avatar,
          location: data.positions[rid],
          role: role,
        });
      }
    });

    /* 渲染在场角色头像（按坐标点分配） */
    presentChars.forEach(function (char, idx) {
      const point = ROOM_AVATAR_POINTS[idx % ROOM_AVATAR_POINTS.length];
      const pin   = document.createElement('div');
      pin.className = 'gdn-room-avatar-pin';
      pin.style.left = point.left;
      pin.style.top  = point.top;
      pin.innerHTML =
        '<img src="' + char.avatar + '" alt="">' +
        '<div class="gdn-room-avatar-pin-name">' + char.name + '</div>';

      (function (c) {
        pin.addEventListener('click', function (e) {
          const rect = pin.getBoundingClientRect();
          showBubblePopup(c, data, rect);
        });
      })(char);

      avatarsEl.appendChild(pin);
    });

    /* 渲染不在场提示 */
    if (absentChars.length > 0) {
      const absentWrap = document.createElement('div');
      absentWrap.className = 'gdn-room-absent';
      absentChars.forEach(function (char) {
        const locationLabel = (MAP_SPOTS.find(function (s) { return s.id === char.location; }) || {}).label || char.location;
        const chip = document.createElement('div');
        chip.className = 'gdn-room-absent-chip';
        chip.innerHTML =
          '<img src="' + char.avatar + '" alt="">' +
          '<span>' + char.name + ' 现在在' + locationLabel + '</span>';
        absentWrap.appendChild(chip);
      });
      avatarsEl.appendChild(absentWrap);
    }
  }

  /* ══════════════════════════════════════════════
     ── 头像气泡弹窗 ──
     ══════════════════════════════════════════════ */
  var bubbleTarget = null;

  function showBubblePopup(charObj, data, anchorRect) {
    bubbleTarget = charObj;
    const popup = document.getElementById('gdn-bubble-popup');
    if (!popup) return;

    document.getElementById('gdn-bubble-avatar').src = charObj.avatar;
    document.getElementById('gdn-bubble-name').textContent = charObj.name;
    document.getElementById('gdn-bubble-status').textContent = charObj.isUser ? (data.userStatus || '') : (charObj.status || '');

    const locationId    = charObj.isUser ? data.userPosition : (data.positions[charObj.roleId] || 'home');
    const locationLabel = (MAP_SPOTS.find(function (s) { return s.id === locationId; }) || {}).label || locationId;
    document.getElementById('gdn-bubble-location').textContent = '📍 ' + locationLabel;

    /* 隐藏对话按钮（用户自己不需要） */
    const chatBtn = document.getElementById('gdn-bubble-chat');
    const rpsBtn  = document.getElementById('gdn-bubble-rps');
    if (chatBtn) chatBtn.style.display = charObj.isUser ? 'none' : '';
    if (rpsBtn) rpsBtn.style.display = charObj.isUser ? 'none' : '';

    popup.style.display = 'block';

    /* 定位气泡 */
    const appEl = document.getElementById('garden-app');
    if (appEl) {
      const appRect = appEl.getBoundingClientRect();
      let left = anchorRect.right - appRect.left + 8;
      let top  = anchorRect.top  - appRect.top  - 20;
      if (left + 240 > appRect.width)  left = anchorRect.left - appRect.left - 248;
      if (top  + 160 > appRect.height) top  = appRect.height - 170;
      if (top < 10) top = 10;
      popup.style.left = left + 'px';
      popup.style.top  = top  + 'px';
    }
  }

  function closeBubblePopup() {
    const popup = document.getElementById('gdn-bubble-popup');
    if (popup) popup.style.display = 'none';
    bubbleTarget = null;
  }

  /* ══════════════════════════════════════════════
     ── 临时对话浮窗 ──
     ══════════════════════════════════════════════ */
  var chatFloatRole      = null;   /* 当前对话角色对象 */
  var chatFloatMessages  = [];     /* 本次临时对话消息（内存暂存） */
  var chatFloatScene     = '';     /* 场景描述 */

  function openChatFloat(charObj, data) {
    chatFloatRole     = charObj;
    chatFloatMessages = [];

    const locationId    = data.positions[charObj.roleId] || 'home';
    const locationLabel = (MAP_SPOTS.find(function (s) { return s.id === locationId; }) || {}).label || locationId;
    chatFloatScene = '家园·' + locationLabel;

    const floatEl = document.getElementById('gdn-chat-float');
    if (!floatEl) return;

    document.getElementById('gdn-chat-float-avatar').src = charObj.avatar;
    document.getElementById('gdn-chat-float-name').textContent = charObj.name;
    document.getElementById('gdn-chat-float-scene').textContent = '📍 ' + chatFloatScene;
    document.getElementById('gdn-chat-float-messages').innerHTML = '';
    document.getElementById('gdn-chat-float-input').value = '';

    floatEl.style.display = 'flex';
    closeBubblePopup();

    setTimeout(function () {
      document.getElementById('gdn-chat-float-input').focus();
    }, 100);
  }

  function closeChatFloat() {
    const floatEl = document.getElementById('gdn-chat-float');
    if (floatEl) floatEl.style.display = 'none';
    chatFloatRole     = null;
    chatFloatMessages = [];
  }

  function appendFloatMsg(role, content, tag) {
    const msgsEl = document.getElementById('gdn-chat-float-messages');
    if (!msgsEl) return;
    const isUser = role === 'user';
    const div    = document.createElement('div');
    div.className = 'gdn-float-msg' + (isUser ? ' user' : '');
    const avatarSrc = isUser ? getUserAvatar() : (chatFloatRole ? chatFloatRole.avatar : '');
    div.innerHTML =
      '<img src="' + avatarSrc + '" alt="">' +
      '<div class="gdn-float-bubble-wrap">' +
        '<div class="gdn-float-tag">' + (tag || '【家园临时对话】') + '</div>' +
        '<div class="gdn-float-bubble">' + content + '</div>' +
      '</div>';
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function appendFloatLoading() {
    const msgsEl = document.getElementById('gdn-chat-float-messages');
    if (!msgsEl) return;
    const div = document.createElement('div');
    div.className = 'gdn-float-msg';
    div.id = 'gdn-float-loading';
    div.innerHTML =
      '<img src="' + (chatFloatRole ? chatFloatRole.avatar : '') + '" alt="">' +
      '<div class="gdn-float-loading"><span></span><span></span><span></span></div>';
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function removeFloatLoading() {
    const el = document.getElementById('gdn-float-loading');
    if (el) el.remove();
  }

  function sendFloatMessage(text, data) {
    if (!text || !chatFloatRole) return;
    const timeStr  = nowTimeStr();
    const tag      = '【家园临时对话】' + timeStr + ' · ' + chatFloatScene;
    const roleName = chatFloatRole.name;

    /* 记录到内存 */
    chatFloatMessages.push({ role: 'user', content: text, tag: tag, ts: Date.now() });
    appendFloatMsg('user', text, tag);
    appendFloatLoading();

    /* 构建system prompt */
    const roleObj  = chatFloatRole.role || getRoleById(chatFloatRole.roleId);
    let sysBase    = '';
    if (roleObj) {
      sysBase = roleObj.setting || roleObj.persona || ('你是' + roleName + '。');
    } else {
      sysBase = '你是' + roleName + '。';
    }
    const gardenNote =
      '\n\n【特别注意】这是在家园App（游戏）里的临时对话，不是正式聊天界面。' +
      '当前时间：' + timeStr + '。' +
      '当前场景：' + chatFloatScene + '，' + roleName + (chatFloatRole.status || '') + '。' +
      '请以家园场景为背景自然回应，语气轻松随意。';

    const messages = [{ role: 'system', content: sysBase + gardenNote }];
    chatFloatMessages.forEach(function (m) {
      if (m.role === 'user' || m.role === 'assistant') {
        messages.push({ role: m.role, content: m.content });
      }
    });

    callAPI(messages, function (reply) {
      removeFloatLoading();
      if (reply) {
        chatFloatMessages.push({ role: 'assistant', content: reply, tag: tag, ts: Date.now() });
        appendFloatMsg('assistant', reply, tag);
      } else {
        appendFloatMsg('assistant', '（微微一笑，没有说话）', tag);
        chatFloatMessages.push({ role: 'assistant', content: '（微微一笑，没有说话）', tag: tag, ts: Date.now() });
      }
    }, function (err) {
      removeFloatLoading();
      appendFloatMsg('assistant', '（暂时无法回应：' + err + '）', tag);
    });
  }

  /* ── 同步临时对话到了了聊天记录 ── */
  function syncChatFloatToLiao() {
    if (!chatFloatRole || !chatFloatMessages.length) return;
    const roleId = chatFloatRole.roleId;
    if (!roleId) return;

    /* 读取了了聊天数据 */
    let liaoChats = [];
    try {
      const raw = localStorage.getItem('liao_chats');
      if (raw) liaoChats = JSON.parse(raw);
    } catch (e) {}

    /* 找到对应角色的chat */
    const chatIdx = liaoChats.findIndex(function (c) { return c.roleId === roleId; });
    if (chatIdx < 0) {
      alert('未找到对应角色的了了聊天记录，请先在了了中与该角色建立对话。');
      return;
    }

    /* 构建折叠消息 */
    const foldContent = chatFloatMessages.map(function (m) {
      return '[' + (m.role === 'user' ? '我' : chatFloatRole.name) + '] ' + m.content;
    }).join('\n');

    const foldMsg = {
      role:    'assistant',
      type:    'garden_chat_fold',
      content: '【家园临时对话折叠】' + chatFloatScene + '\n' + foldContent,
      ts:      Date.now(),
      id:      'garden_fold_' + Date.now(),
      gardenFoldData: {
        scene:    chatFloatScene,
        messages: chatFloatMessages.slice(),
        roleName: chatFloatRole.name,
        timeStr:  nowTimeStr(),
      },
    };

    if (!liaoChats[chatIdx].messages) liaoChats[chatIdx].messages = [];
    liaoChats[chatIdx].messages.push(foldMsg);

    /* 也注入一条system_hint让AI知道家园对话发生过 */
    liaoChats[chatIdx].messages.push({
      role:    'user',
      type:    'system_hint',
      hidden:  true,
      content: '【系统提示】用户刚刚在家园App（游戏）中与你进行了一段临时对话，场景是' + chatFloatScene + '，内容摘要：' + foldContent.slice(0, 200),
      ts:      Date.now() + 1,
      id:      'garden_hint_' + Date.now(),
    });

    try {
      localStorage.setItem('liao_chats', JSON.stringify(liaoChats));
    } catch (e) {}

    /* 若了了聊天界面当前打开了该角色则刷新 */
    if (typeof window.LiaoChat !== 'undefined' && typeof window.LiaoChat.refreshIfActive === 'function') {
      window.LiaoChat.refreshIfActive(roleId);
    }

    chatFloatMessages = [];
    alert('已同步到了了聊天记录（折叠显示）');
  }

  /* ══════════════════════════════════════════════
     ── 石头剪刀布 ──
     ══════════════════════════════════════════════ */
  var rpsTargetChar = null;

  function openRPS(charObj) {
    rpsTargetChar = charObj;
    const modal = document.getElementById('gdn-rps-modal');
    if (!modal) return;
    const nameEl = document.getElementById('gdn-rps-role-name');
    if (nameEl) nameEl.textContent = charObj.name;
    const resultEl = document.getElementById('gdn-rps-result');
    if (resultEl) resultEl.style.display = 'none';
    modal.style.display = 'flex';
    closeBubblePopup();
  }

  function playRPS(userChoice) {
    const choices = ['rock', 'scissors', 'paper'];
    const labels  = { rock: '石头✊', scissors: '剪刀✌️', paper: '布🖐️' };
    const roleChoice = pickRandom(choices);

    let result = '';
    if (userChoice === roleChoice) {
      result = '平局！';
    } else if (
      (userChoice === 'rock'     && roleChoice === 'scissors') ||
      (userChoice === 'scissors' && roleChoice === 'paper')    ||
      (userChoice === 'paper'    && roleChoice === 'rock')
    ) {
      result = '你赢了！🎉';
    } else {
      result = '你输了…😔';
    }

    const roleName   = rpsTargetChar ? rpsTargetChar.name : '角色';
    const resultText = '你出了 ' + labels[userChoice] + '，' + roleName + ' 出了 ' + labels[roleChoice] + '。' + result;

    const resultEl = document.getElementById('gdn-rps-result');
    if (resultEl) {
      resultEl.textContent = resultText;
      resultEl.style.display = 'block';
    }

    /* 自动填入临时对话框 */
    const timeStr = nowTimeStr();
    const tag     = '【家园·石头剪刀布】' + timeStr;

    if (chatFloatRole && rpsTargetChar && chatFloatRole.roleId === rpsTargetChar.roleId) {
      /* 临时对话框已打开且是同一角色，直接追加 */
      chatFloatMessages.push({ role: 'user', content: resultText, tag: tag, ts: Date.now() });
      appendFloatMsg('user', resultText, tag);
    } else {
      /* 打开该角色的临时对话框并填入 */
      if (rpsTargetChar) {
        openChatFloat(rpsTargetChar, gardenDataRef);
        setTimeout(function () {
          chatFloatMessages.push({ role: 'user', content: resultText, tag: tag, ts: Date.now() });
          appendFloatMsg('user', resultText, tag);
        }, 100);
      }
    }
  }

  /* ══════════════════════════════════════════════
     ── 广场界面 ──
     ══════════════════════════════════════════════ */
  function renderPlazaView(data) {
    showView('garden-plaza-view');
    ensureDailyActivities(data);

    /* 渲染在广场的角色 */
    const charsEl = document.getElementById('garden-plaza-chars');
    if (charsEl) {
      charsEl.innerHTML = '';
      renderLocationChars('plaza', data, charsEl);
    }

    /* 渲染活动列表 */
    const listEl = document.getElementById('garden-activity-list');
    if (listEl) {
      listEl.innerHTML = '';
      data.dailyActivities.forEach(function (activity, idx) {
        const item = document.createElement('div');
        item.className = 'gdn-activity-item' + (activity.done ? ' done' : '');
        const joinBtn = '<button class="gdn-activity-join-btn"' + (activity.done ? ' disabled' : '') + '>' +
          (activity.done ? '已完成' : '参与') + '</button>';
        item.innerHTML =
          '<div class="gdn-activity-icon">' + activity.icon + '</div>' +
          '<div class="gdn-activity-info">' +
            '<div class="gdn-activity-name">' + activity.name + '</div>' +
            '<div class="gdn-activity-desc">' + activity.desc + '</div>' +
          '</div>' + joinBtn;
        if (!activity.done) {
          item.querySelector('.gdn-activity-join-btn').addEventListener('click', function () {
            triggerActivity(activity, idx, data);
          });
        }
        listEl.appendChild(item);
      });
    }

    /* 投票结果 */
    renderVoteResult(data);
  }

  function triggerActivity(activity, idx, data) {
    data.dailyActivities[idx].done = true;
    saveData(data);

    /* 刷新列表 */
    renderPlazaView(data);

    /* 调用API生成叙事 */
    const cfg = getApiConfig();
    if (!cfg || !cfg.url) {
      showNarrate(activity.icon, activity.name, activity.narrative);
      return;
    }

    const messages = [{
      role: 'system',
      content: '你是一个温暖的叙事者，请用100字以内的中文描述以下家园活动的情景，语言生动有画面感，充满温情：「' + activity.name + '」—— ' + activity.desc,
    }];

    callAPI(messages, function (reply) {
      showNarrate(activity.icon, activity.name, reply || activity.narrative);
    }, function () {
      showNarrate(activity.icon, activity.name, activity.narrative);
    });
  }

  function showNarrate(icon, title, text) {
    const modal = document.getElementById('gdn-narrate-modal');
    if (!modal) return;
    const iconEl  = document.getElementById('gdn-narrate-icon');
    const titleEl = document.getElementById('gdn-narrate-title');
    const textEl  = document.getElementById('gdn-narrate-text');
    if (iconEl)  iconEl.textContent  = icon;
    if (titleEl) titleEl.textContent = title;
    if (textEl)  textEl.textContent  = text;
    modal.style.display = 'flex';
  }

  /* ══════════════════════════════════════════════
     ── 投票功能 ──
     ══════════════════════════════════════════════ */
  function openVoteSetup() {
    const modal = document.getElementById('gdn-vote-setup-modal');
    if (modal) modal.style.display = 'flex';
  }

  function startVote(topic, optionsRaw, data) {
    const options = optionsRaw.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!topic || options.length < 2) { alert('请填写题目和至少两个选项'); return; }

    const invited = data.invitedRoles || [];
    if (!invited.length) { alert('还没有邀请任何角色入住，无法发起投票'); return; }

    /* 初始化投票数据 */
    data.voteData = {
      topic:   topic,
      options: options,
      votes:   {},  /* roleId => optionIndex */
    };
    saveData(data);

    const voteSection = document.getElementById('garden-vote-section');
    if (voteSection) voteSection.style.display = 'flex';

    /* 关闭弹窗 */
    const modal = document.getElementById('gdn-vote-setup-modal');
    if (modal) modal.style.display = 'none';

    /* 逐个角色调用API投票 */
    let pending = invited.length;
    invited.forEach(function (roleId, i) {
      const role = getRoleById(roleId);
      const roleName = role ? (role.nickname || role.name || '角色') : '角色';
      const roleBase = role ? (role.setting || role.persona || ('你是' + roleName)) : ('你是' + roleName);
      const optStr   = options.map(function (o, idx) { return (idx+1) + '. ' + o; }).join('\n');

      const messages = [{
        role: 'system',
        content: roleBase + '\n\n现在在家园的广场上有一个投票活动，题目是：「' + topic + '」\n选项：\n' + optStr +
          '\n\n请从以上选项中选择一个，只输出选项的序号数字（如：1），不要输出任何其他内容。',
      }];

      setTimeout(function () {
        callAPI(messages, function (reply) {
          const num = parseInt((reply || '').trim());
          const optIdx = isNaN(num) ? 0 : Math.min(Math.max(0, num - 1), options.length - 1);
          data.voteData.votes[roleId] = optIdx;
          saveData(data);
          pending--;
          if (pending <= 0) {
            renderVoteResult(data);
          }
        }, function () {
          data.voteData.votes[roleId] = Math.floor(Math.random() * options.length);
          saveData(data);
          pending--;
          if (pending <= 0) {
            renderVoteResult(data);
          }
        });
      }, i * 400);
    });
  }

  function renderVoteResult(data) {
    const voteSection = document.getElementById('garden-vote-section');
    const resultEl    = document.getElementById('garden-vote-result');
    if (!voteSection || !resultEl) return;

    if (!data.voteData || !data.voteData.topic) {
      voteSection.style.display = 'none';
      return;
    }

    voteSection.style.display = 'flex';
    resultEl.innerHTML = '';

    const { topic, options, votes } = data.voteData;
    const counts = options.map(function () { return 0; });
    Object.values(votes).forEach(function (idx) {
      if (idx >= 0 && idx < counts.length) counts[idx]++;
    });
    const total = Object.keys(votes).length || 1;

    const box = document.createElement('div');
    box.className = 'gdn-vote-result-box';

    const topicEl = document.createElement('div');
    topicEl.className   = 'gdn-vote-topic';
    topicEl.textContent = topic;
    box.appendChild(topicEl);

    options.forEach(function (opt, idx) {
      const pct = Math.round((counts[idx] / total) * 100);
      const row = document.createElement('div');
      row.className = 'gdn-vote-option-row';
      row.innerHTML =
        '<div class="gdn-vote-option-label">' + opt + '</div>' +
        '<div class="gdn-vote-bar-wrap"><div class="gdn-vote-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="gdn-vote-count">' + counts[idx] + '</div>';
      box.appendChild(row);
    });

    resultEl.appendChild(box);
  }

  /* ══════════════════════════════════════════════
     ── 通用地点界面（游乐场/商场/咖啡厅/菜园）──
     ══════════════════════════════════════════════ */
  function renderLocationView(spotId, data) {
    showView('garden-location-view');

    const spot = MAP_SPOTS.find(function (s) { return s.id === spotId; });
    if (!spot) return;

    const titleEl = document.getElementById('gdn-location-title');
    if (titleEl) titleEl.textContent = spot.label;

    const descEl = document.getElementById('gdn-location-desc');
    if (descEl) descEl.textContent = LOCATION_DESC[spotId] || '';

    const charsEl = document.getElementById('garden-location-chars');
    if (charsEl) {
      charsEl.innerHTML = '';
      renderLocationChars(spotId, data, charsEl);
    }

    /* 打招呼按钮 */
    const greetBtn = document.getElementById('gdn-location-greet');
    if (greetBtn) {
      greetBtn.onclick = function () {
        triggerGreet(spotId, data);
      };
    }

    /* 返回按钮 */
    const backBtn = document.getElementById('gdn-location-back');
    if (backBtn) {
      backBtn.onclick = function () {
        renderMap(data);
      };
    }
  }

  function renderLocationChars(spotId, data, container) {
    /* 用户 */
    if (data.userPosition === spotId) {
      const chip = makeCharChip({ isUser: true, name: '我', avatar: getUserAvatar(), status: data.userStatus }, data);
      container.appendChild(chip);
    }
    /* 角色 */
    (data.invitedRoles || []).forEach(function (rid) {
      if (data.positions[rid] === spotId) {
        const role     = getRoleById(rid);
        const name     = role ? (role.nickname || role.name || '角色') : '角色';
        const avatar   = getRoleAvatar(role);
        const status   = data.charStatuses[rid] || '';
        const charObj  = { isUser: false, roleId: rid, name: name, avatar: avatar, status: status, role: role };
        const chip     = makeCharChip(charObj, data);
        container.appendChild(chip);
      }
    });

    if (!container.children.length) {
      container.innerHTML = '<div style="font-size:12px;color:rgba(150,220,150,0.5);padding:8px 0;">这里暂时没有人</div>';
    }
  }

  function makeCharChip(charObj, data) {
    const chip = document.createElement('div');
    chip.className = 'gdn-loc-char-chip';
    chip.innerHTML =
      '<img src="' + charObj.avatar + '" alt="">' +
      '<div class="gdn-loc-char-chip-info">' +
        '<div class="gdn-loc-char-name">' + charObj.name + '</div>' +
        '<div class="gdn-loc-char-status">' + (charObj.status || '') + '</div>' +
      '</div>';
    if (!charObj.isUser) {
      chip.addEventListener('click', function () {
        const rect = chip.getBoundingClientRect();
        showBubblePopup(charObj, data, rect);
      });
    }
    return chip;
  }

  function triggerGreet(spotId, data) {
    const spot = MAP_SPOTS.find(function (s) { return s.id === spotId; });
    const spotLabel = spot ? spot.label : spotId;

    /* 找到在该地点的角色 */
    const hereRoles = (data.invitedRoles || []).filter(function (rid) {
      return data.positions[rid] === spotId;
    });

    if (!hereRoles.length) {
      showNarrate('👋', '打了个招呼', '你向' + spotLabel + '四处张望，微笑着和周围的一切打了个招呼，清风拂过，心情格外舒畅。');
      return;
    }

    const roleNames = hereRoles.map(function (rid) {
      const r = getRoleById(rid);
      return r ? (r.nickname || r.name || '角色') : '角色';
    }).join('、');

    const messages = [{
      role: 'system',
      content: '请用80字以内生动描述：用户在' + spotLabel + '向' + roleNames + '打招呼，大家的反应和当时的温馨场景。语言自然活泼。',
    }];

    callAPI(messages, function (reply) {
      showNarrate('👋', '打了个招呼', reply || ('你在' + spotLabel + '遇到了' + roleNames + '，大家相视而笑，气氛格外融洽。'));
    }, function () {
      showNarrate('👋', '打了个招呼', '你在' + spotLabel + '遇到了' + roleNames + '，大家相视而笑，气氛格外融洽。');
    });
  }

  /* ══════════════════════════════════════════════
     ── 邀请角色入住弹窗 ──
     ══════════════════════════════════════════════ */
  var inviteSelected = [];

  function openInviteModal(data) {
    inviteSelected = (data.invitedRoles || []).slice();
    const listEl = document.getElementById('gdn-invite-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const allRoles = getAllRoles();
    if (!allRoles.length) {
      listEl.innerHTML = '<div style="font-size:13px;color:rgba(150,220,150,0.5);padding:12px 0;text-align:center;">角色库为空，请先在了了中创建角色</div>';
    } else {
      allRoles.forEach(function (role) {
        const id       = role.id || role.name;
        const selected = inviteSelected.includes(id);
        const item     = document.createElement('div');
        item.className = 'gdn-invite-item' + (selected ? ' selected' : '');
        item.innerHTML =
          '<img src="' + getRoleAvatar(role) + '" alt="">' +
          '<div class="gdn-invite-item-name">' + (role.nickname || role.name || '角色') + '</div>' +
          '<div class="gdn-invite-check">' + (selected ? '✓' : '') + '</div>';
        item.addEventListener('click', function () {
          const idx = inviteSelected.indexOf(id);
          if (idx >= 0) {
            inviteSelected.splice(idx, 1);
            item.classList.remove('selected');
            item.querySelector('.gdn-invite-check').textContent = '';
          } else {
            inviteSelected.push(id);
            item.classList.add('selected');
            item.querySelector('.gdn-invite-check').textContent = '✓';
          }
        });
        listEl.appendChild(item);
      });
    }

    const modal = document.getElementById('gdn-invite-modal');
    if (modal) modal.style.display = 'flex';
  }

  function confirmInvite(data) {
    data.invitedRoles = inviteSelected.slice();
    /* 为新入住角色分配位置 */
    data.invitedRoles.forEach(function (rid) {
      if (!data.positions[rid]) {
        data.positions[rid]    = pickRandom(MAP_SPOTS.map(function (s) { return s.id; }));
        data.charStatuses[rid] = pickRandom(LOCATION_STATES[data.positions[rid]] || ['在家园里']);
      }
    });
    /* 清理已移出角色 */
    Object.keys(data.positions).forEach(function (rid) {
      if (!data.invitedRoles.includes(rid)) {
        delete data.positions[rid];
        delete data.charStatuses[rid];
      }
    });
    saveData(data);

    const modal = document.getElementById('gdn-invite-modal');
    if (modal) modal.style.display = 'none';

    /* 刷新公寓楼 */
    renderAptView(data);
  }

  /* ══════════════════════════════════════════════
     ── 拖拽临时对话浮窗 ──
     ══════════════════════════════════════════════ */
  function initChatFloatDrag() {
    const floatEl  = document.getElementById('gdn-chat-float');
    const headerEl = document.getElementById('gdn-chat-float-header');
    if (!floatEl || !headerEl) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let origLeft = 0, origTop = 0;

    function onDragStart(e) {
      isDragging = true;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startX   = clientX;
      startY   = clientY;
      origLeft = floatEl.offsetLeft;
      origTop  = floatEl.offsetTop;
      floatEl.style.transform = 'none';
      floatEl.style.left = origLeft + 'px';
      floatEl.style.top  = origTop  + 'px';
      e.preventDefault();
    }

    function onDragMove(e) {
      if (!isDragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - startX;
      const dy = clientY - startY;
      const appEl   = document.getElementById('garden-app');
      const appRect = appEl ? appEl.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
      let newLeft = origLeft + dx;
      let newTop  = origTop  + dy;
      newLeft = Math.max(0, Math.min(newLeft, appRect.width  - floatEl.offsetWidth));
      newTop  = Math.max(0, Math.min(newTop,  appRect.height - floatEl.offsetHeight));
      floatEl.style.left = newLeft + 'px';
      floatEl.style.top  = newTop  + 'px';
    }

    function onDragEnd() { isDragging = false; }

    headerEl.addEventListener('mousedown',  onDragStart);
    headerEl.addEventListener('touchstart', onDragStart, { passive: false });
    document.addEventListener('mousemove',  onDragMove);
    document.addEventListener('touchmove',  onDragMove, { passive: false });
    document.addEventListener('mouseup',    onDragEnd);
    document.addEventListener('touchend',   onDragEnd);
  }

  /* ══════════════════════════════════════════════
     ── 全局事件绑定 ──
     ══════════════════════════════════════════════ */
  var gardenDataRef = null;

  function bindAllEvents() {
    /* 地图返回/退出 */
    const mapClose = document.getElementById('gdn-map-close');
    if (mapClose) mapClose.addEventListener('click', function () { closeGardenApp(); });

    /* 住所返回 */
    const aptBack = document.getElementById('gdn-apt-back');
    if (aptBack) aptBack.addEventListener('click', function () { renderMap(gardenDataRef); });

    /* 住所设置按钮 */
    const aptSettings = document.getElementById('gdn-apt-settings');
    if (aptSettings) aptSettings.addEventListener('click', function () { openInviteModal(gardenDataRef); });

    /* 房间返回 */
    const roomBack = document.getElementById('gdn-room-back');
    if (roomBack) roomBack.addEventListener('click', function () { renderAptView(gardenDataRef); });

    /* 广场返回 */
    const plazaBack = document.getElementById('gdn-plaza-back');
    if (plazaBack) plazaBack.addEventListener('click', function () { renderMap(gardenDataRef); });

    /* 广场发起投票 */
    const plazaVoteBtn = document.getElementById('gdn-plaza-vote-btn');
    if (plazaVoteBtn) plazaVoteBtn.addEventListener('click', function () { openVoteSetup(); });

    /* 投票弹窗取消/确认 */
    const voteCancel = document.getElementById('gdn-vote-cancel');
    if (voteCancel) voteCancel.addEventListener('click', function () {
      const m = document.getElementById('gdn-vote-setup-modal');
      if (m) m.style.display = 'none';
    });

    const voteConfirm = document.getElementById('gdn-vote-confirm');
    if (voteConfirm) voteConfirm.addEventListener('click', function () {
      const topic   = (document.getElementById('gdn-vote-topic')   || {}).value || '';
      const options = (document.getElementById('gdn-vote-options') || {}).value || '';
      startVote(topic, options, gardenDataRef);
    });

    /* 气泡弹窗关闭 */
    const bubbleClose = document.getElementById('gdn-bubble-close');
    if (bubbleClose) bubbleClose.addEventListener('click', function () { closeBubblePopup(); });

    /* 气泡→对话 */
    const bubbleChat = document.getElementById('gdn-bubble-chat');
    if (bubbleChat) bubbleChat.addEventListener('click', function () {
      if (bubbleTarget && !bubbleTarget.isUser) {
        openChatFloat(bubbleTarget, gardenDataRef);
      }
    });

    /* 气泡→石头剪刀布 */
    const bubbleRps = document.getElementById('gdn-bubble-rps');
    if (bubbleRps) bubbleRps.addEventListener('click', function () {
      if (bubbleTarget && !bubbleTarget.isUser) {
        openRPS(bubbleTarget);
      }
    });

    /* 临时对话浮窗关闭 */
    const chatFloatClose = document.getElementById('gdn-chat-float-close');
    if (chatFloatClose) chatFloatClose.addEventListener('click', function () { closeChatFloat(); });

    /* 临时对话浮窗同步 */
    const chatFloatSync = document.getElementById('gdn-chat-float-sync');
    if (chatFloatSync) chatFloatSync.addEventListener('click', function () { syncChatFloatToLiao(); });

    /* 临时对话AI发送按钮 */
    const aiBtn = document.getElementById('gdn-chat-float-ai-btn');
    if (aiBtn) aiBtn.addEventListener('click', function () {
      const input = document.getElementById('gdn-chat-float-input');
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      sendFloatMessage(text, gardenDataRef);
    });

    /* 临时对话回车发送 */
    const chatInput = document.getElementById('gdn-chat-float-input');
    if (chatInput) chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;
        chatInput.value = '';
        sendFloatMessage(text, gardenDataRef);
      }
    });

    /* 石头剪刀布按钮 */
    document.querySelectorAll('.gdn-rps-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        playRPS(this.dataset.choice);
      });
    });

    /* 石头剪刀布关闭 */
    const rpsClose = document.getElementById('gdn-rps-close');
    if (rpsClose) rpsClose.addEventListener('click', function () {
      const modal = document.getElementById('gdn-rps-modal');
      if (modal) modal.style.display = 'none';
    });

    /* 叙事弹窗关闭 */
    const narrateClose = document.getElementById('gdn-narrate-close');
    if (narrateClose) narrateClose.addEventListener('click', function () {
      const modal = document.getElementById('gdn-narrate-modal');
      if (modal) modal.style.display = 'none';
    });

    /* 邀请弹窗取消/确认 */
    const inviteCancel = document.getElementById('gdn-invite-cancel');
    if (inviteCancel) inviteCancel.addEventListener('click', function () {
      const modal = document.getElementById('gdn-invite-modal');
      if (modal) modal.style.display = 'none';
    });

    const inviteConfirm = document.getElementById('gdn-invite-confirm');
    if (inviteConfirm) inviteConfirm.addEventListener('click', function () {
      confirmInvite(gardenDataRef);
    });

    /* 点击遮罩关闭各弹窗 */
    ['gdn-invite-modal','gdn-rps-modal','gdn-narrate-modal','gdn-vote-setup-modal'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', function (e) {
        if (e.target === el) el.style.display = 'none';
      });
    });

    /* 初始化拖拽 */
    initChatFloatDrag();
  }

  /* ══════════════════════════════════════════════
     ── 打开 / 关闭家园App ──
     ══════════════════════════════════════════════ */
  function openGardenApp() {
    const appEl = document.getElementById('garden-app');
    if (!appEl) return;
    appEl.style.display = 'flex';

    /* 初始化数据 */
    gardenDataRef = initData();
    ensureDailyActivities(gardenDataRef);

    /* 随机分配位置（每次打开刷新） */
    randomizePositions(gardenDataRef);

    /* 绑定事件（只绑定一次） */
    if (!appEl.dataset.gdnBound) {
      bindAllEvents();
      appEl.dataset.gdnBound = '1';
    }

    /* 播放开场动画，结束后进入地图 */
    playIntro(function () {
      renderMap(gardenDataRef);
    });
  }

  function closeGardenApp() {
    const appEl = document.getElementById('garden-app');
    if (appEl) appEl.style.display = 'none';
    /* 关闭所有子界面 */
    VIEWS.forEach(function (v) {
      const el = document.getElementById(v);
      if (el) el.style.display = 'none';
    });
    closeBubblePopup();
    closeChatFloat();
  }

  /* ── 暴露全局接口 ── */
  window.GardenApp = {
    open:  openGardenApp,
    close: closeGardenApp,
  };

})();
