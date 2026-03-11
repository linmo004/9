/* ============================================================
   batoru.js — 大逃杀 App 逻辑层
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     工具函数
     ============================================================ */
  function btrLoad(key) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
    catch (e) { return null; }
  }
  function btrSave(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function btrGetApiConfig() { return btrLoad('halo9_apiActiveConfig'); }
  function btrGetApiModel()  { return btrLoad('halo9_apiCurrentModel') || ''; }

  function btrGetRoles() {
    for (const k of ['liao_roles','halo9_roles','roles']) {
      const v = btrLoad(k);
      if (Array.isArray(v) && v.length) return v;
    }
    return [];
  }

  function btrGetRoleName(role) {
    return role.realname || role.nickname || role.name || '未知';
  }
  function btrGetRoleAvatar(role) {
    return role.avatar ||
      'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=' +
      encodeURIComponent(btrGetRoleName(role));
  }
  function btrGetRoleSetting(role) {
    return (role.setting || role.persona || role.description || '').slice(0, 200);
  }
  function btrGetUserAvatar() {
    return btrLoad('halo9_userAvatar') || btrLoad('liao_userAvatar') ||
      'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=btr_user';
  }

  async function btrCallAPI(messages) {
    const cfg   = btrGetApiConfig();
    const model = btrGetApiModel();
    if (!cfg || !cfg.url || !model) throw new Error('未配置API');
    const endpoint = cfg.url.replace(/\/$/, '') + '/chat/completions';
    const headers  = { 'Content-Type': 'application/json' };
    if (cfg.key) headers['Authorization'] = 'Bearer ' + cfg.key;
    const res = await fetch(endpoint, {
      method: 'POST', headers,
      body: JSON.stringify({ model, messages, stream: false })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    return (json.choices?.[0]?.message?.content || '').trim();
  }

  /* ============================================================
     游戏状态
     ============================================================ */
  const SAVES_KEY = 'halo9_batoru_saves';
  const MAX_SAVES = 5;

  let gs = null; // 当前游戏状态对象

  function btrNewGameState() {
    return {
      mode:             'player',
      userSetup:        { name: '幸存者', setting: '', mode: 'player' },
      participants:     [],   // [{id, name, avatar, setting, isUser}]
      outline:          [],   // 大纲行数组
      scene:            '',
      totalDays:        4,
      currentDayIndex:  0,   // 0..totalDays*3-1
      aliveList:        [],   // 存活者 id 列表
      userStats:        { hp: 100, hunger: 100, stamina: 100, location: '未知', statusTags: ['正常'] },
      inventory:        [],   // [{emoji, name, qty}]
      narrativeHistory: [],   // 最近6段叙事文字],
      broadcastQueue:   [],
      danmakuHistory:   [],
      pendingChat:      '',   // 用户对话框输入（等待下次行动时注入）
      isUserDead:       false,
      gameOver:         false,
      winner:           '',
    };
  }

  /* ── 天数/时段标签 ── */
  const PERIOD_LABELS = ['早', '午', '晚'];
  function btrDayLabel(idx) {
    const day    = Math.floor(idx / 3) + 1;
    const period = PERIOD_LABELS[idx % 3];
    return '第' + day + '天 ' + period;
  }

  /* ============================================================
     Canvas 乱码字符雨
     ============================================================ */
  let glitchAnimId = null;

  function btrStartGlitch() {
    const canvas = document.getElementById('batoru-glitch-canvas');
    if (!canvas) return;
    const ctx    = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const cols    = Math.floor(canvas.width / 14);
    const drops   = Array(cols).fill(1);
    const chars   = '▒▓░█▄▀ЖФЦЧШЩЪЫЬЭЮЯабвгдеёжзийкл' +
                    'アイウエオカキクケコサシスセソタチツテトナニヌネノ' +
                    '囧囗囝囡囚囤囥囦囧囨囩囪囫囬园囮囯';
    const colors  = ['#8b0000','#cc0000','#3a0000','#5a0000','#6a0000'];

    function draw() {
      ctx.fillStyle = 'rgba(10,0,0,0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '13px monospace';
      for (let i = 0; i < drops.length; i++) {
        const ch    = chars[Math.floor(Math.random() * chars.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        ctx.fillStyle = color;
        ctx.fillText(ch, i * 14, drops[i] * 14);
        if (drops[i] * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      glitchAnimId = requestAnimationFrame(draw);
    }
    draw();
  }

  function btrStopGlitch() {
    if (glitchAnimId) { cancelAnimationFrame(glitchAnimId); glitchAnimId = null; }
    const canvas = document.getElementById('batoru-glitch-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  /* ============================================================
     雪花屏
     ============================================================ */
  let staticTimer = null;

  function btrScheduleStatic() {
    if (staticTimer) clearTimeout(staticTimer);
    const delay = (10 + Math.random() * 15) * 1000;
    staticTimer = setTimeout(() => {
      const el  = document.getElementById('batoru-static');
      if (!el) return;
      el.style.display  = 'block';
      el.style.opacity  = String(0.3 + Math.random() * 0.5);
      const dur = 200 + Math.random() * 400;
      const shakeX = (Math.random() * 4 - 2).toFixed(1) + 'px';
      const shakeY = (Math.random() * 4 - 2).toFixed(1) + 'px';
      el.style.transform = `translate(${shakeX},${shakeY})`;
      setTimeout(() => {
        el.style.opacity   = '0';
        el.style.transform = 'translate(0,0)';
        setTimeout(() => { el.style.display = 'none'; }, 100);
        btrScheduleStatic();
      }, dur);
    }, delay);
  }

  function btrStopStatic() {
    if (staticTimer) { clearTimeout(staticTimer); staticTimer = null; }
    const el = document.getElementById('batoru-static');
    if (el) { el.style.display = 'none'; el.style.opacity = '0'; }
  }

  /* ============================================================
     屏幕切换
     ============================================================ */
  const BTR_SCREENS = [
    'batoru-lobby','batoru-user-setup','batoru-select',
    'batoru-loading','batoru-main','batoru-dead','batoru-ending'
  ];

  function btrShowScreen(id) {
    BTR_SCREENS.forEach(sid => {
      const el = document.getElementById(sid);
      if (!el) return;
      if (sid === id) {
        el.style.display = 'flex';
      } else {
        el.style.display = 'none';
      }
    });
  }

  /* ============================================================
     全局接口
     ============================================================ */
  window.BatoruApp = {
    open() {
      const app = document.getElementById('batoru-app');
      if (app) app.style.display = 'flex';
      btrShowScreen('batoru-lobby');
      btrStartGlitch();
      btrScheduleStatic();
      btrUpdateContinueBtn();
    },
    close() {
      const app = document.getElementById('batoru-app');
      if (app) app.style.display = 'none';
      btrStopGlitch();
      btrStopStatic();
      gs = null;
    }
  };

  /* ── 入口点击 ── */
  document.addEventListener('click', function (e) {
    const item = e.target.closest('.app-item[data-app="batoru"]');
    if (item && window.BatoruApp) window.BatoruApp.open();
  });

  /* ============================================================
     大厅
     ============================================================ */
  function btrUpdateContinueBtn() {
    const btn   = document.getElementById('btr-continue-btn');
    const saves = btrLoad(SAVES_KEY) || [];
    if (btn) {
      btn.disabled = saves.length === 0;
      btn.style.opacity = saves.length === 0 ? '0.35' : '';
    }
  }

  document.getElementById('btr-start-btn').addEventListener('click', () => {
    btrShowScreen('batoru-user-setup');
    document.getElementById('btr-user-name-input').value    = '';
    document.getElementById('btr-user-setting-input').value = '';
    document.querySelector('input[name="btr-mode"][value="player"]').checked = true;
  });

  document.getElementById('btr-continue-btn').addEventListener('click', () => {
    const saves = btrLoad(SAVES_KEY) || [];
    if (!saves.length) return;
    btrRenderSavesList(saves);
    document.getElementById('btr-saves-modal').style.display = 'flex';
  });

  document.getElementById('btr-quit-lobby-btn').addEventListener('click', () => {
    btrShowExitWarning(() => window.BatoruApp.close());
  });

  document.getElementById('btr-saves-close').addEventListener('click', () => {
    document.getElementById('btr-saves-modal').style.display = 'none';
  });

  document.getElementById('btr-saves-modal').addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none';
  });

  function btrRenderSavesList(saves) {
    const container = document.getElementById('btr-saves-list');
    container.innerHTML = '';
    saves.slice().reverse().forEach((save, revIdx) => {
      const realIdx = saves.length - 1 - revIdx;
      const div = document.createElement('div');
      div.className = 'btr-save-item';
      div.innerHTML =
        '<div class="btr-save-time">' + save.saveTime + '</div>' +
        '<div class="btr-save-info">' + save.dayLabel +
        ' &nbsp;·&nbsp; 存活 ' + save.aliveCount + ' 人</div>';
      div.addEventListener('click', () => {
        document.getElementById('btr-saves-modal').style.display = 'none';
        btrLoadSave(saves[realIdx]);
      });
      container.appendChild(div);
    });
  }

  function btrLoadSave(save) {
    gs = JSON.parse(JSON.stringify(save.gameState));
    btrEnterMainGame(true);
  }

  /* ============================================================
     用户设定界面
     ============================================================ */
  document.getElementById('btr-setup-back').addEventListener('click',  () => btrShowScreen('batoru-lobby'));
  document.getElementById('btr-setup-back2').addEventListener('click', () => btrShowScreen('batoru-lobby'));

  document.getElementById('btr-setup-next').addEventListener('click', () => {
    const name    = document.getElementById('btr-user-name-input').value.trim()
                 || btrLoad('liao_userName') || '幸存者';
    const setting = document.getElementById('btr-user-setting-input').value.trim();
    const mode    = document.querySelector('input[name="btr-mode"]:checked').value;

    gs = btrNewGameState();
    gs.mode            = mode;
    gs.userSetup       = { name, setting, mode };

    btrRenderRoleSelect();
    btrShowScreen('batoru-select');
  });

  /* ============================================================
     角色选择界面
     ============================================================ */
  let selectedRoleIds = new Set();

  document.getElementById('btr-select-back').addEventListener('click',  () => btrShowScreen('batoru-user-setup'));
  document.getElementById('btr-select-back2').addEventListener('click', () => btrShowScreen('batoru-user-setup'));

  function btrRenderRoleSelect() {
    selectedRoleIds = new Set();
    const grid  = document.getElementById('btr-role-grid');
    const hint  = document.getElementById('btr-select-hint');
    const roles = btrGetRoles();
    grid.innerHTML = '';

    const isPlayer = gs.userSetup.mode === 'player';

    if (isPlayer) {
      hint.textContent = '点击角色选择对手（可多选，你已固定参战）';
      const userCard = document.createElement('div');
      userCard.className = 'btr-role-card is-user selected';
      userCard.innerHTML =
        '<img class="btr-role-avatar" src="' + btrGetUserAvatar() + '" alt="">' +
        '<div class="btr-role-name">' + gs.userSetup.name + '</div>' +
        '<div class="btr-role-tag">（你）</div>';
      grid.appendChild(userCard);
    } else {
      hint.textContent = '旁观模式：至少选择2个角色';
    }

    roles.forEach(role => {
      const id   = String(role.id || role.realname || role.nickname || role.name || Math.random());
      const card = document.createElement('div');
      card.className = 'btr-role-card';
      card.dataset.roleId = id;
      card.innerHTML =
        '<img class="btr-role-avatar" src="' + btrGetRoleAvatar(role) + '" alt="">' +
        '<div class="btr-role-name">' + btrGetRoleName(role) + '</div>';
      card.addEventListener('click', () => {
        if (selectedRoleIds.has(id)) {
          selectedRoleIds.delete(id);
          card.classList.remove('selected');
        } else {
          selectedRoleIds.add(id);
          card.classList.add('selected');
        }
      });
      grid.appendChild(card);
    });
  }

  document.getElementById('btr-random-select').addEventListener('click', () => {
    const roles = btrGetRoles();
    if (!roles.length) { alert('角色库为空，请先在了了中添加角色'); return; }
    const count   = 2 + Math.floor(Math.random() * 4);
    const shuffled = roles.slice().sort(() => Math.random() - 0.5);
    const picked   = shuffled.slice(0, Math.min(count, shuffled.length));
    selectedRoleIds = new Set();
    document.querySelectorAll('#btr-role-grid .btr-role-card:not(.is-user)').forEach(c => {
      c.classList.remove('selected');
    });
    picked.forEach(role => {
      const id = String(role.id || role.realname || role.nickname || role.name || '');
      selectedRoleIds.add(id);
      const card = document.querySelector('#btr-role-grid .btr-role-card[data-role-id="' + id + '"]');
      if (card) card.classList.add('selected');
    });
  });

  document.getElementById('btr-select-start').addEventListener('click', async () => {
    const roles     = btrGetRoles();
    const isPlayer  = gs.userSetup.mode === 'player';
    const minSelect = isPlayer ? 1 : 2;

    if (selectedRoleIds.size < minSelect) {
      alert('至少选择 ' + minSelect + ' 个角色');
      return;
    }

    /* 构建参战者列表 */
    gs.participants = [];
    if (isPlayer) {
      gs.participants.push({
        id:      'user',
        name:    gs.userSetup.name,
        avatar:  btrGetUserAvatar(),
        setting: gs.userSetup.setting,
        isUser:  true
      });
    }
    roles.forEach(role => {
      const id = String(role.id || role.realname || role.nickname || role.name || '');
      if (selectedRoleIds.has(id)) {
        gs.participants.push({
          id,
          name:    btrGetRoleName(role),
          avatar:  btrGetRoleAvatar(role),
          setting: btrGetRoleSetting(role),
          isUser:  false
        });
      }
    });

    gs.aliveList = gs.participants.map(p => p.id);
    const total  = gs.participants.length;
    gs.totalDays = total <= 3 ? 4 : total <= 5 ? 6 : 8;

    btrShowScreen('batoru-loading');
    await btrGenerateOutline();
  });

  /* ============================================================
     大纲生成
     ============================================================ */
  async function btrGenerateOutline() {
    const progressBar = document.getElementById('btr-progress-bar');
    const subText     = document.getElementById('btr-loading-sub');

    /* 进度条假跑 */
    let fakeProgress = 0;
    const fakeTick = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + 1.2, 90);
      if (progressBar) progressBar.style.width = fakeProgress + '%';
    }, 300);

    const isPlayer = gs.userSetup.mode === 'player';

    let participantsDesc = '';
    gs.participants.forEach(p => {
      if (p.isUser) {
        participantsDesc += p.name + '（用户，' + (p.setting || '普通人') + '）\n';
      } else {
        participantsDesc += p.name + '（' + (p.setting || '普通人') + '）\n';
      }
    });

    const systemPrompt =
`你是一个文字大逃杀游戏的剧本编剧，请根据以下信息生成本局游戏的完整大纲。

【参战者信息】
${participantsDesc}

【场景】
从以下场景中随机选择一个：废旧居民楼、废弃医院、废旧游乐场、废弃工厂、荒废学校。

【大纲要求】
1. 游戏天数根据人数决定：2-3人共4天，4-5人共6天，6人及以上共8天，每天分早午晚三段
2. 严格按照以下格式输出，每行一个事件，不输出任何其他内容：
   第X天早：事件描述
   第X天午：事件描述
   第X天晚：事件描述
3. 事件描述最简短直接，例如："角色A用铁管击杀角色B""用户在三楼发现急救包""角色C与角色D结盟"
4. 禁止阴谋论，禁止科幻元素，所有事件必须符合现实逻辑
5. 考虑每个参战者的设定和能力，生成符合其性格的行为
6. 所有参战者互为陌生人${isPlayer ? '（包括用户）' : '（如果两个角色设定中明确提到认识对方则可以有相识互动）'}
7. 必须包含：至少一次结盟、至少一次背刺、至少一次出人意料的反转${isPlayer ? '、至少一次用户与角色的正面相遇' : ''}
8. 死亡必须有逻辑（体力耗尽、物资断绝、人数劣势、受伤后遗症等）
9. 最终只有一名存活者
10. 结尾另起一行输出场景名称，格式：【场景：XXX】`;

    try {
      const raw = await btrCallAPI([
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: '请生成大纲。' }
      ]);

      clearInterval(fakeTick);
      if (progressBar) progressBar.style.width = '100%';

      /* 解析大纲 */
      const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const sceneMatch = raw.match(/【场景[：:]\s*(.+?)】/);
      gs.scene   = sceneMatch ? sceneMatch[1].trim() : '废弃建筑';
      gs.outline = lines.filter(l => /^第\d+天[早午晚]/.test(l));

      if (subText) subText.textContent = '大纲生成完毕，进入游戏……';

      setTimeout(() => {
        btrEnterMainGame(false);
      }, 800);

    } catch (err) {
      clearInterval(fakeTick);
      if (progressBar) progressBar.style.width = '0%';
      if (subText) subText.textContent = '生成失败：' + err.message + '，请检查API配置后重试';
      alert('大纲生成失败：' + err.message);
      btrShowScreen('batoru-select');
    }
  }

  /* ============================================================
     进入游戏主界面
     ============================================================ */
  function btrEnterMainGame(fromSave) {
    btrShowScreen('batoru-main');
    btrUpdateDayLabel();
    btrUpdateBroadcast();
    btrUpdateAttrPanel();

    /* 模式相关UI */
    const choicesArea = document.getElementById('btr-choices-area');
    const nextWrap    = document.getElementById('btr-next-btn-wrap');
    const chatWrap    = document.getElementById('btr-chat-input-wrap');

    if (gs.mode === 'spectator' || gs.isUserDead) {
      if (choicesArea) choicesArea.style.display = 'none';
      if (nextWrap)    nextWrap.style.display    = 'block';
      if (chatWrap)    chatWrap.style.display    = 'none';
    } else {
      if (choicesArea) choicesArea.style.display = 'block';
      if (nextWrap)    nextWrap.style.display    = 'none';
      if (chatWrap)    chatWrap.style.display    = 'block';
    }

    if (fromSave) {
      /* 恢复最后一段叙事 */
      const narrativeArea = document.getElementById('btr-narrative-area');
      if (narrativeArea && gs.narrativeHistory.length) {
        const last = gs.narrativeHistory[gs.narrativeHistory.length - 1];
        btrAppendNarrative(last, false);
      }
      /* 恢复广播 */
      btrRefreshBroadcast();
    } else {
      /* 开场白 */
      btrRunOpeningAndFirstSegment();
    }
  }

  /* ============================================================
     开场白 + 第一段叙事
     ============================================================ */
  async function btrRunOpeningAndFirstSegment() {
    const narrativeArea = document.getElementById('btr-narrative-area');
    if (!narrativeArea) return;

    const opening =
      '【系统广播】\n' +
      '恭喜各位进入「生存游戏」。\n' +
      '地点：' + gs.scene + '。\n' +
      '游戏规则：最后一名存活者方可离开。禁止外部求援。\n' +
      '物资有限，信任危险。\n' +
      '游戏即将开始……\n' +
      '—— 祝各位好运。';

    btrAppendNarrative(opening, true);

    /* 隐藏选项，等待开场结束 */
    const choicesArea = document.getElementById('btr-choices-area');
    if (choicesArea) choicesArea.style.display = 'none';

    setTimeout(async () => {
      await btrRunSegment(null);
    }, 1800);
  }

  /* ============================================================
     核心：运行一个时间段
     ============================================================ */
  async function btrRunSegment(userAction) {
    if (!gs || gs.gameOver) return;

    /* 锁定选项 */
    btrSetChoicesEnabled(false);
    const nextBtn = document.getElementById('btr-next-segment');
    if (nextBtn) nextBtn.disabled = true;

    const isPlayer  = gs.mode === 'player' && !gs.isUserDead;
    const dayLabel  = btrDayLabel(gs.currentDayIndex);
    const outlineEntry = gs.outline[gs.currentDayIndex] || '';

    /* 构建历史摘要 */
    const histSummary = gs.narrativeHistory.slice(-4).join('\n\n---\n\n');

    /* 构建参战者信息 */
    let participantsDesc = '';
    gs.participants.forEach(p => {
      participantsDesc += (p.isUser ? p.name + '（用户）' : p.name) +
        '：' + (p.setting || '普通人') + '\n';
    });

    /* 存活者 */
    const aliveNames = gs.aliveList.map(id => {
      const p = gs.participants.find(x => x.id === id);
      return p ? p.name : id;
    }).join('、');

    /* 用户属性 */
    const statsDesc = isPlayer
      ? `用户当前状态：血量${gs.userStats.hp}，饥饿值${gs.userStats.hunger}，体力${gs.userStats.stamina}，位置：${gs.userStats.location}，状态：${gs.userStats.statusTags.join('/')}`
      : '';

    const systemPrompt =
`【参战者设定】
${participantsDesc}

【本局大纲（必须严格遵守）】
${gs.outline.join('\n')}

【当前游戏状态】
时间段：${dayLabel}
场景：${gs.scene}
存活者：${aliveNames}
${statsDesc}

【历史叙事摘要（最近4段）】
${histSummary || '（游戏刚开始）'}

【输出格式要求】
请严格按照以下格式输出，每个标签单独一行：

【叙事】
本时间段的详细叙事（300-500字，恐怖悬疑风格，${isPlayer ? '用第二人称描述用户视角' : '第三人称全局视角'}）

【对话】
[角色名]："对话内容"
（如无对话可省略此块）

${isPlayer ? `【选项】
A. 选项A
B. 选项B
C. 选项C

【属性变化】
血量:±数值 饥饿:-数值 体力:±数值

` : ''}【广播】
本时间段广播内容（简短）

【弹幕】
弹幕1|弹幕2|弹幕3

【物品】
（如用户捡到物品则写：物品名称:emoji:数量，否则省略此块）

【游戏状态】
存活:存活者名字用逗号分隔
结束:否/是`;

    const userContent = isPlayer
      ? `当前时间段：${dayLabel}\n用户选择的行动：${userAction || '观察周围环境'}\n${gs.pendingChat ? '用户说的话：' + gs.pendingChat : ''}`
      : `当前时间段：${dayLabel}\n请生成本时间段所有角色的行动和互动叙事。`;

    gs.pendingChat = '';

    try {
      const raw = await btrCallAPI([
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent }
      ]);

      btrParseAndApplySegment(raw, dayLabel);

    } catch (err) {
      btrAppendNarrative('【通信中断】……信号异常……请稍后再试（' + err.message + '）', true);
      btrSetChoicesEnabled(true);
      if (nextBtn) nextBtn.disabled = false;
    }
  }

  /* ============================================================
     解析 AI 返回并应用
     ============================================================ */
  function btrParseAndApplySegment(raw, dayLabel) {
    /* ── 提取各块 ── */
    function extract(tag) {
      const re  = new RegExp('【' + tag + '】\\s*([\\s\\S]*?)(?=\\n【|$)', 'i');
      const m   = raw.match(re);
      return m ? m[1].trim() : '';
    }

    const narrative   = extract('叙事');
    const dialogue    = extract('对话');
    const optionsRaw  = extract('选项');
    const attrRaw     = extract('属性变化');
    const broadcast   = extract('广播');
    const danmakuRaw  = extract('弹幕');
    const itemRaw     = extract('物品');
    const statusRaw   = extract('游戏状态');

    /* ── 叙事 + 对话渲染 ── */
    let fullNarrative = narrative;
    if (dialogue) {
      fullNarrative += '\n\n' + dialogue;
    }
    btrAppendNarrative(fullNarrative, true);
    gs.narrativeHistory.push(fullNarrative);
    if (gs.narrativeHistory.length > 6) gs.narrativeHistory.shift();

    /* ── 广播 ── */
    if (broadcast) {
      gs.broadcastQueue.push(broadcast);
      btrRefreshBroadcast();
    }

    /* ── 弹幕 ── */
    if (danmakuRaw) {
      const items = danmakuRaw.split('|').map(s => s.trim()).filter(Boolean);
      items.forEach(t => {
        gs.danmakuHistory.push(t);
        if (btrDanmakuEnabled) btrLaunchDanmaku(t, 'btr-danmaku-layer');
      });
    }

    /* ── 属性变化 ── */
    if (attrRaw && gs.mode === 'player' && !gs.isUserDead) {
      const hpM  = attrRaw.match(/血量[:：]\s*([+-]?\d+)/);
      const huM  = attrRaw.match(/饥饿[:：]\s*([+-]?\d+)/);
      const stM  = attrRaw.match(/体力[:：]\s*([+-]?\d+)/);
      if (hpM) gs.userStats.hp      = Math.min(100, Math.max(0, gs.userStats.hp      + parseInt(hpM[1])));
      if (huM) gs.userStats.hunger  = Math.min(100, Math.max(0, gs.userStats.hunger  + parseInt(huM[1])));
      if (stM) gs.userStats.stamina = Math.min(100, Math.max(0, gs.userStats.stamina + parseInt(stM[1])));
      /* 饥饿=0 扣血 */
      if (gs.userStats.hunger <= 0) gs.userStats.hp = Math.max(0, gs.userStats.hp - 5);
      btrUpdateAttrPanel();
    }

    /* ── 自然饥饿递减（每段 -10） ── */
    if (gs.mode === 'player' && !gs.isUserDead) {
      gs.userStats.hunger = Math.max(0, gs.userStats.hunger - 10);
      gs.userStats.stamina = Math.max(0, gs.userStats.stamina - 8);
      btrUpdateAttrPanel();
    }

    /* ── 物品 ── */
    if (itemRaw && gs.mode === 'player' && !gs.isUserDead) {
      const parts = itemRaw.split(':');
      if (parts.length >= 2 && gs.inventory.length < 12) {
        gs.inventory.push({
          name:  parts[0].trim(),
          emoji: parts[1].trim(),
          qty:   parseInt(parts[2]) || 1
        });
        btrRenderBag();
      }
    }

    /* ── 存活者列表 ── */
    if (statusRaw) {
      const aliveMatch = statusRaw.match(/存活[:：]\s*(.+)/);
      if (aliveMatch) {
        const aliveNames = aliveMatch[1].split(/[,，]/).map(s => s.trim()).filter(Boolean);
        gs.aliveList = gs.participants
          .filter(p => aliveNames.some(n => p.name.includes(n) || n.includes(p.name)))
          .map(p => p.id);
      }

      const endMatch = statusRaw.match(/结束[:：]\s*(是|否)/);
      if (endMatch && endMatch[1] === '是') {
        gs.gameOver = true;
      }
    }

    /* ── 检测用户死亡 ── */
    if (gs.mode === 'player' && !gs.isUserDead) {
      const userAlive = gs.aliveList.includes('user');
      if (!userAlive || gs.userStats.hp <= 0) {
        gs.isUserDead = true;
        setTimeout(() => btrShowScreen('batoru-dead'), 1200);
        return;
      }
    }

    /* ── 游戏结束 ── */
    if (gs.gameOver || gs.currentDayIndex >= gs.totalDays * 3 - 1) {
      gs.gameOver = true;
      const winner = gs.aliveList.length > 0
        ? (gs.participants.find(p => p.id === gs.aliveList[0]) || { name: '不明' }).name
        : '无人';
      gs.winner = winner;
      setTimeout(() => btrTriggerEnding(), 1500);
      return;
    }

    /* ── 推进到下一个时间段 ── */
    gs.currentDayIndex++;
    btrUpdateDayLabel();

    /* ── 渲染选项 ── */
    if (gs.mode === 'player' && !gs.isUserDead) {
      const labels  = ['A', 'B', 'C'];
      const optLines = optionsRaw.split('\n')
        .map(l => l.trim())
        .filter(l => /^[ABC][.。]/.test(l));

      const choices = optLines.map((l, i) => ({
        label: labels[i] || String.fromCharCode(65 + i),
        text:  l.replace(/^[ABC][.。]\s*/, '')
      }));

      btrRenderChoices(choices);
      btrSetChoicesEnabled(true);
    } else {
      const nextBtn = document.getElementById('btr-next-segment');
      if (nextBtn) { nextBtn.disabled = false; }
    }
  }

  /* ============================================================
     叙事文字渲染
     ============================================================ */
  function btrAppendNarrative(text, scroll) {
    const area = document.getElementById('btr-narrative-area');
    if (!area) return;

    const lines = text.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      /* 对话行 */
      const dialogueMatch = trimmed.match(/^\[(.+?)\][：:][""](.+)[""]$/);
      if (dialogueMatch) {
        const div  = document.createElement('div');
        div.className = 'btr-dialogue-line';
        const name = document.createElement('span');
        name.className   = 'btr-dialogue-name';
        name.textContent = '[' + dialogueMatch[1] + ']：';
        const content = document.createElement('span');
        content.className   = 'btr-dialogue-text';
        content.textContent = '"' + dialogueMatch[2] + '"';
        div.appendChild(name);
        div.appendChild(content);
        area.appendChild(div);
      } else {
        const p = document.createElement('p');
        p.className   = 'btr-narrative-para';
        p.textContent = trimmed;
        area.appendChild(p);
      }
    });

    if (scroll) {
      area.scrollTop = area.scrollHeight;
    }
  }

  /* ============================================================
     选项渲染
     ============================================================ */
  function btrRenderChoices(choices) {
    const list = document.getElementById('btr-choices-list');
    const area = document.getElementById('btr-choices-area');
    const customWrap = document.getElementById('btr-custom-input-wrap');
    if (!list) return;

    list.innerHTML = '';
    if (customWrap) customWrap.style.display = 'none';

    choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'btr-choice-btn';
      btn.innerHTML =
        '<span class="btr-choice-label">' + choice.label + '.</span>' + choice.text;
      btn.addEventListener('click', () => {
        btrSetChoicesEnabled(false);
        btrRunSegment(choice.text);
      });
      list.appendChild(btn);
    });

    /* 选项D：自行输入 */
    const customBtn = document.createElement('button');
    customBtn.className = 'btr-choice-btn';
    customBtn.innerHTML = '<span class="btr-choice-label">D.</span>✎ 自行输入行动';
    customBtn.addEventListener('click', () => {
      if (customWrap) {
        customWrap.style.display = customWrap.style.display === 'none' ? 'flex' : 'none';
      }
    });
    list.appendChild(customBtn);

    if (area) area.style.display = 'block';
  }

  function btrSetChoicesEnabled(enabled) {
    document.querySelectorAll('.btr-choice-btn').forEach(btn => {
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? '1' : '0.5';
    });
  }

  /* 自定义行动确认 */
  document.getElementById('btr-custom-action-confirm').addEventListener('click', () => {
    const input = document.getElementById('btr-custom-action-input');
    const val   = input ? input.value.trim() : '';
    if (!val) return;
    if (input) input.value = '';
    const customWrap = document.getElementById('btr-custom-input-wrap');
    if (customWrap) customWrap.style.display = 'none';
    btrSetChoicesEnabled(false);
    btrRunSegment(val);
  });

  document.getElementById('btr-custom-action-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      document.getElementById('btr-custom-action-confirm').click();
    }
  });

  /* 旁观模式下一段 */
  document.getElementById('btr-next-segment').addEventListener('click', () => {
    btrRunSegment(null);
  });

  /* 对话框输入记录（不立即发送，等下次行动注入） */
  document.getElementById('btr-chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const input = document.getElementById('btr-chat-input');
      const val   = input ? input.value.trim() : '';
      if (!val) return;
      gs.pendingChat = val;
      if (input) input.value = '';
      /* 在叙事区显示用户说话 */
      btrAppendNarrative('[你低声说]："' + val + '"', true);
    }
  });

  /* ============================================================
     广播栏
     ============================================================ */
  function btrRefreshBroadcast() {
    const inner = document.getElementById('btr-broadcast-inner');
    if (!inner || !gs) return;
    const base   = '大逃杀游戏进行中……' + gs.scene + '……';
    const recent = gs.broadcastQueue.slice(-5).join(' …… ');
    inner.textContent = base + (recent ? ' …… ' + recent : '');
    /* 重启动画 */
    inner.style.animation = 'none';
    inner.offsetHeight;
    inner.style.animation = '';
  }

  function btrUpdateBroadcast() { btrRefreshBroadcast(); }

  /* ============================================================
     天数标签
     ============================================================ */
  function btrUpdateDayLabel() {
    const el = document.getElementById('btr-day-label');
    if (el && gs) el.textContent = btrDayLabel(gs.currentDayIndex);
  }

  /* ============================================================
     属性面板
     ============================================================ */
  function btrUpdateAttrPanel() {
    if (!gs) return;
    const s = gs.userStats;
    const setBar = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.style.width = Math.max(0, Math.min(100, val)) + '%';
    };
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = Math.round(val);
    };
    setBar('btr-bar-hp',      s.hp);
    setBar('btr-bar-hunger',  s.hunger);
    setBar('btr-bar-stamina', s.stamina);
    setVal('btr-attr-hp-val',      s.hp);
    setVal('btr-attr-hunger-val',  s.hunger);
    setVal('btr-attr-stamina-val', s.stamina);
    const locEl = document.getElementById('btr-attr-location');
    if (locEl) locEl.textContent = s.location || '未知';
    const stEl = document.getElementById('btr-attr-status');
    if (stEl) stEl.textContent = (s.statusTags || ['正常']).join('/');
  }

  /* ============================================================
     背包
     ============================================================ */
  let btrSelectedItemIdx = -1;

  function btrRenderBag() {
    const grid  = document.getElementById('btr-bag-grid');
    const count = document.getElementById('btr-bag-count');
    const hint  = document.getElementById('btr-bag-full-hint');
    if (!grid || !gs) return;

    grid.innerHTML = '';
    const inv = gs.inventory;
    if (count) count.textContent = inv.length + '/12';
    if (hint)  hint.style.display = inv.length >= 12 ? 'block' : 'none';

    for (let i = 0; i < 12; i++) {
      const cell = document.createElement('div');
      if (i < inv.length) {
        cell.className = 'btr-bag-cell has-item';
        cell.innerHTML =
          '<div class="btr-bag-emoji">' + (inv[i].emoji || '📦') + '</div>' +
          '<div class="btr-bag-item-name">' + inv[i].name + '</div>';
        const idx = i;
        cell.addEventListener('click', () => btrOpenItemAction(idx));
      } else {
        cell.className = 'btr-bag-cell empty';
      }
      grid.appendChild(cell);
    }

    /* 隐藏操作菜单 */
    const menu = document.getElementById('btr-item-action-menu');
    if (menu) menu.style.display = 'none';
    btrSelectedItemIdx = -1;
  }

  function btrOpenItemAction(idx) {
    btrSelectedItemIdx = idx;
    const item = gs.inventory[idx];
    if (!item) return;
    const menu    = document.getElementById('btr-item-action-menu');
    const nameEl  = document.getElementById('btr-item-action-name');
    const giveWrap = document.getElementById('btr-give-target-wrap');
    if (nameEl)  nameEl.textContent = item.emoji + ' ' + item.name;
    if (giveWrap) giveWrap.style.display = 'none';
    if (menu) menu.style.display = 'flex';
  }

  document.getElementById('btr-item-use').addEventListener('click', () => {
    if (btrSelectedItemIdx < 0 || !gs) return;
    const item = gs.inventory[btrSelectedItemIdx];
    if (!item) return;
    /* 简单效果：急救包恢复血量 */
    if (item.name.includes('急救') || item.name.includes('药')) {
      gs.userStats.hp = Math.min(100, gs.userStats.hp + 30);
      btrUpdateAttrPanel();
    } else if (item.name.includes('食物') || item.name.includes('水') || item.name.includes('罐头')) {
      gs.userStats.hunger = Math.min(100, gs.userStats.hunger + 40);
      btrUpdateAttrPanel();
    }
    gs.inventory.splice(btrSelectedItemIdx, 1);
    btrRenderBag();
  });

  document.getElementById('btr-item-discard').addEventListener('click', () => {
    if (btrSelectedItemIdx < 0 || !gs) return;
    gs.inventory.splice(btrSelectedItemIdx, 1);
    btrRenderBag();
  });

  document.getElementById('btr-item-give').addEventListener('click', () => {
    const giveWrap = document.getElementById('btr-give-target-wrap');
    const targetList = document.getElementById('btr-give-target-list');
    if (!giveWrap || !targetList || !gs) return;

    targetList.innerHTML = '';
    const aliveOthers = gs.participants.filter(
      p => !p.isUser && gs.aliveList.includes(p.id)
    );
    if (!aliveOthers.length) {
      giveWrap.style.display = 'block';
      targetList.innerHTML = '<div style="font-size:11px;color:#9a8880;">附近无可赠送对象</div>';
      return;
    }
    aliveOthers.forEach(p => {
      const btn = document.createElement('button');
      btn.className   = 'btr-btn btr-btn-ghost';
      btn.textContent = p.name;
      btn.style.cssText = 'margin-top:6px;width:100%;font-size:12px;';
      btn.addEventListener('click', () => {
        if (btrSelectedItemIdx < 0) return;
        gs.inventory.splice(btrSelectedItemIdx, 1);
        btrRenderBag();
        btrAppendNarrative('你将物品赠送给了' + p.name + '。', true);
      });
      targetList.appendChild(btn);
    });
    giveWrap.style.display = 'block';
  });

  document.getElementById('btr-item-action-cancel').addEventListener('click', () => {
    const menu = document.getElementById('btr-item-action-menu');
    if (menu) menu.style.display = 'none';
    btrSelectedItemIdx = -1;
  });

  document.getElementById('btr-bag-btn').addEventListener('click', () => {
    btrRenderBag();
    document.getElementById('btr-bag-modal').style.display = 'flex';
  });

  document.getElementById('btr-bag-close').addEventListener('click', () => {
    document.getElementById('btr-bag-modal').style.display = 'none';
  });

  document.getElementById('btr-bag-modal').addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none';
  });

  /* ============================================================
     属性弹窗
     ============================================================ */
  document.getElementById('btr-attr-btn').addEventListener('click', () => {
    btrUpdateAttrPanel();
    document.getElementById('btr-attr-modal').style.display = 'flex';
  });

  document.getElementById('btr-attr-close').addEventListener('click', () => {
    document.getElementById('btr-attr-modal').style.display = 'none';
  });

  document.getElementById('btr-attr-modal').addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none';
  });

  /* ============================================================
     弹幕
     ============================================================ */
  let btrDanmakuEnabled = false;

  document.getElementById('btr-danmaku-btn').addEventListener('click', () => {
    btrDanmakuEnabled = !btrDanmakuEnabled;
    const btn = document.getElementById('btr-danmaku-btn');
    if (btn) btn.classList.toggle('active', btrDanmakuEnabled);
    if (btrDanmakuEnabled && gs) {
      /* 回放历史弹幕 */
      gs.danmakuHistory.slice(-5).forEach((t, i) => {
        setTimeout(() => btrLaunchDanmaku(t, 'btr-danmaku-layer'), i * 600);
      });
    }
  });

  function btrLaunchDanmaku(text, layerId) {
    const layer = document.getElementById(layerId);
    if (!layer) return;
    const el = document.createElement('div');
    el.className  = 'btr-danmaku-item';
    el.textContent = text;
    const topPct  = 10 + Math.random() * 75;
    const duration = 6 + Math.random() * 4;
    el.style.top      = topPct + '%';
    el.style.animationDuration = duration + 's';
    layer.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, (duration + 1) * 1000);
  }

  /* ============================================================
     菜单
     ============================================================ */
  document.getElementById('btr-menu-trigger').addEventListener('click', function () {
    const menu = document.getElementById('btr-side-menu');
    if (!menu) return;
    const isOpen = menu.style.display !== 'none';
    menu.style.display = isOpen ? 'none' : 'block';
    this.classList.toggle('open', !isOpen);
  });

  /* 点击其他地方关闭菜单 */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#btr-menu-trigger') && !e.target.closest('#btr-side-menu')) {
      const menu = document.getElementById('btr-side-menu');
      const trigger = document.getElementById('btr-menu-trigger');
      if (menu) menu.style.display = 'none';
      if (trigger) trigger.classList.remove('open');
    }
  });

  document.getElementById('btr-save-game').addEventListener('click', () => {
    btrDoSave();
    const menu = document.getElementById('btr-side-menu');
    if (menu) menu.style.display = 'none';
    const trigger = document.getElementById('btr-menu-trigger');
    if (trigger) trigger.classList.remove('open');
  });

  document.getElementById('btr-exit-game').addEventListener('click', () => {
    const menu = document.getElementById('btr-side-menu');
    if (menu) menu.style.display = 'none';
    const trigger = document.getElementById('btr-menu-trigger');
    if (trigger) trigger.classList.remove('open');
    btrShowExitWarning(() => {
      btrShowScreen('batoru-lobby');
      btrUpdateContinueBtn();
    });
  });

  /* ============================================================
     存档
     ============================================================ */
  function btrDoSave() {
    if (!gs) return;
    const now  = new Date();
    const pad  = n => String(n).padStart(2, '0');
    const time = now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate()) +
                 ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());

    const record = {
      id:         'save_' + Date.now(),
      saveTime:   time,
      dayLabel:   btrDayLabel(gs.currentDayIndex),
      aliveCount: gs.aliveList.length,
      gameState:  JSON.parse(JSON.stringify(gs))
    };

    let saves = btrLoad(SAVES_KEY) || [];
    saves.push(record);
    if (saves.length > MAX_SAVES) saves = saves.slice(-MAX_SAVES);
    btrSave(SAVES_KEY, saves);
    btrAppendNarrative('【存档成功】' + time, false);
  }

  /* ============================================================
     退出警告弹窗（递进式）
     ============================================================ */
  const EXIT_WARN_TEXTS = [
    { title: '⚠ 确认退出', text: '退出将丢失未存档的进度，确定要退出吗？' },
    { title: '⚠ 真的要退出吗？', text: '你确定……？游戏进度将无法恢复。' },
    { title: '⚠ 你确定吗？', text: '最后一次确认！真的要离开吗？' },
    { title: '⚠ 警告！警告！警告！', text: '……好吧。点取消，真正退出。' },
    { title: '⚠ ！！！', text: '好的我知道了……点取消退出，点确定继续劝你。' }
  ];

  function btrShowExitWarning(onConfirmFinal, depth) {
    depth = depth || 0;
    const layer = document.getElementById('btr-exit-warnings');
    if (!layer) return;
    layer.style.display = 'block';

    const info = EXIT_WARN_TEXTS[Math.min(depth, EXIT_WARN_TEXTS.length - 1)];

    const mask = document.createElement('div');
    mask.className = 'btr-warn-mask';

    const box = document.createElement('div');
    box.className = 'btr-warn-box';
    box.innerHTML =
      '<div class="btr-warn-title">' + info.title + '</div>' +
      '<div class="btr-warn-text">' + info.text + '</div>' +
      '<div class="btr-warn-btns">' +
        '<button class="btr-warn-confirm">确定退出</button>' +
        '<button class="btr-warn-cancel">取消</button>' +
      '</div>';

    mask.appendChild(box);
    layer.appendChild(mask);

    /* 点击遮罩关闭（取消退出） */
    mask.addEventListener('click', function (e) {
      if (e.target === mask) {
        layer.removeChild(mask);
        if (!layer.children.length) layer.style.display = 'none';
      }
    });

    box.querySelector('.btr-warn-confirm').addEventListener('click', () => {
      layer.removeChild(mask);
      /* 继续加深警告，或者已经到最深层 */
      if (depth >= EXIT_WARN_TEXTS.length - 1) {
        /* 最深层确定依然加一层 */
        btrShowExitWarning(onConfirmFinal, depth);
      } else {
        btrShowExitWarning(onConfirmFinal, depth + 1);
      }
    });

    box.querySelector('.btr-warn-cancel').addEventListener('click', () => {
      /* 取消 = 真正退出 */
      while (layer.firstChild) layer.removeChild(layer.firstChild);
      layer.style.display = 'none';
      onConfirmFinal();
    });
  }

  /* ============================================================
     用户被淘汰
     ============================================================ */
  document.getElementById('btr-dead-watch').addEventListener('click', () => {
    /* 切换为旁观模式继续 */
    gs.mode        = 'spectator';
    gs.isUserDead  = true;
    btrShowScreen('batoru-main');
    const choicesArea = document.getElementById('btr-choices-area');
    const nextWrap    = document.getElementById('btr-next-btn-wrap');
    const chatWrap    = document.getElementById('btr-chat-input-wrap');
    if (choicesArea) choicesArea.style.display = 'none';
    if (nextWrap)    nextWrap.style.display    = 'block';
    if (chatWrap)    chatWrap.style.display    = 'none';
    btrAppendNarrative('……你的意识飘离了身体，化作一缕幽魂，继续旁观这场游戏……', true);
  });

  document.getElementById('btr-dead-exit').addEventListener('click', () => {
    btrShowScreen('batoru-lobby');
    btrUpdateContinueBtn();
  });

  /* ============================================================
     结局界面
     ============================================================ */
  async function btrTriggerEnding() {
    btrShowScreen('batoru-ending');

    const winner     = gs.winner || '不明';
    const totalDays  = Math.ceil((gs.currentDayIndex + 1) / 3);
    const eliminated = gs.participants.length - gs.aliveList.length;

    const winnerEl = document.getElementById('btr-ending-winner');
    if (winnerEl) winnerEl.textContent = '存活者：' + winner;

    const statsEl = document.getElementById('btr-ending-stats');
    if (statsEl) statsEl.textContent =
      '游戏历时 ' + totalDays + ' 天  ·  共淘汰 ' + eliminated + ' 人';

    /* 生成最后一句话 */
    const lastWordsEl = document.getElementById('btr-ending-last-words');
    if (lastWordsEl) {
      lastWordsEl.innerHTML = '<div style="color:#9a8880;font-size:11px;padding:10px 0;">正在生成最终遗言……</div>';
    }

    try {
      const participantsDesc = gs.participants.map(p =>
        p.name + '（' + (p.setting || '普通人') + '，' +
        (gs.aliveList.includes(p.id) ? '存活' : '已淘汰') + '）'
      ).join('\n');

      const outlineSum = gs.outline.join('\n');

      const systemPrompt =
        '根据以下大逃杀游戏的角色信息和剧情大纲，为每位参战者生成一句简短有力的最后遗言或胜利感言（不超过30字），符合其性格和经历。\n' +
        '格式：角色真实姓名："遗言内容"\n只输出遗言，每人一行，不输出其他文字。\n\n' +
        '【参战者信息】\n' + participantsDesc + '\n\n【剧情大纲】\n' + outlineSum + '\n\n' +
        '同时在最后另起一行输出10-15条上帝视角的弹幕点评，格式：【弹幕】弹幕1|弹幕2|弹幕3...';

      const raw = await btrCallAPI([
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: '请生成遗言和弹幕。' }
      ]);

      /* 解析遗言 */
      if (lastWordsEl) {
        lastWordsEl.innerHTML = '';
        const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
        lines.forEach(line => {
          if (line.startsWith('【弹幕】')) {
            /* 处理弹幕 */
            const danmakuPart = line.replace('【弹幕】', '');
            danmakuPart.split('|').forEach((t, i) => {
              const text = t.trim();
              if (!text) return;
              setTimeout(() => btrLaunchDanmaku(text, 'btr-ending-danmaku-layer'), i * 500);
            });
            return;
          }
          const match = line.match(/^(.+?)[：:""](.+)[""]?$/);
          if (!match) return;
          const name = match[1].trim();
          const word = match[2].replace(/[""]$/, '').trim();
          const item = document.createElement('div');
          item.className = 'btr-last-word-item';
          item.innerHTML =
            '<span class="btr-last-word-name">' + name + '</span>' +
            '<span class="btr-last-word-text">"' + word + '"</span>';
          lastWordsEl.appendChild(item);
        });
      }

    } catch (err) {
      if (lastWordsEl) {
        lastWordsEl.innerHTML = '<div style="color:#9a8880;font-size:11px;padding:10px 0;">遗言生成失败：' + err.message + '</div>';
      }
    }
  }

  document.getElementById('btr-ending-restart').addEventListener('click', () => {
    gs = null;
    btrShowScreen('batoru-user-setup');
    document.getElementById('btr-user-name-input').value    = '';
    document.getElementById('btr-user-setting-input').value = '';
    document.querySelector('input[name="btr-mode"][value="player"]').checked = true;
    /* 清空叙事区 */
    const narrativeArea = document.getElementById('btr-narrative-area');
    if (narrativeArea) narrativeArea.innerHTML = '';
    /* 清空结局弹幕 */
    const endLayer = document.getElementById('btr-ending-danmaku-layer');
    if (endLayer) endLayer.innerHTML = '';
  });

  document.getElementById('btr-ending-exit').addEventListener('click', () => {
    btrShowScreen('batoru-lobby');
    btrUpdateContinueBtn();
    const endLayer = document.getElementById('btr-ending-danmaku-layer');
    if (endLayer) endLayer.innerHTML = '';
  });

})();
