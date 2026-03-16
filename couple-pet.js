/* ============================================================
   couple-pet.js — 小家 + 宠物模块
   ============================================================ */

/* ---- 宠物语料库 ---- */
const CP_PET_SPEECHES = {
  cat: [
    '喵～今天也要开心哦',
    '本喵要午睡了，不许打扰',
    '铲屎官快来陪我玩',
    '饿了饿了饿了！',
    '刚才追了一下尾巴，很满足',
    '窝里很暖，不想动',
    '你们有没有在想我？',
    '今天阳光很好，我晒了一上午',
    '喵？有人叫我吗',
    '本喵心情不错，赏你们一个眼神',
    '悄悄告诉你，我刚才打翻了水杯',
    '最喜欢被摸下巴了',
    '呼噜呼噜～',
    '今天有没有好吃的？'
  ],
  dog: [
    '汪！铲屎官回来了吗！',
    '我想出去遛弯了！！',
    '今天有没有好吃的骨头',
    '等你们很久了，尾巴都摇酸了',
    '汪汪汪！我爱你们！',
    '刚才梦见追球了，好开心',
    '我要抱抱！',
    '今天的阳光超级棒，我打了个滚',
    '你们吵架了吗？我来哄你们',
    '汪！有陌生人！哦等等是快递',
    '最喜欢你们了，排名不分先后',
    '我的玩具呢？找不到了',
    '能不能多摸我几下啊',
    '汪汪～今天也要元气满满！'
  ],
  rabbit: [
    '兔兔我今天吃了很多草',
    '磨牙磨牙，嗑嗑嗑',
    '我耳朵竖起来了，说明我很开心',
    '不要突然靠近我！会吓到我的',
    '今天跳了好多下，锻炼身体',
    '好困，要睡了，轻一点',
    '我的萝卜呢？',
    '兔子也是需要陪伴的哦',
    '今天天气好，想出去蹦跶',
    '你们有没有想我',
    '我在这里，安静地陪着你们',
    '摸摸我的耳朵会带来好运的',
    '兔兔不开心，需要抱抱',
    '软绵绵的，就是我'
  ]
};

const CP_PET_TYPES = [
  { type: 'cat',    emoji: '🐱', name: '猫咪' },
  { type: 'dog',    emoji: '🐶', name: '狗狗' },
  { type: 'rabbit', emoji: '🐰', name: '兔兔' }
];

const CP_PET_DECOR_ITEMS = [
  { id: 'sofa',    emoji: '🛋️', label: '沙发' },
  { id: 'plant',   emoji: '🌿', label: '绿植' },
  { id: 'bowl',    emoji: '🥣', label: '食盆' },
  { id: 'ball',    emoji: '⚽', label: '玩具球' },
  { id: 'bed',     emoji: '🛏️', label: '宠物床' },
  { id: 'fish',    emoji: '🐟', label: '鱼缸' },
  { id: 'lamp',    emoji: '🪔', label: '小灯' },
  { id: 'carpet',  emoji: '🎪', label: '地毯' }
];

/* ---- 行动点每日重置 ---- */
function cpPetResetActionPts() {
  if (!cpCurrentSpace) return;
  const pet     = cpCurrentSpace.pet;
  const today   = cpFmtDate(Date.now());
  if (pet.lastReset !== today) {
    pet.actionPts = 10;
    pet.lastReset = today;
    cpSaveSpace();
  }
}

/* ---- 触发宠物随机说话 ---- */
function cpPetSpeak() {
  if (!cpCurrentSpace) return;
  const pet      = cpCurrentSpace.pet;
  const type     = pet.type || 'cat';
  const speeches = CP_PET_SPEECHES[type] || CP_PET_SPEECHES.cat;
  const text     = speeches[Math.floor(Math.random() * speeches.length)];
  pet.speech     = text;
  cpSaveSpace();

  const speechEl = document.getElementById('cp-pet-speech-text');
  if (speechEl) speechEl.textContent = text;
}

/* ---- 渲染宠物主界面 ---- */
function cpRenderPet() {
  const panel = document.getElementById('couple-panel-pet');
  if (!panel || !cpCurrentSpace) return;

  cpPetResetActionPts();

  const pet = cpCurrentSpace.pet;

  /* 还没有宠物，显示选择界面 */
  if (!pet.type) {
    cpRenderPetSelect(panel);
    return;
  }

  const typeInfo   = CP_PET_TYPES.find(t => t.type === pet.type) || CP_PET_TYPES[0];
  const userName   = cpGetUserName();
  const roleName   = cpGetRoleName(cpCurrentRole);

  /* 装扮网格 */
  const decorHtml = CP_PET_DECOR_ITEMS.map(item =>
    '<button class="cp-pet-decor-item' +
      ((pet.decors || []).includes(item.id) ? ' active' : '') +
      '" data-decor="' + item.id + '">' +
      '<span class="cp-pet-decor-icon">' + item.emoji + '</span>' +
      '<span class="cp-pet-decor-label">' + item.label + '</span>' +
    '</button>'
  ).join('');

  /* 成长日志（最近5条） */
  const logHtml = (pet.log || []).slice(-5).reverse().map(entry =>
    '<div class="cp-pet-log-item">' +
      '<span class="cp-pet-log-time">' + cpFmtTime(entry.ts) + '</span>' +
      '<span>' + escHtml(entry.text) + '</span>' +
    '</div>'
  ).join('');

  /* 串门留言（最近3条） */
  const visitHtml = (pet.visits || []).slice(-3).reverse().map(v =>
    '<div class="cp-pet-visit-card">' +
      '<img class="cp-pet-visit-avatar" src="' + escHtml(v.avatar) + '" alt="">' +
      '<div class="cp-pet-visit-body">' +
        '<div class="cp-pet-visit-name">' + escHtml(v.name) + '</div>' +
        '<div class="cp-pet-visit-text">' + escHtml(v.text) + '</div>' +
        '<div class="cp-pet-visit-time">' + cpFmtTime(v.ts) + '</div>' +
      '</div>' +
    '</div>'
  ).join('');

  panel.innerHTML = `
    <div class="cp-pet-header">
      <div>
        <div class="cp-pet-header-title">我们的小家</div>
        <div class="cp-pet-header-sub">${escHtml(userName)} & ${escHtml(roleName)}</div>
      </div>
    </div>

    <div class="cp-pet-stage">
      <span class="cp-pet-emoji" id="cp-pet-emoji-btn">${typeInfo.emoji}</span>
      <div class="cp-pet-name">${escHtml(pet.name || typeInfo.name)}</div>
      <div class="cp-pet-type-label">${typeInfo.name} · 行动点 ${pet.actionPts}/10</div>
      <div class="cp-pet-speech" id="cp-pet-speech-text">${escHtml(pet.speech || '...')}</div>
    </div>

    <div class="cp-pet-stats">
      <div class="cp-pet-stat-row">
        <span class="cp-pet-stat-label">心情</span>
        <div class="cp-pet-stat-bar-wrap">
          <div class="cp-pet-stat-bar mood" style="width:${pet.mood}%"></div>
        </div>
        <span class="cp-pet-stat-val">${pet.mood}</span>
      </div>
      <div class="cp-pet-stat-row">
        <span class="cp-pet-stat-label">饱食</span>
        <div class="cp-pet-stat-bar-wrap">
          <div class="cp-pet-stat-bar food" style="width:${pet.food}%"></div>
        </div>
        <span class="cp-pet-stat-val">${pet.food}</span>
      </div>
      <div class="cp-pet-stat-row">
        <span class="cp-pet-stat-label">亲密</span>
        <div class="cp-pet-stat-bar-wrap">
          <div class="cp-pet-stat-bar love" style="width:${pet.love}%"></div>
        </div>
        <span class="cp-pet-stat-val">${pet.love}</span>
      </div>
    </div>

    <div class="cp-pet-actions">
      <button class="cp-pet-action-btn" data-act="feed">
        <span class="cp-pet-action-icon">🍖</span>
        <span class="cp-pet-action-label">喂食</span>
        <span class="cp-pet-action-cost">-2点</span>
      </button>
      <button class="cp-pet-action-btn" data-act="pet">
        <span class="cp-pet-action-icon">🤲</span>
        <span class="cp-pet-action-label">抚摸</span>
        <span class="cp-pet-action-cost">-1点</span>
      </button>
      <button class="cp-pet-action-btn" data-act="play">
        <span class="cp-pet-action-icon">🎾</span>
        <span class="cp-pet-action-label">玩耍</span>
        <span class="cp-pet-action-cost">-3点</span>
      </button>
      <button class="cp-pet-action-btn" data-act="rename">
        <span class="cp-pet-action-icon">✏️</span>
        <span class="cp-pet-action-label">改名</span>
        <span class="cp-pet-action-cost">免费</span>
      </button>
      <button class="cp-pet-action-btn" data-act="speak">
        <span class="cp-pet-action-icon">💬</span>
        <span class="cp-pet-action-label">说话</span>
        <span class="cp-pet-action-cost">免费</span>
      </button>
      <button class="cp-pet-action-btn" data-act="visit">
        <span class="cp-pet-action-icon">🚪</span>
        <span class="cp-pet-action-label">邀串门</span>
        <span class="cp-pet-action-cost">-2点</span>
      </button>
    </div>

    <div class="cp-pet-decor-section">
      <div class="cp-pet-decor-title">HOME · 小家装扮</div>
      <div class="cp-pet-decor-grid">${decorHtml}</div>
    </div>

    ${logHtml ? `
    <div class="cp-pet-log-section" style="margin-top:12px;">
      <div class="cp-pet-log-title">成长日志</div>
      <div class="cp-pet-log-list">${logHtml}</div>
    </div>` : ''}

    ${visitHtml ? `
    <div class="cp-pet-visit-section">
      <div class="cp-pet-visit-title">${escHtml(roleName)} 的串门留言</div>
      ${visitHtml}
    </div>` : ''}
  `;

  /* 点击宠物触发说话 */
  document.getElementById('cp-pet-emoji-btn') &&
  document.getElementById('cp-pet-emoji-btn').addEventListener('click', () => {
    cpPetSpeak();
  });

  /* 行动按钮 */
  panel.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => cpPetAction(btn.dataset.act));
  });

  /* 装扮按钮 */
  panel.querySelectorAll('[data-decor]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id  = btn.dataset.decor;
      const pet = cpCurrentSpace.pet;
      if (!pet.decors) pet.decors = [];
      if (pet.decors.includes(id)) {
        pet.decors = pet.decors.filter(d => d !== id);
      } else {
        pet.decors.push(id);
      }
      cpSaveSpace();
      cpRenderPet();
    });
  });
}

/* ---- 选择宠物界面 ---- */
function cpRenderPetSelect(panel) {
  panel.innerHTML = `
    <div class="cp-pet-header">
      <div>
        <div class="cp-pet-header-title">我们的小家</div>
        <div class="cp-pet-header-sub">选择你们的第一只宠物</div>
      </div>
    </div>
    <div style="padding:30px 20px;">
      <div style="font-size:14px;color:#388e3c;text-align:center;
        margin-bottom:20px;font-weight:600;">
        选择一只宠物，开始你们的小家
      </div>
      <div class="cp-pet-select-grid">
        ${CP_PET_TYPES.map(t =>
          '<button class="cp-pet-select-item" data-pettype="' + t.type + '">' +
            '<span class="cp-pet-select-emoji">' + t.emoji + '</span>' +
            '<span class="cp-pet-select-name">' + t.name + '</span>' +
          '</button>'
        ).join('')}
      </div>
    </div>
  `;

  panel.querySelectorAll('[data-pettype]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type     = btn.dataset.pettype;
      const typeInfo = CP_PET_TYPES.find(t => t.type === type);
      const name     = prompt('给你们的' + typeInfo.name + '起个名字吧', typeInfo.name);
      if (!name) return;

      cpCurrentSpace.pet.type      = type;
      cpCurrentSpace.pet.name      = name.trim();
      cpCurrentSpace.pet.mood      = 80;
      cpCurrentSpace.pet.food      = 80;
      cpCurrentSpace.pet.love      = 60;
      cpCurrentSpace.pet.actionPts = 10;
      cpCurrentSpace.pet.lastReset = cpFmtDate(Date.now());
      cpCurrentSpace.pet.speech    = CP_PET_SPEECHES[type][0];
      cpCurrentSpace.pet.log       = [{
        ts:   Date.now(),
        text: name.trim() + ' 加入了小家！'
      }];

      cpSaveSpace();
      cpRenderPet();
    });
  });
}

/* ---- 执行行动 ---- */
function cpPetAction(act) {
  if (!cpCurrentSpace) return;
  const pet = cpCurrentSpace.pet;

  const costs = { feed: 2, pet: 1, play: 3, rename: 0, speak: 0, visit: 2 };
  const cost  = costs[act] || 0;

  if (cost > 0 && pet.actionPts < cost) {
    alert('行动点不足！今天的行动点已用完，明天再来吧');
    return;
  }

  const clamp = v => Math.min(100, Math.max(0, v));
  let logText = '';

  if (act === 'feed') {
    pet.food     = clamp(pet.food + 20);
    pet.mood     = clamp(pet.mood + 5);
    pet.actionPts -= cost;
    logText = cpGetUserName() + ' 给 ' + (pet.name || '宠物') + ' 喂了食';
    cpPetSpeak();
  } else if (act === 'pet') {
    pet.love     = clamp(pet.love + 10);
    pet.mood     = clamp(pet.mood + 10);
    pet.actionPts -= cost;
    logText = cpGetUserName() + ' 抚摸了 ' + (pet.name || '宠物');
    cpPetSpeak();
  } else if (act === 'play') {
    pet.love     = clamp(pet.love + 15);
    pet.mood     = clamp(pet.mood + 15);
    pet.food     = clamp(pet.food - 10);
    pet.actionPts -= cost;
    logText = cpGetUserName() + ' 和 ' + (pet.name || '宠物') + ' 玩耍了一会儿';
    cpPetSpeak();
  } else if (act === 'rename') {
    const newName = prompt('给宠物改个名字', pet.name || '');
    if (!newName || !newName.trim()) return;
    logText   = (pet.name || '宠物') + ' 改名为 ' + newName.trim();
    pet.name  = newName.trim();
  } else if (act === 'speak') {
    cpPetSpeak();
    return;
  } else if (act === 'visit') {
    pet.actionPts -= cost;
    cpTriggerRoleVisit();
    return;
  }

  /* 自然衰减（每次操作小幅衰减其他属性） */
  if (act !== 'rename' && act !== 'speak') {
    if (act !== 'feed') pet.food = clamp(pet.food - 3);
    if (act !== 'play') pet.mood = clamp(pet.mood - 2);
  }

  if (logText) {
    if (!pet.log) pet.log = [];
    pet.log.push({ ts: Date.now(), text: logText });
    if (pet.log.length > 50) pet.log = pet.log.slice(-50);
  }

  cpSaveSpace();
  cpRenderPet();
}

/* ---- 角色串门（调用 API） ---- */
async function cpTriggerRoleVisit() {
  const config = loadApiConfig();
  if (!config || !config.url) { alert('请先配置 API'); return; }
  const model = loadApiModel();
  if (!model) { alert('请先选择模型'); return; }
  if (!cpCurrentRole || !cpCurrentSpace) return;

  const roleName = cpGetRoleName(cpCurrentRole);
  const userName = cpGetUserName();
  const pet      = cpCurrentSpace.pet;
  const petName  = pet.name || '宠物';
  const typeInfo = CP_PET_TYPES.find(t => t.type === pet.type) || CP_PET_TYPES[0];

  const prompt =
    '你是' + roleName + '，' + (cpCurrentRole.setting || '') + '。\n' +
    '你来到了你和' + userName + '共同的小家，看到了你们养的' +
    typeInfo.name + '「' + petName + '」。\n' +
    '请留下一句串门留言，字数30字以内，口语化，有情感，可以提到' +
    petName + '或' + userName + '。只输出留言内容本身。';

  try {
    const endpoint = config.url.replace(/\/$/, '') + '/chat/completions';
    const headers  = { 'Content-Type': 'application/json' };
    if (config.key) headers['Authorization'] = 'Bearer ' + config.key;

    const res = await fetch(endpoint, {
      method: 'POST', headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false
      })
    });
    if (!res.ok) return;

    const json    = await res.json();
    const content = (json.choices?.[0]?.message?.content || '').trim();
    if (!content) return;

    if (!cpCurrentSpace.pet.visits) cpCurrentSpace.pet.visits = [];
    cpCurrentSpace.pet.visits.push({
      name:   roleName,
      avatar: cpGetRoleAvatar(cpCurrentRole),
      text:   content,
      ts:     Date.now()
    });
    if (cpCurrentSpace.pet.visits.length > 20) {
      cpCurrentSpace.pet.visits = cpCurrentSpace.pet.visits.slice(-20);
    }

    if (!cpCurrentSpace.pet.log) cpCurrentSpace.pet.log = [];
    cpCurrentSpace.pet.log.push({
      ts:   Date.now(),
      text: roleName + ' 来小家串门了'
    });

    cpSaveSpace();
    if (cpCurrentTab === 'pet') cpRenderPet();

  } catch (e) { /* 静默 */ }
}
