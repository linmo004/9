/* ============================================================
   rolephone.js — 角色手机 App 完整逻辑
   ============================================================ */
/* ================================================================
   统一按钮点击分发（解决 lucide 图标子元素拦截问题）
   ================================================================ */
document.addEventListener('click', function (e) {
  if (!e.target || !e.target.closest) return;

  /* Dock：主页 */
  if (e.target.closest('#rp-dock-home-btn')) {
    rpShowView('rp-home-view');
    rpInitHome();
    return;
  }

  /* Dock：关闭 */
  if (e.target.closest('#rp-dock-back-btn')) {
    rpClose();
    return;
  }

  /* Dock：通话记录 */
  if (e.target.closest('#rp-dock-call-btn')) {
    rpShowView('rp-call-view');
    rpInitCallApp();
    return;
  }

  /* 屏幕健康 + */
  if (e.target.closest('#rp-health-add-btn')) {
    if (!rpCurrentRole) { alert('角色信息未加载'); return; }
    var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
    var roleSetting = rpCurrentRole.setting || '';
    var extraLimit  = (rpCurrentRoleData.appPromptLimits && rpCurrentRoleData.appPromptLimits.health) || '';
    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。\n' +
      (extraLimit ? '额外要求：' + extraLimit + '\n' : '') +
      '请生成角色今天使用手机各App的时长数据，6到10个App，总时长不超过8小时。\n' +
      '请直接输出一个JSON数组，格式如下，不要输出任何其他内容：\n' +
      '[{"name":"微信","icon":"💬","minutes":87},{"name":"抖音","icon":"🎵","minutes":45}]';
    rpShowLoading();
    rpCallAPI([{ role: 'system', content: systemPrompt }],
      function (raw) {
        rpHideLoading();
        var apps = rpExtractJSON(raw, 'array');
        if (!apps || !apps.length) { alert('生成失败，请重试'); return; }
        var today = new Date().toDateString();
        var records = rpCurrentRoleData.screenHealth || [];
        var existIdx = records.findIndex(function (r) { return r.date === today; });
        var newRecord = { date: today, apps: apps };
        if (existIdx >= 0) records[existIdx] = newRecord; else records.unshift(newRecord);
        rpCurrentRoleData.screenHealth = records;
        rpSave(rpCurrentRoleId, rpCurrentRoleData);
        rpRenderHealthData();
      },
      function (err) { rpHideLoading(); alert('API 请求失败：' + err); }
    );
    return;
  }

  /* 梦境 + */
  if (e.target.closest('#rp-dream-add-btn')) {
    if (!rpCurrentRole) { alert('角色信息未加载'); return; }
    var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
    var roleSetting = rpCurrentRole.setting || '';
    var now = new Date();
    var dateStr = now.getFullYear() + '年' + (now.getMonth()+1) + '月' + now.getDate() + '日';
    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。\n' +
      '请以角色第一人称生成一段昨晚的梦境记录，200字左右，意象丰富，贴合角色性格。\n' +
      '只输出一个JSON对象，格式：{"title":"梦境标题一句话","date":"' + dateStr + '","mood":"醒来的心情一词","content":"梦境正文"}\n' +
      '不输出任何其他内容。';
    rpShowLoading();
    rpCallAPI([{ role: 'system', content: systemPrompt }],
      function (raw) {
        rpHideLoading();
        var parsed = rpExtractJSON(raw, 'object');
        if (!parsed || !parsed.content) { alert('生成失败，请重试'); return; }
        rpCurrentRoleData.dreams.unshift({
          id: 'dream_' + Date.now(), title: parsed.title || '梦境',
          date: parsed.date || dateStr, mood: parsed.mood || '',
          content: parsed.content || '', ts: Date.now()
        });
        rpSave(rpCurrentRoleId, rpCurrentRoleData);
        rpRenderDreamList();
      },
      function (err) { rpHideLoading(); alert('API 请求失败：' + err); }
    );
    return;
  }

  /* 相册 + */
  if (e.target.closest('#rp-album-add-btn')) {
    if (!rpCurrentRole) { alert('角色信息未加载'); return; }
    var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
    var roleSetting = rpCurrentRole.setting || '';
    var now = new Date();
    var dateStr = now.getFullYear() + '.' + (now.getMonth()+1) + '.' + now.getDate();
    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。\n' +
      '请生成角色手机相册中3张照片的描述，贴合角色生活场景。\n' +
      '只输出JSON数组，每个元素格式：{"date":"拍摄日期如2025.3.10","scene":"照片场景描述50字以内"}\n' +
      '不输出任何其他内容。';
    rpShowLoading();
    rpCallAPI([{ role: 'system', content: systemPrompt }],
      function (raw) {
        rpHideLoading();
        var parsed = rpExtractJSON(raw, 'array');
        if (!parsed || !parsed.length) { alert('生成失败，请重试'); return; }
        parsed.forEach(function (p) {
          rpCurrentRoleData.album.unshift({
            id: 'photo_' + Date.now() + '_' + Math.random().toString(36).slice(2),
            date: p.date || dateStr, scene: p.scene || '', ts: Date.now()
          });
        });
        rpSave(rpCurrentRoleId, rpCurrentRoleData);
        rpRenderAlbumGrid();
      },
      function (err) { rpHideLoading(); alert('API 请求失败：' + err); }
    );
    return;
  }

  /* 音乐 + */
  if (e.target.closest('#rp-music-add-btn')) {
    if (!rpCurrentRole) { alert('角色信息未加载'); return; }
    var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
    var roleSetting = rpCurrentRole.setting || '';
    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。\n' +
      '请生成角色最近在听的8到10首歌，贴合角色性格和情感状态。\n' +
      '只输出JSON数组，每个元素格式：{"title":"歌曲名","artist":"歌手名","duration":"时长如3:42"}\n' +
      '不输出任何其他内容。';
    rpShowLoading();
    rpCallAPI([{ role: 'system', content: systemPrompt }],
      function (raw) {
        rpHideLoading();
        var parsed = rpExtractJSON(raw, 'array');
        if (!parsed || !parsed.length) { alert('生成失败，请重试'); return; }
        rpCurrentRoleData.music = parsed.map(function (s) {
          return { title: s.title || '', artist: s.artist || '', duration: s.duration || '' };
        });
        rpSave(rpCurrentRoleId, rpCurrentRoleData);
        rpRenderMusicList();
      },
      function (err) { rpHideLoading(); alert('API 请求失败：' + err); }
    );
    return;
  }

  /* 购物车 + */
  if (e.target.closest('#rp-shop-add-btn')) {
    if (!rpCurrentRole) { alert('角色信息未加载'); return; }
    var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
    var roleSetting = rpCurrentRole.setting || '';
    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。\n' +
      '请生成角色购物车里5到8件商品，贴合角色消费偏好和生活状态。\n' +
      '只输出JSON数组，每个元素格式：{"name":"商品名","price":"价格数字字符串","note":"简短备注如加购原因"}\n' +
      '不输出任何其他内容。';
    rpShowLoading();
    rpCallAPI([{ role: 'system', content: systemPrompt }],
      function (raw) {
        rpHideLoading();
        var parsed = rpExtractJSON(raw, 'array');
        if (!parsed || !parsed.length) { alert('生成失败，请重试'); return; }
        rpCurrentRoleData.shop = parsed.map(function (s) {
          return { name: s.name || '', price: s.price || '0', note: s.note || '' };
        });
        rpSave(rpCurrentRoleId, rpCurrentRoleData);
        rpRenderShopList();
      },
      function (err) { rpHideLoading(); alert('API 请求失败：' + err); }
    );
    return;
  }

  /* 步数 + */
  if (e.target.closest('#rp-steps-add-btn')) {
    if (!rpCurrentRole) { alert('角色信息未加载'); return; }
    var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
    var roleSetting = rpCurrentRole.setting || '';
    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。\n' +
      '请生成角色今天的运动步数数据，贴合角色的生活习惯和性格。\n' +
      '只输出一个JSON对象，格式：{"steps":总步数整数,"distance":"公里数保留1位小数","calories":"卡路里整数","periods":[{"label":"时段描述如早晨散步","steps":步数整数}]}\n' +
      'periods生成3到5个时段，不输出任何其他内容。';
    rpShowLoading();
    rpCallAPI([{ role: 'system', content: systemPrompt }],
      function (raw) {
        rpHideLoading();
        var parsed = rpExtractJSON(raw, 'object');
        if (!parsed || !parsed.steps) { alert('生成失败，请重试'); return; }
        var today = new Date().toDateString();
        var records = rpCurrentRoleData.steps || [];
        var existIdx = records.findIndex(function (r) { return r.date === today; });
        var newRec = { date: today, steps: parsed.steps || 0, distance: parsed.distance || '0', calories: parsed.calories || '0', periods: parsed.periods || [] };
        if (existIdx >= 0) records[existIdx] = newRec; else records.unshift(newRec);
        rpCurrentRoleData.steps = records;
        rpSave(rpCurrentRoleId, rpCurrentRoleData);
        rpRenderStepsData();
      },
      function (err) { rpHideLoading(); alert('API 请求失败：' + err); }
    );
    return;
  }

  /* 通话记录 + */
  if (e.target.closest('#rp-call-add-btn')) {
    if (!rpCurrentRole) { alert('角色信息未加载'); return; }
    var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
    var roleSetting = rpCurrentRole.setting || '';
    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。\n' +
      '请生成角色最近的8到12条通话记录，透露角色的社交关系。\n' +
      '只输出JSON数组，每个元素格式：{"name":"联系人名","relation":"关系如同学朋友妈妈等","type":"incoming或outgoing或missed","time":"时间如今天14:32","duration":"时长如2分14秒，missed类型留空"}\n' +
      '不输出任何其他内容。';
    rpShowLoading();
    rpCallAPI([{ role: 'system', content: systemPrompt }],
      function (raw) {
        rpHideLoading();
        var parsed = rpExtractJSON(raw, 'array');
        if (!parsed || !parsed.length) { alert('生成失败，请重试'); return; }
        rpCurrentRoleData.calls = parsed.map(function (c) {
          return { name: c.name || '', relation: c.relation || '', type: c.type || 'incoming', time: c.time || '', duration: c.duration || '' };
        });
        rpSave(rpCurrentRoleId, rpCurrentRoleData);
        rpRenderCallList();
      },
      function (err) { rpHideLoading(); alert('API 请求失败：' + err); }
    );
    return;
  }

  /* 钱包 + */
  if (e.target.closest('#rp-wallet-add-btn')) {
    if (!rpCurrentRole) { alert('角色信息未加载'); return; }
    var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
    var roleSetting = rpCurrentRole.setting || '';
    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。\n' +
      '请生成角色本月8到12条账单流水，透露角色的经济状况和生活细节。\n' +
      '只输出JSON数组，每个元素格式：{"desc":"账单描述","amount":"金额数字字符串","type":"expense或income","time":"时间如3月15日 14:22"}\n' +
      '不输出任何其他内容。';
    rpShowLoading();
    rpCallAPI([{ role: 'system', content: systemPrompt }],
      function (raw) {
        rpHideLoading();
        var parsed = rpExtractJSON(raw, 'array');
        if (!parsed || !parsed.length) { alert('生成失败，请重试'); return; }
        rpCurrentRoleData.wallet = parsed.map(function (b) {
          return { desc: b.desc || '', amount: b.amount || '0', type: b.type || 'expense', time: b.time || '' };
        });
        rpSave(rpCurrentRoleId, rpCurrentRoleData);
        rpRenderWalletList();
      },
      function (err) { rpHideLoading(); alert('API 请求失败：' + err); }
    );
    return;
  }

  /* 追剧 + */
  if (e.target.closest('#rp-drama-add-btn')) {
    if (!rpCurrentRole) { alert('角色信息未加载'); return; }
    var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
    var roleSetting = rpCurrentRole.setting || '';
    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。\n' +
      '请生成角色正在追的3到5部剧或动漫，贴合角色性格和喜好。\n' +
      '只输出JSON数组，每个元素格式：{"title":"剧名","watched":已看集数整数,"total":总集数整数,"status":"追剧状态如追更中或已完结"}\n' +
      '不输出任何其他内容。';
    rpShowLoading();
    rpCallAPI([{ role: 'system', content: systemPrompt }],
      function (raw) {
        rpHideLoading();
        var parsed = rpExtractJSON(raw, 'array');
        if (!parsed || !parsed.length) { alert('生成失败，请重试'); return; }
        rpCurrentRoleData.drama = parsed.map(function (d) {
          return { title: d.title || '', watched: d.watched || 0, total: d.total || 0, status: d.status || '' };
        });
        rpSave(rpCurrentRoleId, rpCurrentRoleData);
        rpRenderDramaList();
      },
      function (err) { rpHideLoading(); alert('API 请求失败：' + err); }
    );
    return;
  }

  /* 外卖 + */
  if (e.target.closest('#rp-food-add-btn')) {
    if (!rpCurrentRole) { alert('角色信息未加载'); return; }
    var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
    var roleSetting = rpCurrentRole.setting || '';
    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。\n' +
      '请生成角色最近5到8条外卖订单记录，贴合角色的饮食习惯和生活状态。\n' +
      '只输出JSON数组，每个元素格式：{"shop":"店铺名","items":"点的菜品简述","amount":"金额数字字符串","time":"时间如昨天12:30"}\n' +
      '不输出任何其他内容。';
    rpShowLoading();
    rpCallAPI([{ role: 'system', content: systemPrompt }],
      function (raw) {
        rpHideLoading();
        var parsed = rpExtractJSON(raw, 'array');
        if (!parsed || !parsed.length) { alert('生成失败，请重试'); return; }
        rpCurrentRoleData.food = parsed.map(function (o) {
          return { shop: o.shop || '', items: o.items || '', amount: o.amount || '0', time: o.time || '' };
        });
        rpSave(rpCurrentRoleId, rpCurrentRoleData);
        rpRenderFoodList();
      },
      function (err) { rpHideLoading(); alert('API 请求失败：' + err); }
    );
    return;
  }

});

/* ================================================================
   数据工具函数
   ================================================================ */
function rpDefaultData() {
  return {
    pin: '',
    wallpaper: '',
    memoWidgetItems: [],
    polaroidImg: '',
    appIcons: {},
    appPromptLimits: {},
    notes: { todos: [], diaries: [], memos: [] },
    screenHealth: [],
    forum: [],
    dreams: [],
    album: [],
    music: [],
    shop: [],
    steps: [],
    calls: [],
    wallet: [],
    drama: [],
    food: []
  };
}


function rpLoad(roleId) {
  try {
    var raw = localStorage.getItem('halo9_rolephone_' + roleId);
    if (!raw) return rpDefaultData();
    var data = JSON.parse(raw);
    if (!data.notes)           data.notes = { todos: [], diaries: [], memos: [] };
    if (!data.notes.todos)     data.notes.todos = [];
    if (!data.notes.diaries)   data.notes.diaries = [];
    if (!data.notes.memos)     data.notes.memos = [];
    if (!data.screenHealth)    data.screenHealth = [];
    if (!data.forum)           data.forum = [];
    if (!data.memoWidgetItems) data.memoWidgetItems = [];
    if (!data.dreams)          data.dreams = [];
    if (!data.album)           data.album = [];
    if (!data.music)           data.music = [];
    if (!data.shop)            data.shop = [];
    if (!data.steps)           data.steps = [];
    if (!data.calls)           data.calls = [];
    if (!data.wallet)          data.wallet = [];
    if (!data.drama)           data.drama = [];
    if (!data.food)            data.food = [];
    return data;
  } catch (e) { return rpDefaultData(); }
}


function rpSave(roleId, data) {
  try { localStorage.setItem('halo9_rolephone_' + roleId, JSON.stringify(data)); } catch (e) {}
}

/* ================================================================
   API 调用（修复：正确读取主程序配置）
   ================================================================ */
function rpCallAPI(messages, onSuccess, onError) {
  var cfg   = null;
  var model = '';
  try {
    cfg = (typeof loadApiConfig === 'function') ? loadApiConfig()
      : JSON.parse(localStorage.getItem('halo9_apiActiveConfig') || 'null');
  } catch (e) {}
  try {
    model = (typeof loadApiModel === 'function') ? loadApiModel()
      : JSON.parse(localStorage.getItem('halo9_apiCurrentModel') || '""');
  } catch (e) {}

  if (!cfg || !cfg.url) { onError('未配置API，请先在设置中配置 API 地址和密钥'); return; }
  if (!model)           { onError('未选择模型，请先在设置中选择模型'); return; }

  var headers  = { 'Content-Type': 'application/json' };
  if (cfg.key) headers['Authorization'] = 'Bearer ' + cfg.key;

  fetch(cfg.url.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ model: model, messages: messages, stream: false })
  })
  .then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(function (j) {
    var content = (j.choices && j.choices[0] && j.choices[0].message
      && j.choices[0].message.content) ? j.choices[0].message.content : '';
    onSuccess(content.trim());
  })
  .catch(function (e) { onError(e.message || '请求失败'); });
}

/* ================================================================
   正则提取工具
   ================================================================ */
function rpExtractJSON(raw, type) {
  var str = (raw || '').trim();
  if (type === 'array') {
    var m = str.match(/\[[\s\S]*\]/);
    if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  } else {
    var m2 = str.match(/\{[\s\S]*\}/);
    if (m2) { try { return JSON.parse(m2[0]); } catch (e) {} }
  }
  return null;
}

/* ================================================================
   全局状态
   ================================================================ */
var rpCurrentRoleId      = '';
var rpCurrentRoleData    = null;
var rpCurrentRole        = null;
var rpPinBuffer          = '';
var rpPinErrorCount      = 0;
var rpPinLength          = 4;
var rpWeatherStr         = '--';
var rpClockTimer         = null;
var rpCurrentNotesTab    = 'rp-todo-tab';
var rpCurrentForumPostId = '';
var rpLoadingCount       = 0;

/* ================================================================
   加载弹窗
   ================================================================ */
function rpShowLoading() {
  rpLoadingCount++;
  var el = document.getElementById('rp-loading-modal');
  if (el) el.style.display = 'flex';
}

function rpHideLoading() {
  rpLoadingCount = Math.max(0, rpLoadingCount - 1);
  if (rpLoadingCount === 0) {
    var el = document.getElementById('rp-loading-modal');
    if (el) el.style.display = 'none';
  }
}

/* ================================================================
   视图切换
   ================================================================ */
var RP_VIEWS = [
  'rp-lockscreen-view',
  'rp-home-view',
  'rp-notes-view',
  'rp-diary-detail-view',
  'rp-health-view',
  'rp-forum-view',
  'rp-forum-detail-view',
  'rp-dream-view',
  'rp-dream-detail-view',
  'rp-album-view',
  'rp-album-detail-view',
  'rp-music-view',
  'rp-shop-view',
  'rp-steps-view',
  'rp-call-view',
  'rp-wallet-view',
  'rp-drama-view',
  'rp-food-view'
];


function rpShowView(id) {
  RP_VIEWS.forEach(function (v) {
    var el = document.getElementById(v);
    if (el) el.style.display = (v === id) ? 'flex' : 'none';
  });
}

/* ================================================================
   打开 / 关闭角色手机
   ================================================================ */
function rpOpen(roleId) {
  rpCurrentRoleId   = roleId;
  rpCurrentRole     = null;
  if (typeof liaoRoles !== 'undefined') {
    rpCurrentRole = liaoRoles.find(function (r) { return r.id === roleId; }) || null;
  }

  rpCurrentRoleData = rpLoad(roleId);

  var app = document.getElementById('rolephone-app');
  if (app) app.style.display = 'flex';

  rpApplyWallpaper();

  var pinVal = (rpCurrentRoleData.pin || '').trim();
if (pinVal.length === rpPinLength && /^\d{4}$/.test(pinVal)) {
  rpInitLockscreen();
  rpShowView('rp-lockscreen-view');
} else {
  rpShowView('rp-home-view');
  rpInitHome();
}

  if (typeof lucide !== 'undefined') lucide.createIcons();
}


function rpClose() {
  var app = document.getElementById('rolephone-app');
  if (app) app.style.display = 'none';
  if (rpClockTimer) { clearInterval(rpClockTimer); rpClockTimer = null; }

  /* 确保了了聊天界面仍然可见 */
  var liaoApp = document.getElementById('liao-app');
  if (liaoApp && liaoApp.classList.contains('show')) {
    var chatView = document.getElementById('liao-chat-view');
    if (chatView && typeof currentChatIdx !== 'undefined' && currentChatIdx >= 0) {
      chatView.classList.add('show');
    }
  }
}


/* ================================================================
   锁屏逻辑
   ================================================================ */
function rpInitLockscreen() {
  rpPinBuffer     = '';
  rpPinErrorCount = 0;

  var avatarEl = document.getElementById('rp-ls-avatar');
  var nameEl   = document.getElementById('rp-ls-name');
  if (avatarEl && rpCurrentRole) avatarEl.src = rpCurrentRole.avatar || '';
  if (nameEl   && rpCurrentRole) nameEl.textContent = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';

  rpUpdateLsTime();
  if (rpClockTimer) clearInterval(rpClockTimer);
  rpClockTimer = setInterval(rpUpdateLsTime, 10000);

  rpRenderPinDots();
  rpClearPinError();
}

function rpUpdateLsTime() {
  var now = new Date();
  var h   = String(now.getHours()).padStart(2, '0');
  var m   = String(now.getMinutes()).padStart(2, '0');
  var mo  = now.getMonth() + 1;
  var d   = now.getDate();
  var timeEl = document.getElementById('rp-ls-time');
  var dateEl = document.getElementById('rp-ls-date');
  if (timeEl) timeEl.textContent = h + ':' + m;
  if (dateEl) dateEl.textContent = mo + '月' + d + '日';
}

function rpRenderPinDots() {
  document.querySelectorAll('.rp-pin-dot').forEach(function (dot, i) {
    dot.classList.toggle('filled', i < rpPinBuffer.length);
    dot.classList.remove('error');
  });
}

function rpShowPinError(msg) {
  document.querySelectorAll('.rp-pin-dot').forEach(function (dot) {
    dot.classList.add('error');
  });
  var errEl = document.getElementById('rp-pin-error');
  if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
  setTimeout(function () {
    document.querySelectorAll('.rp-pin-dot').forEach(function (dot) {
      dot.classList.remove('error');
    });
    if (errEl) errEl.classList.remove('show');
    rpPinBuffer = '';
    rpRenderPinDots();
  }, 900);
}

function rpClearPinError() {
  var errEl = document.getElementById('rp-pin-error');
  if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); }
}

document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-ls-back-btn') {
    rpClose();
  }
});

function rpHandlePinKey(val) {
  if (val === 'del') {
    if (rpPinBuffer.length > 0) {
      rpPinBuffer = rpPinBuffer.slice(0, -1);
      rpRenderPinDots();
      rpClearPinError();
    }
    return;
  }
  if (rpPinBuffer.length >= rpPinLength) return;
  rpPinBuffer += val;
  rpRenderPinDots();

  if (rpPinBuffer.length === rpPinLength) {
    var correct = rpCurrentRoleData.pin || '';
    if (rpPinBuffer === correct) {
      rpPinErrorCount = 0;
      rpShowView('rp-home-view');
      rpInitHome();
    } else {
      rpPinErrorCount++;
      rpShowPinError(rpPinErrorCount >= 3
        ? '密码错误，请联系角色重置'
        : '密码错误，请重试（' + rpPinErrorCount + '/3）');
    }
  }
}

(function bindRpPinKeys() {
  document.addEventListener('click', function (e) {
    var key = e.target.closest('.rp-pin-key[data-key]');
    if (!key) return;
    var ls = document.getElementById('rp-lockscreen-view');
    if (!ls || ls.style.display === 'none') return;
    rpHandlePinKey(key.dataset.key);
  });

  document.addEventListener('touchstart', function (e) {
    var key = e.target.closest('.rp-pin-key[data-key]');
    if (!key) return;
    var ls = document.getElementById('rp-lockscreen-view');
    if (!ls || ls.style.display === 'none') return;
    e.preventDefault();
    key.classList.add('pressed');
    rpHandlePinKey(key.dataset.key);
  }, { passive: false });

  document.addEventListener('touchend', function (e) {
    var key = e.target.closest('.rp-pin-key');
    if (key) key.classList.remove('pressed');
  }, { passive: true });
})();

document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-pin-forget') {
    alert('请在聊天设置 — 角色手机中重置密码');
  }
});

/* ================================================================
   主页逻辑
   ================================================================ */
function rpInitHome() {
  rpApplyWallpaper();
  rpUpdateHomeTime();
  if (rpClockTimer) clearInterval(rpClockTimer);
  rpClockTimer = setInterval(rpUpdateHomeTime, 30000);
  rpFetchWeather();
  rpRenderMemoWidget();
  rpRenderPolaroid();
  /* 渲染 lucide 图标 */
  if (typeof lucide !== 'undefined') lucide.createIcons();
}


function rpUpdateHomeTime() {
  var now = new Date();
  var h   = String(now.getHours()).padStart(2, '0');
  var m   = String(now.getMinutes()).padStart(2, '0');
  var mo  = now.getMonth() + 1;
  var d   = now.getDate();
  var timeEl = document.getElementById('rp-home-time');
  var dateEl = document.getElementById('rp-home-date');
  if (timeEl) timeEl.textContent = h + ':' + m;
  if (dateEl) dateEl.textContent = mo + '月' + d + '日';
}

function rpFetchWeather() {
  var weatherEl = document.getElementById('rp-home-weather');
  if (!weatherEl) return;
  fetch('https://wttr.in/?format=%c+%t')
    .then(function (r) { return r.text(); })
    .then(function (t) {
      rpWeatherStr = t.trim() || '☀️ --°C';
      if (weatherEl) weatherEl.textContent = rpWeatherStr;
    })
    .catch(function () {
      rpWeatherStr = '☀️ --°C';
      if (weatherEl) weatherEl.textContent = rpWeatherStr;
    });
}

function rpRenderMemoWidget() {
  var list = document.getElementById('rp-memo-list');
  if (!list) return;
  var items = (rpCurrentRoleData.memoWidgetItems || []).slice(0, 3);
  if (!items.length) {
    list.innerHTML = '<div class="rp-memo-empty">暂无备忘</div>';
    return;
  }
  list.innerHTML = '';
  items.forEach(function (item) {
    var div = document.createElement('div');
    div.className   = 'rp-memo-item';
    div.textContent = item.text;
    list.appendChild(div);
  });
}

function rpRenderPolaroid() {
  var img     = document.getElementById('rp-photo-img');
  var emptyEl = document.getElementById('rp-photo-empty');
  var polaroid = rpCurrentRoleData.polaroidImg || '';
  if (img && emptyEl) {
    if (polaroid) {
      img.src = polaroid;
      img.style.display    = 'block';
      emptyEl.style.display = 'none';
    } else {
      img.style.display    = 'none';
      emptyEl.style.display = 'flex';
    }
  }
}

/* 主页备忘录 + 按钮：AI生成备忘内容 */
document.addEventListener('click', function (e) {
  var btn = e.target.closest ? e.target.closest('#rp-memo-add-btn') : null;
  if (!btn && e.target.id !== 'rp-memo-add-btn') return;
  if (!rpCurrentRole) { alert('角色信息未加载'); return; }

  var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
  var roleSetting = rpCurrentRole.setting || '';

  var systemPrompt =
    '你扮演角色' + roleName + '，' + roleSetting + '。\n' +
    '请为角色生成一条今日备忘事项，15字以内，口语化，贴合角色性格。\n' +
    '只输出备忘内容本身，不加任何前缀、引号或解释。';

  rpShowLoading();
  rpCallAPI(
    [{ role: 'system', content: systemPrompt }],
    function (raw) {
      rpHideLoading();
      var text = raw.trim().replace(/^["'「『]|["'」』]$/g, '');
      if (!text) { alert('生成失败，请重试'); return; }
      if (!rpCurrentRoleData.memoWidgetItems) rpCurrentRoleData.memoWidgetItems = [];
      rpCurrentRoleData.memoWidgetItems.unshift({ id: 'memo_' + Date.now(), text: text, ts: Date.now() });
      rpSave(rpCurrentRoleId, rpCurrentRoleData);
      rpRenderMemoWidget();
    },
    function (err) { rpHideLoading(); alert('API 请求失败：' + err); }
  );
});


document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-memo-confirm') {
    var input = document.getElementById('rp-memo-input');
    var text  = input ? input.value.trim() : '';
    if (!text) return;
    if (!rpCurrentRoleData.memoWidgetItems) rpCurrentRoleData.memoWidgetItems = [];
    rpCurrentRoleData.memoWidgetItems.unshift({ id: 'memo_' + Date.now(), text: text, ts: Date.now() });
    rpSave(rpCurrentRoleId, rpCurrentRoleData);
    rpRenderMemoWidget();
    var modal = document.getElementById('rp-memo-modal');
    if (modal) modal.style.display = 'none';
  }
  if (e.target && e.target.id === 'rp-memo-cancel') {
    var modal = document.getElementById('rp-memo-modal');
    if (modal) modal.style.display = 'none';
  }
});

/* 拍立得点击换图 */
document.addEventListener('click', function (e) {
  var hw = document.getElementById('rp-home-view');
  if (!hw || hw.style.display === 'none') return;
  if (e.target && (e.target.id === 'rp-photo-img' || e.target.id === 'rp-photo-empty' ||
      (e.target.closest && e.target.closest('.rp-widget-photo')))) {
    var url = prompt('输入拍立得图片URL');
    if (url && url.trim()) {
      rpCurrentRoleData.polaroidImg = url.trim();
      rpSave(rpCurrentRoleId, rpCurrentRoleData);
      rpRenderPolaroid();
    }
  }
});

/* App 图标点击 */
document.addEventListener('click', function (e) {
  var item = e.target.closest('.rp-app-item[data-rpapp]');
  if (!item) return;
  var hw = document.getElementById('rp-home-view');
  if (!hw || hw.style.display === 'none') return;
  var app = item.dataset.rpapp;
  if (app === 'notes')  { rpShowView('rp-notes-view');  rpInitNotesApp(); }
  if (app === 'health') { rpShowView('rp-health-view'); rpInitHealthApp(); }
  if (app === 'forum')  { rpShowView('rp-forum-view');  rpInitForumApp(); }
  if (app === 'dream')  { rpShowView('rp-dream-view');  rpInitDreamApp(); }
  if (app === 'album')  { rpShowView('rp-album-view');  rpInitAlbumApp(); }
  if (app === 'music')  { rpShowView('rp-music-view');  rpInitMusicApp(); }
  if (app === 'shop')   { rpShowView('rp-shop-view');   rpInitShopApp(); }
  if (app === 'steps')  { rpShowView('rp-steps-view');  rpInitStepsApp(); }
  if (app === 'wallet') { rpShowView('rp-wallet-view'); rpInitWalletApp(); }
  if (app === 'drama')  { rpShowView('rp-drama-view');  rpInitDramaApp(); }
  if (app === 'food')   { rpShowView('rp-food-view');   rpInitFoodApp(); }
});

/* ================================================================
   通用返回按钮
   ================================================================ */
document.addEventListener('click', function (e) {
  var btn = e.target.closest('.rp-back-btn[data-rpback]');
  if (!btn) return;
  var target = btn.dataset.rpback;
  rpShowView(target);
  if (target === 'rp-home-view')  rpInitHome();
  if (target === 'rp-liao-view')  rpRenderLiaoList();
  if (target === 'rp-notes-view') rpRenderCurrentNotesTab();
  if (target === 'rp-forum-view') rpRenderForumList();
});

/* ================================================================
   了了 App
   ================================================================ */
function rpInitLiaoApp() { rpRenderLiaoList(); }

function rpRenderLiaoList() {
  var list = document.getElementById('rp-liao-chat-list');
  if (!list) return;
  var chats = rpCurrentRoleData.liaoChats || [];
  if (!chats.length) {
    list.innerHTML = '<div class="rp-list-empty">暂无聊天记录，点右上角＋生成</div>';
    return;
  }
  list.innerHTML = '';
  chats.forEach(function (chat) {
    var last    = (chat.messages && chat.messages.length) ? chat.messages[chat.messages.length - 1] : null;
    var preview = last ? (last.content || '').slice(0, 24) : '暂无消息';
    var timeStr = last ? rpFormatTime(last.ts) : '';

    var item = document.createElement('div');
    item.className = 'rp-chat-item';

    var avatarEl = document.createElement('img');
    avatarEl.className = 'rp-chat-item-avatar';
    avatarEl.src = chat.avatar || '';

    var body = document.createElement('div');
    body.className = 'rp-chat-item-body';

    var nameEl = document.createElement('div');
    nameEl.className = 'rp-chat-item-name';
    nameEl.textContent = chat.name || '未知';

    var previewEl = document.createElement('div');
    previewEl.className = 'rp-chat-item-preview';
    previewEl.textContent = preview;

    var timeEl = document.createElement('div');
    timeEl.className = 'rp-chat-item-time';
    timeEl.textContent = timeStr;

    body.appendChild(nameEl);
    body.appendChild(previewEl);
    item.appendChild(avatarEl);
    item.appendChild(body);
    item.appendChild(timeEl);

    item.addEventListener('click', function () { rpOpenLiaoChat(chat.id); });
    list.appendChild(item);
  });
}

function rpOpenLiaoChat(chatId) {
  var chat = (rpCurrentRoleData.liaoChats || []).find(function (c) { return c.id === chatId; });
  if (!chat) return;

  var avatarEl = document.getElementById('rp-liao-chat-avatar');
  var nameEl   = document.getElementById('rp-liao-chat-name');
  if (avatarEl) avatarEl.src = chat.avatar || '';
  if (nameEl)   nameEl.textContent = chat.name || '聊天';

  rpShowView('rp-liao-chat-view');
  rpRenderLiaoMessages(chat);
}

function rpRenderLiaoMessages(chat) {
  var area = document.getElementById('rp-liao-messages');
  if (!area) return;
  area.innerHTML = '';
  var msgs = chat.messages || [];
  msgs.forEach(function (msg) {
    var row = document.createElement('div');
    row.className = 'rp-msg-row' + (msg.role === 'self' ? ' rp-user-row' : '');

    var avatarEl = document.createElement('img');
    avatarEl.className = 'rp-msg-avatar';
    avatarEl.src = msg.role === 'self'
      ? ((rpCurrentRole && rpCurrentRole.avatar) ? rpCurrentRole.avatar : '')
      : (chat.avatar || '');

    var bubble = document.createElement('div');
    bubble.className   = 'rp-msg-bubble';
    bubble.textContent = msg.content || '';

    if (msg.role === 'self') {
      row.appendChild(bubble);
      row.appendChild(avatarEl);
    } else {
      row.appendChild(avatarEl);
      row.appendChild(bubble);
    }
    area.appendChild(row);
  });
  area.scrollTop = area.scrollHeight;
}

/* ---- 了了 + 按钮：生成新聊天 ---- */
document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-liao-compose-btn') {
    if (!rpCurrentRole) { alert('角色信息未加载'); return; }
    var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
    var roleSetting = rpCurrentRole.setting || '';
    var extraLimit  = (rpCurrentRoleData.appPromptLimits && rpCurrentRoleData.appPromptLimits.liao) || '';

    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。\n' +
      '请生成一段角色手机"了了"App中，角色与某个朋友的聊天记录。\n' +
      (extraLimit ? '额外要求：' + extraLimit + '\n' : '') +
      '请直接输出一个JSON数组，格式如下，不要输出任何其他内容：\n' +
      '[{"role":"other","name":"朋友名字","avatar":"😊","content":"消息内容"},{"role":"self","name":"' + roleName + '","avatar":"😄","content":"消息内容"}]\n' +
      'role为other表示朋友发的，self表示角色自己发的。生成10到15条，内容生活化口语化。';

    rpShowLoading();
    rpCallAPI(
      [{ role: 'system', content: systemPrompt }],
      function (raw) {
        rpHideLoading();
        var parsed = rpExtractJSON(raw, 'array');
        if (!parsed || !Array.isArray(parsed) || !parsed.length) {
          alert('生成失败，请重试');
          return;
        }
        var otherName = '好友';
        var otherAvatar = '👤';
        var baseTs = Date.now() - 3600000;
        var msgs = parsed.map(function (item, idx) {
          if (item.role === 'other' && otherName === '好友') {
            otherName   = item.name   || '好友';
            otherAvatar = item.avatar || '👤';
          }
          return {
            role:    item.role    || 'other',
            name:    item.name    || (item.role === 'self' ? roleName : '好友'),
            avatar:  item.avatar  || '👤',
            content: item.content || '',
            ts:      baseTs + idx * 60000
          };
        });
        var newChat = {
          id:       'rpchat_' + Date.now(),
          name:     otherName,
          avatar:   otherAvatar,
          messages: msgs
        };
        if (!rpCurrentRoleData.liaoChats) rpCurrentRoleData.liaoChats = [];
        rpCurrentRoleData.liaoChats.unshift(newChat);
        rpSave(rpCurrentRoleId, rpCurrentRoleData);
        rpRenderLiaoList();
      },
      function (err) { rpHideLoading(); alert('API 请求失败：' + err); }
    );
  }
});


/* ---- 了了聊天详情 + 按钮：继续生成 ---- */
document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-liao-gen-btn') {
    var nameEl   = document.getElementById('rp-liao-chat-name');
    var chatName = nameEl ? nameEl.textContent : '';
    var chat     = (rpCurrentRoleData.liaoChats || []).find(function (c) { return c.name === chatName; });
    if (!chat) return;
    var roleName    = (rpCurrentRole && (rpCurrentRole.nickname || rpCurrentRole.realname)) || '角色';
    var roleSetting = (rpCurrentRole && rpCurrentRole.setting) || '';
    var extraLimit  = (rpCurrentRoleData.appPromptLimits && rpCurrentRoleData.appPromptLimits.liao) || '';
    var otherName   = chat.name || '朋友';
    var lastMsgs    = (chat.messages || []).slice(-6)
      .map(function (m) { return (m.role === 'self' ? roleName : otherName) + '：' + m.content; })
      .join('\n');

    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。\n' +
      '以下是最近聊天记录：\n' + lastMsgs + '\n' +
      '请继续生成3到5条消息。\n' +
      (extraLimit ? '额外要求：' + extraLimit + '\n' : '') +
      '请直接输出一个JSON数组，格式如下，不要输出任何其他内容：\n' +
      '[{"role":"other","name":"' + otherName + '","avatar":"😊","content":"消息内容"}]\n' +
      'role为other表示朋友发的，self表示角色自己发的。';

    rpShowLoading();
    rpCallAPI(
      [{ role: 'system', content: systemPrompt }],
      function (raw) {
        rpHideLoading();
        var newMsgs = rpExtractJSON(raw, 'array');
        if (!newMsgs || !Array.isArray(newMsgs) || !newMsgs.length) {
          alert('生成失败，请重试');
          return;
        }
        var baseTs = Date.now();
        newMsgs.forEach(function (item, idx) {
          chat.messages.push({
            role:    item.role    || 'other',
            name:    item.name    || otherName,
            avatar:  item.avatar  || '👤',
            content: item.content || '',
            ts:      baseTs + idx * 30000
          });
        });
        rpSave(rpCurrentRoleId, rpCurrentRoleData);
        rpRenderLiaoMessages(chat);
      },
      function (err) { rpHideLoading(); alert('API 请求失败：' + err); }
    );
  }
});


/* ================================================================
   便签 App
   ================================================================ */
function rpInitNotesApp() {
  rpCurrentNotesTab = 'rp-todo-tab';
  rpRenderCurrentNotesTab();
}

function rpRenderCurrentNotesTab() {
  if (rpCurrentNotesTab === 'rp-todo-tab')  rpRenderTodoList();
  if (rpCurrentNotesTab === 'rp-diary-tab') rpRenderDiaryList();
  if (rpCurrentNotesTab === 'rp-memo-tab')  rpRenderMemoList();
}

document.addEventListener('click', function (e) {
  var btn = e.target.closest('.rp-tab-btn[data-rptab]');
  if (!btn) return;
  document.querySelectorAll('.rp-tab-btn').forEach(function (b) { b.classList.remove('active'); });
  document.querySelectorAll('.rp-tab-panel').forEach(function (p) { p.classList.remove('active'); });
  btn.classList.add('active');
  rpCurrentNotesTab = btn.dataset.rptab;
  var panel = document.getElementById(rpCurrentNotesTab);
  if (panel) panel.classList.add('active');
  rpRenderCurrentNotesTab();
});

/* 便签 + 按钮：弹出选项弹窗 */
document.addEventListener('click', function (e) {
  var btn = e.target.closest ? e.target.closest('#rp-notes-add-btn') : null;
  if (!btn && e.target.id !== 'rp-notes-add-btn') return;

  /* 打开选项弹窗，同时渲染 lucide 图标 */
  var modal = document.getElementById('rp-notes-option-modal');
  if (modal) {
    modal.style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
});

/* 便签选项弹窗：三个选项 + 取消 */
document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-notes-opt-cancel') {
    var modal = document.getElementById('rp-notes-option-modal');
    if (modal) modal.style.display = 'none';
    return;
  }

  /* 点遮罩关闭 */
  if (e.target && e.target.id === 'rp-notes-option-modal') {
    e.target.style.display = 'none';
    return;
  }

  var optBtn = e.target.closest ? e.target.closest('.rp-notes-option-btn') : null;
  if (!optBtn) return;

  var modal = document.getElementById('rp-notes-option-modal');
  if (modal) modal.style.display = 'none';

  var id = optBtn.id;

  if (id === 'rp-notes-opt-todo') {
    /* 切换到待办 Tab 并弹出输入弹窗 */
    rpCurrentNotesTab = 'rp-todo-tab';
    document.querySelectorAll('.rp-tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.rptab === 'rp-todo-tab');
    });
    document.querySelectorAll('.rp-tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'rp-todo-tab');
    });
    rpShowTodoModal();

  } else if (id === 'rp-notes-opt-diary') {
    /* 切换到日记 Tab 并 AI 生成 */
    rpCurrentNotesTab = 'rp-diary-tab';
    document.querySelectorAll('.rp-tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.rptab === 'rp-diary-tab');
    });
    document.querySelectorAll('.rp-tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'rp-diary-tab');
    });
    rpGenerateDiary();

  } else if (id === 'rp-notes-opt-memo') {
    /* 切换到随记 Tab 并 AI 生成 */
    rpCurrentNotesTab = 'rp-memo-tab';
    document.querySelectorAll('.rp-tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.rptab === 'rp-memo-tab');
    });
    document.querySelectorAll('.rp-tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'rp-memo-tab');
    });
    rpGenerateMemo();
  }
});




/* ---- 待办（内联弹窗） ---- */
function rpShowTodoModal() {
  var modal = document.getElementById('rp-notes-modal');
  var title = document.getElementById('rp-notes-modal-title');
  var wSel  = document.getElementById('rp-notes-weather-select');
  var cont  = document.getElementById('rp-notes-content-input');
  if (!modal) return;
  if (title) title.textContent = '添加待办';
  if (wSel)  wSel.style.display = 'none';
  if (cont)  { cont.value = ''; cont.placeholder = '输入待办内容…'; }
  modal.dataset.mode  = 'todo';
  modal.style.display = 'flex';
}

document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-notes-modal-confirm') {
    var modal = document.getElementById('rp-notes-modal');
    var mode  = modal ? modal.dataset.mode : '';
    var cont  = document.getElementById('rp-notes-content-input');
    var text  = cont ? cont.value.trim() : '';
    if (!text) return;
    if (mode === 'todo') {
      rpCurrentRoleData.notes.todos.unshift({
        id: 'todo_' + Date.now(), text: text, done: false, ts: Date.now()
      });
      rpSave(rpCurrentRoleId, rpCurrentRoleData);
      rpRenderTodoList();
    }
    if (modal) modal.style.display = 'none';
  }
  if (e.target && e.target.id === 'rp-notes-modal-cancel') {
    var modal = document.getElementById('rp-notes-modal');
    if (modal) modal.style.display = 'none';
  }
});

function rpRenderTodoList() {
  var list = document.getElementById('rp-todo-list');
  if (!list) return;
  var todos = rpCurrentRoleData.notes.todos || [];
  if (!todos.length) {
    list.innerHTML = '<div class="rp-list-empty">暂无待办，点右上角＋添加</div>';
    return;
  }
  list.innerHTML = '';
  todos.forEach(function (todo, idx) {
    var item  = document.createElement('div');
    item.className = 'rp-todo-item';

    var check = document.createElement('div');
    check.className = 'rp-todo-check' + (todo.done ? ' checked' : '');

    var body  = document.createElement('div');
    body.className = 'rp-todo-body';

    var textEl = document.createElement('div');
    textEl.className   = 'rp-todo-text' + (todo.done ? ' done' : '');
    textEl.textContent = todo.text;

    var timeEl = document.createElement('div');
    timeEl.className   = 'rp-todo-time';
    timeEl.textContent = rpFormatTime(todo.ts);

    body.appendChild(textEl);
    body.appendChild(timeEl);
    item.appendChild(check);
    item.appendChild(body);
    list.appendChild(item);

    check.addEventListener('click', function () {
      rpCurrentRoleData.notes.todos[idx].done = !rpCurrentRoleData.notes.todos[idx].done;
      rpSave(rpCurrentRoleId, rpCurrentRoleData);
      rpRenderTodoList();
    });
  });
}

/* ---- 日记（AI生成，正则替换格式） ---- */
function rpGenerateDiary() {
  if (!rpCurrentRole) { alert('角色信息未加载'); return; }
  var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
  var roleSetting = rpCurrentRole.setting || '';
  var extraLimit  = (rpCurrentRoleData.appPromptLimits && rpCurrentRoleData.appPromptLimits.notes) || '';
  var now         = new Date();
  var dateStr     = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
  var weather     = rpWeatherStr || '晴天';

  var systemPrompt =
    '你扮演角色' + roleName + '，' + roleSetting + '。\n' +
    '今天是' + dateStr + '，天气' + weather + '。\n' +
    (extraLimit ? '额外要求：' + extraLimit + '\n' : '') +
    '请以角色第一人称写一篇今日日记，600字左右，细腻真实，贴合人设。\n' +
    '输出格式（严格按照以下正则格式，整行不能换行）：\n' +
    '[DIARY:date=' + dateStr + ':weather=' + weather + ':content=日记正文内容（用空格代替换行）]\n' +
    '只输出上述格式的一行，不输出任何其他内容。';

  rpShowLoading();
  rpCallAPI(
    [{ role: 'system', content: systemPrompt }],
    function (raw) {
      rpHideLoading();
      var re      = /\[DIARY:date=([^:]+):weather=([^:]+):content=([^\]]+)\]/;
      var m       = raw.match(re);
      var content = '';
      var dDate   = dateStr;
      var dWeather = weather;
      if (m) {
        dDate    = m[1].trim();
        dWeather = m[2].trim();
        content  = m[3].trim();
      } else {
        content = raw.trim();
      }
      if (!content) { alert('生成失败，请重试'); return; }
      rpCurrentRoleData.notes.diaries.unshift({
        id: 'diary_' + Date.now(), date: dDate, weather: dWeather,
        content: content, starred: false, ts: Date.now()
      });
      rpSave(rpCurrentRoleId, rpCurrentRoleData);
      rpRenderDiaryList();
    },
    function (err) { rpHideLoading(); alert('API 请求失败：' + err); }
  );
}

function rpRenderDiaryList() {
  var list = document.getElementById('rp-diary-list');
  if (!list) return;
  var diaries = rpCurrentRoleData.notes.diaries || [];
  if (!diaries.length) {
    list.innerHTML = '<div class="rp-list-empty">暂无日记，点右上角＋生成</div>';
    return;
  }
  list.innerHTML = '';
  diaries.forEach(function (diary, idx) {
    var item = document.createElement('div');
    item.className = 'rp-diary-item';

    var header = document.createElement('div');
    header.className = 'rp-diary-item-header';

    var dateEl = document.createElement('span');
    dateEl.className   = 'rp-diary-item-date';
    dateEl.textContent = diary.date || '';

    var weatherEl = document.createElement('span');
    weatherEl.className   = 'rp-diary-item-weather';
    weatherEl.textContent = diary.weather || '';

    var preview = document.createElement('div');
    preview.className   = 'rp-diary-item-preview';
    preview.textContent = (diary.content || '').slice(0, 60);

    header.appendChild(dateEl);
    header.appendChild(weatherEl);
    item.appendChild(header);
    item.appendChild(preview);
    list.appendChild(item);

    item.addEventListener('click', function () { rpOpenDiaryDetail(idx, 'diary'); });
  });
}

/* ---- 随记（AI生成，正则替换格式） ---- */
function rpGenerateMemo() {
  if (!rpCurrentRole) { alert('角色信息未加载'); return; }
  var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
  var roleSetting = rpCurrentRole.setting || '';
  var extraLimit  = (rpCurrentRoleData.appPromptLimits && rpCurrentRoleData.appPromptLimits.notes) || '';

  var systemPrompt =
    '你扮演角色' + roleName + '，' + roleSetting + '。\n' +
    (extraLimit ? '额外要求：' + extraLimit + '\n' : '') +
    '请以角色第一人称写一条随手记，50到100字，内容随意，口语化，不加任何标题。\n' +
    '输出格式（严格按照以下正则格式，整行不能换行）：\n' +
    '[MEMO:content=随记正文内容]\n' +
    '只输出上述格式的一行，不输出任何其他内容。';

  rpShowLoading();
  rpCallAPI(
    [{ role: 'system', content: systemPrompt }],
    function (raw) {
      rpHideLoading();
      var re      = /\[MEMO:content=([^\]]+)\]/;
      var m       = raw.match(re);
      var content = m ? m[1].trim() : raw.trim();
      if (!content) { alert('生成失败，请重试'); return; }
      rpCurrentRoleData.notes.memos.unshift({
        id: 'rmemo_' + Date.now(), content: content, starred: false, ts: Date.now()
      });
      rpSave(rpCurrentRoleId, rpCurrentRoleData);
      rpRenderMemoList();
    },
    function (err) { rpHideLoading(); alert('API 请求失败：' + err); }
  );
}

function rpRenderMemoList() {
  var list = document.getElementById('rp-random-list');
  if (!list) return;
  var memos = rpCurrentRoleData.notes.memos || [];
  if (!memos.length) {
    list.innerHTML = '<div class="rp-list-empty">暂无随记，点右上角＋生成</div>';
    return;
  }
  list.innerHTML = '';
  memos.forEach(function (memo, idx) {
    var item = document.createElement('div');
    item.className = 'rp-diary-item';

    var header = document.createElement('div');
    header.className = 'rp-diary-item-header';

    var timeEl = document.createElement('span');
    timeEl.className   = 'rp-diary-item-date';
    timeEl.textContent = rpFormatTime(memo.ts);

    var preview = document.createElement('div');
    preview.className   = 'rp-diary-item-preview';
    preview.textContent = (memo.content || '').slice(0, 60);

    header.appendChild(timeEl);
    item.appendChild(header);
    item.appendChild(preview);
    list.appendChild(item);

    item.addEventListener('click', function () { rpOpenDiaryDetail(idx, 'memo'); });
  });
}

/* ---- 日记/随记详情 ---- */
var rpDetailType  = 'diary';
var rpDetailIndex = 0;

function rpOpenDiaryDetail(idx, type) {
  rpDetailType  = type;
  rpDetailIndex = idx;
  var item = type === 'diary'
    ? rpCurrentRoleData.notes.diaries[idx]
    : rpCurrentRoleData.notes.memos[idx];
  if (!item) return;

  var dateEl    = document.getElementById('rp-detail-date');
  var weatherEl = document.getElementById('rp-detail-weather');
  var contentEl = document.getElementById('rp-detail-content');
  var favBtn    = document.getElementById('rp-detail-fav-btn');

  if (dateEl)    dateEl.textContent    = item.date    || rpFormatTime(item.ts);
  if (weatherEl) weatherEl.textContent = item.weather || '';
  if (contentEl) contentEl.textContent = item.content || '';
  if (favBtn)    favBtn.textContent    = item.starred ? '★' : '☆';

  rpShowView('rp-diary-detail-view');
}

document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-detail-fav-btn') {
    var arr = rpDetailType === 'diary'
      ? rpCurrentRoleData.notes.diaries
      : rpCurrentRoleData.notes.memos;
    arr[rpDetailIndex].starred = !arr[rpDetailIndex].starred;
    rpSave(rpCurrentRoleId, rpCurrentRoleData);
    e.target.textContent = arr[rpDetailIndex].starred ? '★' : '☆';
  }
  if (e.target && e.target.id === 'rp-detail-del-btn') {
    if (!confirm('确定删除？')) return;
    var arr = rpDetailType === 'diary'
      ? rpCurrentRoleData.notes.diaries
      : rpCurrentRoleData.notes.memos;
    arr.splice(rpDetailIndex, 1);
    rpSave(rpCurrentRoleId, rpCurrentRoleData);
    rpShowView('rp-notes-view');
    rpRenderCurrentNotesTab();
  }
});

/* ================================================================
   屏幕健康 App（正则替换格式）
   ================================================================ */
function rpInitHealthApp() { rpRenderHealthData(); }

function rpRenderHealthData() {
  var totalEl = document.getElementById('rp-health-total');
  var listEl  = document.getElementById('rp-health-list');
  if (!listEl) return;

  var records     = rpCurrentRoleData.screenHealth || [];
  var today       = new Date().toDateString();
  var todayRecord = records.find(function (r) { return r.date === today; });

  if (!todayRecord || !todayRecord.apps || !todayRecord.apps.length) {
    if (totalEl) totalEl.textContent = '0h 0m';
    listEl.innerHTML = '<div class="rp-list-empty">暂无数据，点右上角＋生成今日数据</div>';
    return;
  }

  var apps      = todayRecord.apps;
  var totalMins = apps.reduce(function (s, a) { return s + (a.minutes || 0); }, 0);
  var h = Math.floor(totalMins / 60);
  var m = totalMins % 60;
  if (totalEl) totalEl.textContent = h + 'h ' + m + 'm';

  var maxMins = Math.max.apply(null, apps.map(function (a) { return a.minutes || 0; }));
  listEl.innerHTML = '';

  apps.forEach(function (app) {
    var pct = maxMins > 0 ? Math.round((app.minutes / maxMins) * 100) : 0;
    var ah  = Math.floor(app.minutes / 60);
    var am  = app.minutes % 60;
    var timeStr = ah > 0 ? ah + 'h ' + am + 'm' : am + 'm';

    var item = document.createElement('div');
    item.className = 'rp-health-item';
    item.innerHTML =
      '<div class="rp-health-item-header">' +
        '<div class="rp-health-item-info">' +
          '<div class="rp-health-item-icon">' + (app.icon || '📱') + '</div>' +
          '<div class="rp-health-item-name">' + (app.name || '') + '</div>' +
        '</div>' +
        '<div class="rp-health-item-time">' + timeStr + '</div>' +
      '</div>' +
      '<div class="rp-health-bar-wrap">' +
        '<div class="rp-health-bar-fill" style="width:' + pct + '%"></div>' +
      '</div>';
    listEl.appendChild(item);
  });
}




/* ================================================================
   趣问 App（正则替换格式）
   ================================================================ */
function rpInitForumApp() { rpRenderForumList(); }

function rpRenderForumList() {
  var list = document.getElementById('rp-forum-list');
  if (!list) return;
  var posts = rpCurrentRoleData.forum || [];
  if (!posts.length) {
    list.innerHTML = '<div class="rp-list-empty">暂无帖子，点右上角＋生成</div>';
    return;
  }
  list.innerHTML = '';
  posts.forEach(function (post) {
    var item = document.createElement('div');
    item.className = 'rp-forum-item';
    item.innerHTML =
      '<div class="rp-forum-item-header">' +
        '<div class="rp-forum-item-avatar">👤</div>' +
        '<div class="rp-forum-item-name">' +
          ((rpCurrentRole && (rpCurrentRole.nickname || rpCurrentRole.realname)) || '角色') +
        '</div>' +
      '</div>' +
      '<div class="rp-forum-item-title">' + (post.title || '') + '</div>' +
      '<div class="rp-forum-item-footer">' +
        '<div class="rp-forum-item-replies">' + (post.replies ? post.replies.length : 0) + ' 条回复</div>' +
        '<div class="rp-forum-item-time">' + rpFormatTime(post.ts) + '</div>' +
      '</div>';
    item.addEventListener('click', function () { rpOpenForumPost(post.id); });
    list.appendChild(item);
  });
}

function rpOpenForumPost(postId) {
  rpCurrentForumPostId = postId;
  var post = (rpCurrentRoleData.forum || []).find(function (p) { return p.id === postId; });
  if (!post) return;

  var contentEl = document.getElementById('rp-forum-post-content');
  var repliesEl = document.getElementById('rp-forum-replies');
  if (!contentEl || !repliesEl) return;

  contentEl.innerHTML =
    '<div class="rp-forum-post-title">' + (post.title || '') + '</div>' +
    '<div class="rp-forum-post-body">'  + (post.content || '') + '</div>';

  repliesEl.innerHTML = '';
  (post.replies || []).forEach(function (reply) {
    var item = document.createElement('div');
    item.className = 'rp-forum-reply-item';
    item.innerHTML =
      '<div class="rp-forum-reply-header">' +
        '<div class="rp-forum-reply-avatar">' + (reply.avatar || '👤') + '</div>' +
        '<div class="rp-forum-reply-name">'   + (reply.name    || '路人') + '</div>' +
        '<div class="rp-forum-reply-time">'   + rpFormatTime(reply.ts || post.ts) + '</div>' +
      '</div>' +
      '<div class="rp-forum-reply-content">' + (reply.content || '') + '</div>';
    repliesEl.appendChild(item);
  });

  rpShowView('rp-forum-detail-view');
  var inputEl = document.getElementById('rp-forum-reply-input');
  if (inputEl) inputEl.value = '';
}

/* 趣问 + 按钮（正则替换格式） */
document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-forum-add-btn') {
    if (!rpCurrentRole) { alert('角色信息未加载'); return; }
    var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
    var roleSetting = rpCurrentRole.setting || '';
    var extraLimit  = (rpCurrentRoleData.appPromptLimits && rpCurrentRoleData.appPromptLimits.forum) || '';

    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。\n' +
      (extraLimit ? '额外要求：' + extraLimit + '\n' : '') +
      '请生成一条角色在论坛"趣问"App里发的提问帖子，以及路人回复。\n' +
      '输出格式（严格按照以下正则格式，每项占一行）：\n' +
      '[FORUM:title=帖子标题:content=帖子正文100字左右]\n' +
      '[REPLY:name=路人昵称:avatar=emoji:content=回复内容]\n' +
      '生成15到20条REPLY行，回复风格多样，最后一条REPLY的name为' + roleName + '（角色回应某条路人）。\n' +
      '只输出上述格式的行，不输出任何其他内容。';

    rpShowLoading();
    rpCallAPI(
      [{ role: 'system', content: systemPrompt }],
      function (raw) {
        rpHideLoading();
        var forumRe = /\[FORUM:title=([^:]+):content=([^\]]+)\]/;
        var replyRe = /\[REPLY:name=([^:]+):avatar=([^:]+):content=([^\]]+)\]/g;
        var fm = raw.match(forumRe);
        if (!fm) {
          var parsed = rpExtractJSON(raw, 'object');
          if (parsed && parsed.title) {
            var newPost2 = {
              id: 'post_' + Date.now(), title: parsed.title || '',
              content: parsed.content || '', ts: Date.now(),
              replies: (parsed.replies || []).map(function (r) {
                return { name: r.name || '路人', avatar: r.avatar || '👤', content: r.content || '', ts: Date.now() };
              })
            };
            rpCurrentRoleData.forum.unshift(newPost2);
            rpSave(rpCurrentRoleId, rpCurrentRoleData);
            rpRenderForumList();
          } else { alert('生成失败，请重试'); }
          return;
        }
        var title   = fm[1].trim();
        var content = fm[2].trim();
        var replies = [];
        var rm;
        while ((rm = replyRe.exec(raw)) !== null) {
          replies.push({
            name:    rm[1].trim(),
            avatar:  rm[2].trim(),
            content: rm[3].trim(),
            ts:      Date.now()
          });
        }
        var newPost = {
          id:      'post_' + Date.now(),
          title:   title,
          content: content,
          ts:      Date.now(),
          replies: replies
        };
        rpCurrentRoleData.forum.unshift(newPost);
        rpSave(rpCurrentRoleId, rpCurrentRoleData);
        rpRenderForumList();
      },
      function (err) { rpHideLoading(); alert('API 请求失败：' + err); }
    );
  }
});

/* 趣问帖子详情：发送回复 */
document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-forum-reply-send') {
    var inputEl = document.getElementById('rp-forum-reply-input');
    var text    = inputEl ? inputEl.value.trim() : '';
    if (!text) return;
    var post = (rpCurrentRoleData.forum || []).find(function (p) {
      return p.id === rpCurrentForumPostId;
    });
    if (!post) return;
    if (!post.replies) post.replies = [];
    post.replies.push({
      name:    (rpCurrentRole && (rpCurrentRole.nickname || rpCurrentRole.realname)) || '我',
      avatar:  '💬',
      content: text,
      ts:      Date.now()
    });
    rpSave(rpCurrentRoleId, rpCurrentRoleData);
    if (inputEl) inputEl.value = '';
    rpOpenForumPost(rpCurrentForumPostId);
  }
});

/* ================================================================
   通用解析工具（容错版）
   ================================================================ */
function rpExtractJSON(raw, type) {
  if (!raw) return null;
  var str = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (type === 'array') {
    try { var r = JSON.parse(str); if (Array.isArray(r) && r.length) return r; } catch (e) {}
    try {
      var r0 = JSON.parse(str);
      if (r0 && typeof r0 === 'object') {
        var vals = Object.values(r0);
        for (var vi = 0; vi < vals.length; vi++) {
          if (Array.isArray(vals[vi]) && vals[vi].length) return vals[vi];
        }
      }
    } catch (e) {}
    var m1 = str.match(/\[[\s\S]*\]/);
    if (m1) { try { var r2 = JSON.parse(m1[0]); if (Array.isArray(r2) && r2.length) return r2; } catch (e) {} }
    var items = [];
    var objRe = /\{[^{}]*\}/g;
    var om;
    while ((om = objRe.exec(str)) !== null) {
      try { var obj = JSON.parse(om[0]); if (obj && typeof obj === 'object') items.push(obj); } catch (e) {}
    }
    if (items.length) return items;
  } else {
    try { var r3 = JSON.parse(str); if (r3 && typeof r3 === 'object' && !Array.isArray(r3)) return r3; } catch (e) {}
    var m2 = str.match(/\{[\s\S]*\}/);
    if (m2) { try { return JSON.parse(m2[0]); } catch (e) {} }
  }
  return null;
}

/* ================================================================
   梦境 App
   ================================================================ */
function rpInitDreamApp() {
  rpRenderDreamList();
}

function rpRenderDreamList() {
  var list = document.getElementById('rp-dream-list');
  if (!list) return;
  var dreams = rpCurrentRoleData.dreams || [];
  if (!dreams.length) {
    list.innerHTML = '<div class="rp-list-empty">暂无记录，点右上角生成</div>';
    return;
  }
  list.innerHTML = '';
  dreams.forEach(function (d, idx) {
    var item = document.createElement('div');
    item.className = 'rp-generic-item';
    item.innerHTML =
      '<div class="rp-generic-item-main">' +
        '<div class="rp-generic-item-title">' + (d.title || '梦境') + '</div>' +
        '<div class="rp-generic-item-sub">' + (d.date || '') + '</div>' +
      '</div>' +
      '<div class="rp-generic-item-right rp-text-muted">' + (d.mood || '') + '</div>';
    item.addEventListener('click', function () { rpOpenDreamDetail(idx); });
    list.appendChild(item);
  });
}

var rpDreamDetailIdx = -1;
function rpOpenDreamDetail(idx) {
  rpDreamDetailIdx = idx;
  var d = rpCurrentRoleData.dreams[idx];
  if (!d) return;
  var titleEl = document.getElementById('rp-dream-detail-title');
  var contentEl = document.getElementById('rp-dream-detail-content');
  if (titleEl) titleEl.textContent = d.title || '梦境';
  if (contentEl) contentEl.textContent = d.content || '';
  rpShowView('rp-dream-detail-view');
}

document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-dream-del-btn') {
    if (!confirm('确定删除？')) return;
    rpCurrentRoleData.dreams.splice(rpDreamDetailIdx, 1);
    rpSave(rpCurrentRoleId, rpCurrentRoleData);
    rpShowView('rp-dream-view');
    rpRenderDreamList();
  }
});

/* ================================================================
   相册 App
   ================================================================ */
function rpInitAlbumApp() {
  rpRenderAlbumGrid();
}

function rpRenderAlbumGrid() {
  var grid = document.getElementById('rp-album-grid');
  if (!grid) return;
  var photos = rpCurrentRoleData.album || [];
  if (!photos.length) {
    grid.innerHTML = '<div class="rp-list-empty">暂无照片，点右上角生成</div>';
    return;
  }
  grid.innerHTML = '';
  photos.forEach(function (p, idx) {
    var card = document.createElement('div');
    card.className = 'rp-album-card';
    card.innerHTML =
      '<div class="rp-album-card-thumb">' +
        '<i data-lucide="image" style="width:28px;height:28px;color:#aeaeb2;"></i>' +
      '</div>' +
      '<div class="rp-album-card-desc">' + (p.scene || '').slice(0, 18) + '</div>' +
      '<div class="rp-album-card-date">' + (p.date || '') + '</div>';
    card.addEventListener('click', function () { rpOpenAlbumDetail(idx); });
    grid.appendChild(card);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

var rpAlbumDetailIdx = -1;
function rpOpenAlbumDetail(idx) {
  rpAlbumDetailIdx = idx;
  var p = rpCurrentRoleData.album[idx];
  if (!p) return;
  var titleEl   = document.getElementById('rp-album-detail-title');
  var sceneEl   = document.getElementById('rp-album-detail-scene');
  if (titleEl) titleEl.textContent = p.date || '照片';
  if (sceneEl) sceneEl.textContent = p.scene || '';
  rpShowView('rp-album-detail-view');
}

document.addEventListener('click', function (e) {
  if (!e.target || e.target.id !== 'rp-album-del-btn') return;
  if (!confirm('确定删除？')) return;
  rpCurrentRoleData.album.splice(rpAlbumDetailIdx, 1);
  rpSave(rpCurrentRoleId, rpCurrentRoleData);
  rpShowView('rp-album-view');
  rpRenderAlbumGrid();
});

/* ================================================================
   音乐 App
   ================================================================ */
function rpInitMusicApp() {
  rpRenderMusicList();
}

function rpRenderMusicList() {
  var list = document.getElementById('rp-music-list');
  if (!list) return;
  var songs = rpCurrentRoleData.music || [];
  if (!songs.length) {
    list.innerHTML = '<div class="rp-list-empty">暂无歌单，点右上角生成</div>';
    return;
  }
  list.innerHTML = '';
  songs.forEach(function (s, idx) {
    var item = document.createElement('div');
    item.className = 'rp-generic-item';
    item.innerHTML =
      '<div class="rp-generic-item-icon rp-icon-music-sm">' +
        '<i data-lucide="music" style="width:16px;height:16px;color:#fff;"></i>' +
      '</div>' +
      '<div class="rp-generic-item-main">' +
        '<div class="rp-generic-item-title">' + (s.title || '') + '</div>' +
        '<div class="rp-generic-item-sub">' + (s.artist || '') + '</div>' +
      '</div>' +
      '<div class="rp-generic-item-right rp-text-muted">' + (s.duration || '') + '</div>';
    list.appendChild(item);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ================================================================
   购物车 App
   ================================================================ */
function rpInitShopApp() {
  rpRenderShopList();
}

function rpRenderShopList() {
  var list = document.getElementById('rp-shop-list');
  if (!list) return;
  var items = rpCurrentRoleData.shop || [];
  if (!items.length) {
    list.innerHTML = '<div class="rp-list-empty">暂无商品，点右上角生成</div>';
    return;
  }
  list.innerHTML = '';
  items.forEach(function (s) {
    var item = document.createElement('div');
    item.className = 'rp-generic-item';
    item.innerHTML =
      '<div class="rp-generic-item-icon rp-icon-shop-sm">' +
        '<i data-lucide="package" style="width:16px;height:16px;color:#fff;"></i>' +
      '</div>' +
      '<div class="rp-generic-item-main">' +
        '<div class="rp-generic-item-title">' + (s.name || '') + '</div>' +
        '<div class="rp-generic-item-sub">' + (s.note || '') + '</div>' +
      '</div>' +
      '<div class="rp-generic-item-right" style="color:#ff9500;font-weight:600;">¥' + (s.price || '0') + '</div>';
    list.appendChild(item);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ================================================================
   步数 App
   ================================================================ */
function rpInitStepsApp() {
  rpRenderStepsData();
}

function rpRenderStepsData() {
  var totalEl    = document.getElementById('rp-steps-total');
  var distanceEl = document.getElementById('rp-steps-distance');
  var listEl     = document.getElementById('rp-steps-list');
  if (!listEl) return;

  var records = rpCurrentRoleData.steps || [];
  var today   = new Date().toDateString();
  var todayRec = records.find(function (r) { return r.date === today; });

  if (!todayRec) {
    if (totalEl)    totalEl.textContent    = '0';
    if (distanceEl) distanceEl.textContent = '';
    listEl.innerHTML = '<div class="rp-list-empty">暂无数据，点右上角生成</div>';
    return;
  }

  if (totalEl)    totalEl.textContent    = (todayRec.steps || 0).toLocaleString();
  if (distanceEl) distanceEl.textContent = '约 ' + (todayRec.distance || '0') + ' km · 消耗 ' + (todayRec.calories || '0') + ' kcal';

  listEl.innerHTML = '';
  var periods = todayRec.periods || [];
  periods.forEach(function (p) {
    var item = document.createElement('div');
    item.className = 'rp-generic-item';
    item.innerHTML =
      '<div class="rp-generic-item-main">' +
        '<div class="rp-generic-item-title">' + (p.label || '') + '</div>' +
      '</div>' +
      '<div class="rp-generic-item-right" style="color:#34c759;font-weight:600;">' + (p.steps || 0) + ' 步</div>';
    listEl.appendChild(item);
  });
}

/* ================================================================
   通话记录 App
   ================================================================ */
function rpInitCallApp() {
  rpRenderCallList();
}

function rpRenderCallList() {
  var list = document.getElementById('rp-call-list');
  if (!list) return;
  var calls = rpCurrentRoleData.calls || [];
  if (!calls.length) {
    list.innerHTML = '<div class="rp-list-empty">暂无记录，点右上角生成</div>';
    return;
  }
  list.innerHTML = '';
  calls.forEach(function (c) {
    var item = document.createElement('div');
    item.className = 'rp-generic-item';
    var iconName   = c.type === 'missed' ? 'phone-missed' : c.type === 'outgoing' ? 'phone-outgoing' : 'phone-incoming';
    var iconColor  = c.type === 'missed' ? '#ff3b30' : c.type === 'outgoing' ? '#007aff' : '#34c759';
    item.innerHTML =
      '<div class="rp-call-icon">' +
        '<i data-lucide="' + iconName + '" style="width:18px;height:18px;color:' + iconColor + ';"></i>' +
      '</div>' +
      '<div class="rp-generic-item-main">' +
        '<div class="rp-generic-item-title">' + (c.name || '') + '</div>' +
        '<div class="rp-generic-item-sub">' + (c.relation || '') + '</div>' +
      '</div>' +
      '<div class="rp-generic-item-right rp-text-muted">' +
        '<div>' + (c.time || '') + '</div>' +
        '<div style="font-size:11px;">' + (c.duration || '') + '</div>' +
      '</div>';
    list.appendChild(item);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ================================================================
   钱包 App
   ================================================================ */
function rpInitWalletApp() {
  rpRenderWalletList();
}

function rpRenderWalletList() {
  var totalEl = document.getElementById('rp-wallet-total');
  var listEl  = document.getElementById('rp-wallet-list');
  if (!listEl) return;
  var bills = rpCurrentRoleData.wallet || [];
  if (!bills.length) {
    if (totalEl) totalEl.textContent = '0.00 元';
    listEl.innerHTML = '<div class="rp-list-empty">暂无账单，点右上角生成</div>';
    return;
  }
  var total = bills.reduce(function (s, b) { return s + (parseFloat(b.amount) || 0); }, 0);
  if (totalEl) totalEl.textContent = total.toFixed(2) + ' 元';
  listEl.innerHTML = '';
  bills.forEach(function (b) {
    var item = document.createElement('div');
    item.className = 'rp-generic-item';
    var isIncome = b.type === 'income';
    item.innerHTML =
      '<div class="rp-generic-item-icon" style="background:' + (isIncome ? '#34c759' : '#ff9500') + ';width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;">' +
        '<i data-lucide="' + (isIncome ? 'trending-up' : 'trending-down') + '" style="width:16px;height:16px;color:#fff;"></i>' +
      '</div>' +
      '<div class="rp-generic-item-main">' +
        '<div class="rp-generic-item-title">' + (b.desc || '') + '</div>' +
        '<div class="rp-generic-item-sub">' + (b.time || '') + '</div>' +
      '</div>' +
      '<div class="rp-generic-item-right" style="color:' + (isIncome ? '#34c759' : '#ff3b30') + ';font-weight:600;">' +
        (isIncome ? '+' : '-') + '¥' + (b.amount || '0') +
      '</div>';
    listEl.appendChild(item);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ================================================================
   追剧 App
   ================================================================ */
function rpInitDramaApp() {
  rpRenderDramaList();
}

function rpRenderDramaList() {
  var list = document.getElementById('rp-drama-list');
  if (!list) return;
  var dramas = rpCurrentRoleData.drama || [];
  if (!dramas.length) {
    list.innerHTML = '<div class="rp-list-empty">暂无追剧，点右上角生成</div>';
    return;
  }
  list.innerHTML = '';
  dramas.forEach(function (d) {
    var item = document.createElement('div');
    item.className = 'rp-generic-item';
    var pct = d.total > 0 ? Math.round((d.watched / d.total) * 100) : 0;
    item.innerHTML =
      '<div class="rp-generic-item-icon rp-icon-drama-sm">' +
        '<i data-lucide="clapperboard" style="width:16px;height:16px;color:#fff;"></i>' +
      '</div>' +
      '<div class="rp-generic-item-main">' +
        '<div class="rp-generic-item-title">' + (d.title || '') + '</div>' +
        '<div class="rp-generic-item-sub">已看 ' + (d.watched || 0) + ' / ' + (d.total || '?') + ' 集</div>' +
        '<div class="rp-health-bar-wrap" style="margin-top:4px;">' +
          '<div class="rp-health-bar-fill" style="width:' + pct + '%;background:linear-gradient(90deg,#bf5af2,#d870f0);"></div>' +
        '</div>' +
      '</div>' +
      '<div class="rp-generic-item-right rp-text-muted" style="font-size:11px;">' + (d.status || '') + '</div>';
    list.appendChild(item);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ================================================================
   外卖 App
   ================================================================ */
function rpInitFoodApp() {
  rpRenderFoodList();
}

function rpRenderFoodList() {
  var list = document.getElementById('rp-food-list');
  if (!list) return;
  var orders = rpCurrentRoleData.food || [];
  if (!orders.length) {
    list.innerHTML = '<div class="rp-list-empty">暂无订单，点右上角生成</div>';
    return;
  }
  list.innerHTML = '';
  orders.forEach(function (o) {
    var item = document.createElement('div');
    item.className = 'rp-generic-item';
    item.innerHTML =
      '<div class="rp-generic-item-icon rp-icon-food-sm">' +
        '<i data-lucide="utensils" style="width:16px;height:16px;color:#fff;"></i>' +
      '</div>' +
      '<div class="rp-generic-item-main">' +
        '<div class="rp-generic-item-title">' + (o.shop || '') + '</div>' +
        '<div class="rp-generic-item-sub">' + (o.items || '') + '</div>' +
      '</div>' +
      '<div class="rp-generic-item-right rp-text-muted">' +
        '<div style="color:#ff9500;font-weight:600;">¥' + (o.amount || '0') + '</div>' +
        '<div style="font-size:11px;">' + (o.time || '') + '</div>' +
      '</div>';
    list.appendChild(item);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ================================================================
   工具函数
   ================================================================ */
function rpFormatTime(ts) {
  if (!ts) return '';
  var now  = Date.now();
  var diff = now - ts;
  if (diff < 60000)    return '刚刚';
  if (diff < 3600000)  return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  var d  = new Date(ts);
  return (d.getMonth() + 1) + '/' + d.getDate();
}

/* ================================================================
   暴露全局接口
   ================================================================ */
window.RolePhone = {
  open:  rpOpen,
  close: rpClose
};

/* ================================================================
   csb-rolephone 按钮入口（统一在此处理，liao-special.js 不重复绑定）
   ================================================================ */
(function bindRpEntry() {
  document.addEventListener('click', function (e) {
    if (!e.target) return;
    var btn = e.target.id === 'csb-rolephone'
      ? e.target
      : e.target.closest && e.target.closest('#csb-rolephone');
    if (!btn) return;

    if (!window._liaoDataReady) {
      alert('数据加载中，请稍后再试');
      return;
    }
    if (typeof currentChatIdx === 'undefined' || currentChatIdx < 0) {
      alert('请先打开一个聊天');
      return;
    }
    var chat = liaoChats[currentChatIdx];
    if (!chat) {
      alert('请先打开一个聊天');
      return;
    }
    rpOpen(chat.roleId);
  });
})();


/* ================================================================
   角色手机设置页逻辑
   ================================================================ */
function rpGetCurrentRoleId() {
  if (typeof currentChatIdx === 'undefined' || currentChatIdx < 0) return '';
  var chat = liaoChats[currentChatIdx];
  return chat ? chat.roleId : '';
}

function rpUpdatePinStatus() {
  var roleId   = rpGetCurrentRoleId();
  var statusEl = document.getElementById('rp-pin-status');
  if (!statusEl) return;
  if (!roleId) { statusEl.textContent = '未设置'; return; }
  var data = rpLoad(roleId);
  statusEl.textContent = (data.pin && data.pin.length === 4) ? '已设置（4位）' : '未设置';
}

function rpLoadSettingsPage() {
  var roleId = rpGetCurrentRoleId();
  if (!roleId) return;
  var data = rpLoad(roleId);

  rpUpdatePinStatus();

  var wpEl = document.getElementById('rp-wallpaper-url');
  if (wpEl) wpEl.value = data.wallpaper || '';
  var poEl = document.getElementById('rp-polaroid-url');
  if (poEl) poEl.value = data.polaroidImg || '';

  var limits = data.appPromptLimits || {};
  var liao   = document.getElementById('rp-limit-liao');
  var notes  = document.getElementById('rp-limit-notes');
  var health = document.getElementById('rp-limit-health');
  var forum  = document.getElementById('rp-limit-forum');
  if (liao)   liao.value   = limits.liao   || '';
  if (notes)  notes.value  = limits.notes  || '';
  if (health) health.value = limits.health || '';
  if (forum)  forum.value  = limits.forum  || '';

  var icons   = data.appIcons || {};
  var iLiao   = document.getElementById('rp-icon-liao');
  var iNotes  = document.getElementById('rp-icon-notes');
  var iHealth = document.getElementById('rp-icon-health');
  var iForum  = document.getElementById('rp-icon-forum');
  if (iLiao)   iLiao.value   = icons.liao   || '';
  if (iNotes)  iNotes.value  = icons.notes  || '';
  if (iHealth) iHealth.value = icons.health || '';
  if (iForum)  iForum.value  = icons.forum  || '';
}

var origSwitchChatSettingsTab = (typeof switchChatSettingsTab === 'function') ? switchChatSettingsTab : null;
switchChatSettingsTab = function (tabId) {
  if (origSwitchChatSettingsTab) origSwitchChatSettingsTab(tabId);
  if (tabId === 'cs-tab-rolephone') rpLoadSettingsPage();
};

document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-ai-gen-pin-btn') {
    var roleId = rpGetCurrentRoleId();
    if (!roleId) { alert('请先打开一个聊天'); return; }
    var role = liaoRoles.find(function (r) { return r.id === roleId; });
    if (!role) return;
    var roleName    = role.nickname || role.realname || '角色';
    var roleSetting = role.setting || '';
    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。' +
      '请为你的手机设置一个4位数密码，只输出4位数字，不输出任何其他内容。';
    var msgEl = document.getElementById('rp-pin-msg');
    if (msgEl) { msgEl.style.color = '#9aafc4'; msgEl.textContent = 'AI 生成中…'; }

    rpCallAPI(
      [{ role: 'system', content: systemPrompt }],
      function (raw) {
        var pin = raw.replace(/\D/g, '').slice(0, 4);
        if (pin.length !== 4) {
          if (msgEl) { msgEl.style.color = '#e07a7a'; msgEl.textContent = '生成的密码格式不正确，请重试'; }
          return;
        }
        var data = rpLoad(roleId);
        data.pin = pin;
        rpSave(roleId, data);

        var chat = liaoChats.find(function (c) { return c.roleId === roleId; });
        if (chat) {
          if (!chat.memory) chat.memory = { longTerm: [], shortTerm: [], important: [], other: {} };
          if (!chat.memory.other) chat.memory.other = {};
          if (!chat.memory.other.rolephone) chat.memory.other.rolephone = [];
          chat.memory.other.rolephone.push({
            id: 'rpmem_' + Date.now(), content: '我的手机密码是' + pin, ts: Date.now()
          });
          lSave('chats', liaoChats);
        }
        rpUpdatePinStatus();
        if (msgEl) { msgEl.style.color = '#4caf84'; msgEl.textContent = 'AI 已生成密码并保存（密码已存入角色记忆）'; }
        setTimeout(function () { if (msgEl) msgEl.textContent = ''; }, 3000);
      },
      function (err) {
        if (msgEl) { msgEl.style.color = '#e07a7a'; msgEl.textContent = '生成失败：' + err; }
      }
    );
  }
});

document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-manual-pin-btn') {
    var roleId = rpGetCurrentRoleId();
    if (!roleId) { alert('请先打开一个聊天'); return; }
    var pin = prompt('请输入4位数字密码');
    if (!pin) return;
    if (!/^\d{4}$/.test(pin)) { alert('密码必须为4位数字'); return; }
    var data = rpLoad(roleId);
    data.pin = pin;
    rpSave(roleId, data);
    rpUpdatePinStatus();
    var msgEl = document.getElementById('rp-pin-msg');
    if (msgEl) { msgEl.style.color = '#4caf84'; msgEl.textContent = '密码已保存'; }
    setTimeout(function () { if (msgEl) msgEl.textContent = ''; }, 2000);
  }
});

document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-clear-pin-btn') {
    var roleId = rpGetCurrentRoleId();
    if (!roleId) return;
    if (!confirm('确定清除手机密码？')) return;
    var data = rpLoad(roleId);
    data.pin = '';
    rpSave(roleId, data);
    rpUpdatePinStatus();
    var msgEl = document.getElementById('rp-pin-msg');
    if (msgEl) { msgEl.style.color = '#4caf84'; msgEl.textContent = '密码已清除'; }
    setTimeout(function () { if (msgEl) msgEl.textContent = ''; }, 2000);
  }
});

document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-wallpaper-local-btn') {
    var fi = document.getElementById('rp-wallpaper-file');
    if (fi) fi.click();
  }
});
document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'rp-wallpaper-file') {
    var file = e.target.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var urlEl = document.getElementById('rp-wallpaper-url');
      if (urlEl) urlEl.value = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }
});

document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-polaroid-local-btn') {
    var fi = document.getElementById('rp-polaroid-file');
    if (fi) fi.click();
  }
});
document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'rp-polaroid-file') {
    var file = e.target.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var urlEl = document.getElementById('rp-polaroid-url');
      if (urlEl) urlEl.value = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }
});

document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-settings-save-btn') {
    var roleId = rpGetCurrentRoleId();
    if (!roleId) { alert('请先打开一个聊天'); return; }
    var data = rpLoad(roleId);

    var wpVal = (document.getElementById('rp-wallpaper-url') || {}).value || '';
    var poVal = (document.getElementById('rp-polaroid-url')  || {}).value || '';
    data.wallpaper   = wpVal.trim();
    data.polaroidImg = poVal.trim();

    data.appPromptLimits = {
      liao:   ((document.getElementById('rp-limit-liao')   || {}).value || '').trim(),
      notes:  ((document.getElementById('rp-limit-notes')  || {}).value || '').trim(),
      health: ((document.getElementById('rp-limit-health') || {}).value || '').trim(),
      forum:  ((document.getElementById('rp-limit-forum')  || {}).value || '').trim()
    };

    data.appIcons = {
      liao:   ((document.getElementById('rp-icon-liao')   || {}).value || '').trim(),
      notes:  ((document.getElementById('rp-icon-notes')  || {}).value || '').trim(),
      health: ((document.getElementById('rp-icon-health') || {}).value || '').trim(),
      forum:  ((document.getElementById('rp-icon-forum')  || {}).value || '').trim()
    };

    rpSave(roleId, data);
    alert('角色手机设置已保存');
  }
});
