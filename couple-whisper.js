/* ============================================================
   couple-whisper.js — 悄悄话模块
   ============================================================ */

function cpRenderWhisper() {
  const panel = document.getElementById('couple-panel-whisper');
  if (!panel || !cpCurrentSpace) return;

  const notes    = cpCurrentSpace.whisper.notes || [];
  const userName = cpGetUserName();
  const roleName = cpGetRoleName(cpCurrentRole);

  panel.innerHTML = `
    <div class="cp-whisper-header">
      <div class="cp-whisper-header-title">悄悄话</div>
      <div class="cp-whisper-header-sub">只有你们才能看到的地方</div>
    </div>
    <button class="cp-whisper-write-btn" id="cp-whisper-write-btn">
      写给 ${escHtml(roleName)} ✉
    </button>
    <div class="cp-whisper-list" id="cp-whisper-list"></div>
  `;

  const listEl = document.getElementById('cp-whisper-list');
  if (!notes.length) {
    listEl.innerHTML =
      '<div class="cp-empty" style="color:rgba(255,255,255,0.3);">' +
      '还没有悄悄话<br>写下第一句话吧</div>';
  } else {
    /* 置顶的排前面 */
    const sorted = [...notes].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.ts - a.ts;
    });
    sorted.forEach(note => {
      listEl.appendChild(cpBuildWhisperCard(note, userName, roleName));
    });
  }

  document.getElementById('cp-whisper-write-btn') &&
  document.getElementById('cp-whisper-write-btn').addEventListener('click',
    cpOpenWhisperWriteModal);
}

function cpBuildWhisperCard(note, userName, roleName) {
  const isUser = note.authorType === 'user';
  const avatar = isUser ? cpGetUserAvatar() : cpGetRoleAvatar(cpCurrentRole);
  const name   = isUser ? userName : roleName;

  const card = document.createElement('div');
  card.className = 'cp-whisper-card ' + (isUser ? 'from-user' : 'from-role');

  const pinnedBadge = note.pinned
    ? '<span class="cp-whisper-card-pinned">置顶</span>' : '';

  let replyHtml = '';
  if (note.reply) {
    replyHtml =
      '<div class="cp-whisper-reply-area">' +
        '<div class="cp-whisper-reply-label">' + escHtml(roleName) + ' 回信</div>' +
        '<div class="cp-whisper-reply-text">' + escHtml(note.reply) + '</div>' +
      '</div>';
  }

  let actionsHtml = '';
  if (isUser) {
    actionsHtml =
      '<div class="cp-whisper-card-actions">' +
        (!note.reply
          ? '<button class="cp-whisper-action-btn primary-action" data-action="ask-reply" ' +
            'data-noteid="' + note.id + '">请求回信（调用 API）</button>'
          : '') +
        '<button class="cp-whisper-action-btn" data-action="pin" ' +
          'data-noteid="' + note.id + '">' + (note.pinned ? '取消置顶' : '置顶') + '</button>' +
        '<button class="cp-whisper-action-btn" data-action="delete" ' +
          'data-noteid="' + note.id + '">删除</button>' +
      '</div>';
  }

  card.innerHTML =
    '<div class="cp-whisper-card-top">' +
      '<img class="cp-whisper-card-avatar" src="' + escHtml(avatar) + '" alt="">' +
      '<div class="cp-whisper-card-name">' + escHtml(name) + '</div>' +
      pinnedBadge +
      '<div class="cp-whisper-card-time">' + cpFmtTime(note.ts) + '</div>' +
    '</div>' +
    '<div class="cp-whisper-card-text">' + escHtml(note.text) + '</div>' +
    replyHtml +
    actionsHtml;

  /* 按钮事件 */
  card.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const noteId = btn.dataset.noteid;
      const n = cpCurrentSpace.whisper.notes.find(x => x.id === noteId);
      if (!n) return;

      if (action === 'ask-reply') {
        cpRequestWhisperReply(noteId);
      } else if (action === 'pin') {
        n.pinned = !n.pinned;
        cpSaveSpace();
        cpRenderWhisper();
      } else if (action === 'delete') {
        if (!confirm('确定删除这条悄悄话？')) return;
        const idx = cpCurrentSpace.whisper.notes.findIndex(x => x.id === noteId);
        if (idx >= 0) cpCurrentSpace.whisper.notes.splice(idx, 1);
        cpSaveSpace();
        cpRenderWhisper();
      }
    });
  });

  return card;
}

/* ---- 用户写悄悄话弹窗 ---- */
function cpOpenWhisperWriteModal() {
  const existing = document.getElementById('cp-whisper-write-modal');
  if (existing) existing.remove();

  const roleName = cpGetRoleName(cpCurrentRole);

  const mask = document.createElement('div');
  mask.id        = 'cp-whisper-write-modal';
  mask.className = 'cp-modal-mask show';
  mask.innerHTML = `
    <div class="cp-modal-box" style="background:#0d1b3e;">
      <div class="cp-modal-title" style="color:#e8eaf6;">
        写给 ${escHtml(roleName)}
      </div>
      <textarea class="cp-modal-textarea" id="cp-whisper-text"
        style="background:#12213a;color:#e8eaf6;border-color:#1e3a5f;min-height:140px;"
        placeholder="想说的话，只有你们能看到…"></textarea>
      <div class="cp-modal-btns">
        <button class="cp-btn-primary" id="cp-whisper-save-btn">发送</button>
        <button class="cp-btn-ghost"   id="cp-whisper-cancel-btn"
          style="background:#12213a;color:#7986cb;border-color:#1e3a5f;">取消</button>
      </div>
    </div>
  `;

  document.body.appendChild(mask);

  document.getElementById('cp-whisper-save-btn').addEventListener('click', () => {
    const text = (document.getElementById('cp-whisper-text').value || '').trim();
    if (!text) { alert('请写点什么'); return; }

    if (!cpCurrentSpace.whisper)       cpCurrentSpace.whisper       = { notes: [] };
    if (!cpCurrentSpace.whisper.notes) cpCurrentSpace.whisper.notes = [];

    cpCurrentSpace.whisper.notes.push({
      id:         'whisper_' + Date.now() + '_' + Math.random().toString(36).slice(2),
      authorType: 'user',
      text,
      ts:         Date.now(),
      pinned:     false,
      reply:      ''
    });

    cpSaveSpace();
    mask.remove();
    cpRenderWhisper();
  });

  document.getElementById('cp-whisper-cancel-btn').addEventListener('click',
    () => mask.remove());
  mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
}

/* ---- 请求角色回信（调用 API） ---- */
async function cpRequestWhisperReply(noteId) {
  const config = loadApiConfig();
  if (!config || !config.url) { alert('请先在设置中配置 API 地址'); return; }
  const model = loadApiModel();
  if (!model) { alert('请先选择模型'); return; }

  const note = cpCurrentSpace.whisper.notes.find(n => n.id === noteId);
  if (!note) return;

  const roleName = cpGetRoleName(cpCurrentRole);
  const userName = cpGetUserName();

  const prompt =
    '你是' + roleName + '，' + (cpCurrentRole.setting || '') + '。\n' +
    userName + '给你写了一封悄悄话：\n「' + note.text + '」\n\n' +
    '请以' + roleName + '的身份回信，字数100字以内，' +
    '口语化，符合你的性格，真诚温柔，像写给对方的私信。\n' +
    '只输出回信内容本身。';

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
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const json    = await res.json();
    const content = (json.choices?.[0]?.message?.content || '').trim();
    if (!content) return;

    note.reply = content;
    cpSaveSpace();
    cpRenderWhisper();

  } catch (e) {
    alert('API 请求失败：' + e.message);
  }
}

/* ---- 角色自动发悄悄话（定时触发） ---- */
async function cpAutoWhisper() {
  const config = loadApiConfig();
  if (!config || !config.url) return;
  const model = loadApiModel();
  if (!model) return;
  if (!cpCurrentRole || !cpCurrentSpace) return;

  const roleName = cpGetRoleName(cpCurrentRole);
  const userName = cpGetUserName();

  const prompt =
    '你是' + roleName + '，' + (cpCurrentRole.setting || '') + '。\n' +
    '你想给' + userName + '发一条悄悄话，内容随意：\n' +
    '可以是想念、心情、今天发生的小事、对' + userName + '想说的话等。\n' +
    '要求：50字以内，口语化，私密温柔，像只说给对方听的话。\n' +
    '只输出悄悄话内容本身。';

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

    if (!cpCurrentSpace.whisper)       cpCurrentSpace.whisper       = { notes: [] };
    if (!cpCurrentSpace.whisper.notes) cpCurrentSpace.whisper.notes = [];

    cpCurrentSpace.whisper.notes.push({
      id:         'whisper_role_' + Date.now() + '_' + Math.random().toString(36).slice(2),
      authorType: 'role',
      text:       content,
      ts:         Date.now(),
      pinned:     false,
      reply:      ''
    });

    cpSaveSpace();
    if (cpCurrentTab === 'whisper') cpRenderWhisper();

  } catch (e) { /* 静默 */ }
}
