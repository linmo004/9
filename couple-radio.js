/* ============================================================
   couple-radio.js — 心情电台模块
   ============================================================ */

const CP_QUICK_STATUSES = [
  '睡觉中 💤', '想你了 🌙', '在吃饭 🍜', '在忙 📚',
  '发呆中 ☁️', '心情好 ✨', '有点累 😪', '在外面 🚶',
  '想聊天 💬', '不开心 🌧', '在听歌 🎵', '刚到家 🏠'
];

function cpRenderRadio() {
  const panel = document.getElementById('couple-panel-radio');
  if (!panel || !cpCurrentSpace) return;

  const radio      = cpCurrentSpace.radio;
  const userName   = cpGetUserName();
  const userAvatar = cpGetUserAvatar();
  const roleName   = cpGetRoleName(cpCurrentRole);
  const roleAvatar = cpGetRoleAvatar(cpCurrentRole);

  const quickBtns = CP_QUICK_STATUSES.map(s =>
    '<button class="cp-radio-quick-btn" data-status="' + escHtml(s) + '">' +
    escHtml(s) + '</button>'
  ).join('');

  const tlHtml = (radio.timeline || []).slice(-30).reverse().map(item => {
    const isUser = item.who === 'user';
    return '<div class="cp-radio-tl-item">' +
      '<img class="cp-radio-tl-avatar" src="' +
        escHtml(isUser ? userAvatar : roleAvatar) + '" alt="">' +
      '<div class="cp-radio-tl-body">' +
        '<div class="cp-radio-tl-name">' +
          escHtml(isUser ? userName : roleName) + '</div>' +
        '<div class="cp-radio-tl-text">' + escHtml(item.text) + '</div>' +
      '</div>' +
      '<div class="cp-radio-tl-time">' + cpFmtTime(item.ts) + '</div>' +
      '</div>';
  }).join('');

  panel.innerHTML = `
    <div class="cp-radio-title">心情电台</div>
    <div class="cp-radio-sub">分享此刻，让彼此感受到你</div>

    <div class="cp-radio-bubbles">
      <div class="cp-radio-bubble">
        <img class="cp-radio-bubble-avatar" src="${escHtml(userAvatar)}" alt="">
        <div class="cp-radio-bubble-name">${escHtml(userName)}</div>
        <div class="cp-radio-bubble-status" id="cp-radio-user-status">
          ${radio.userStatus
            ? escHtml(radio.userStatus)
            : '<span style="opacity:.4">暂无状态</span>'}
        </div>
        <div class="cp-radio-bubble-time">
          ${radio.userStatusTs ? cpFmtTime(radio.userStatusTs) : ''}
        </div>
      </div>
      <div class="cp-radio-bubble">
        <img class="cp-radio-bubble-avatar" src="${escHtml(roleAvatar)}" alt="">
        <div class="cp-radio-bubble-name">${escHtml(roleName)}</div>
        <div class="cp-radio-bubble-status" id="cp-radio-role-status">
          ${radio.roleStatus
            ? escHtml(radio.roleStatus)
            : '<span style="opacity:.4">暂无状态</span>'}
        </div>
        <div class="cp-radio-bubble-time">
          ${radio.roleStatusTs ? cpFmtTime(radio.roleStatusTs) : ''}
        </div>
      </div>
    </div>

    <div class="cp-radio-quick-title">QUICK STATUS · 快捷状态</div>
    <div class="cp-radio-quick-grid" id="cp-radio-quick-grid">
      ${quickBtns}
    </div>

    <div class="cp-radio-custom-row">
      <input class="cp-radio-custom-input" id="cp-radio-custom-input"
        placeholder="自定义状态…" maxlength="30">
      <button class="cp-radio-send-btn" id="cp-radio-send-btn">发送</button>
    </div>

    ${tlHtml ? `
    <div class="cp-radio-timeline-title">TODAY · 今日状态流</div>
    <div class="cp-radio-timeline">${tlHtml}</div>` : ''}
  `;

  /* 快捷状态 */
  panel.querySelectorAll('.cp-radio-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      cpSendUserStatus(btn.dataset.status);
    });
  });

  /* 自定义发送 */
  document.getElementById('cp-radio-send-btn') &&
  document.getElementById('cp-radio-send-btn').addEventListener('click', () => {
    const input = document.getElementById('cp-radio-custom-input');
    const val   = (input && input.value.trim()) || '';
    if (!val) return;
    cpSendUserStatus(val);
    if (input) input.value = '';
  });

  document.getElementById('cp-radio-custom-input') &&
  document.getElementById('cp-radio-custom-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const val = e.target.value.trim();
      if (!val) return;
      cpSendUserStatus(val);
      e.target.value = '';
    }
  });
}

function cpSendUserStatus(text) {
  if (!cpCurrentSpace) return;
  const radio = cpCurrentSpace.radio;
  radio.userStatus   = text;
  radio.userStatusTs = Date.now();
  if (!radio.timeline) radio.timeline = [];
  radio.timeline.push({ who: 'user', text, ts: Date.now() });
  if (radio.timeline.length > 100) radio.timeline = radio.timeline.slice(-100);
  cpSaveSpace();
  cpRenderRadio();

  /* AI 角色回应 */
  cpRoleRespondToStatus(text);
}

async function cpRoleRespondToStatus(userStatus) {
  if (!cpCurrentRole) return;
  const config = loadApiConfig();
  if (!config || !config.url) return;
  const model = loadApiModel();
  if (!model) return;

  const userName = cpGetUserName();
  const roleName = cpGetRoleName(cpCurrentRole);

  const prompt =
    '你是' + roleName + '，' + (cpCurrentRole.setting || '') + '。\n' +
    userName + '刚刚发了一条心情状态：「' + userStatus + '」。\n' +
    '请你用一句简短的口语回应这个状态，像发消息一样，不超过20字，' +
    '符合你的角色性格，有情绪，自然真实。只输出回应内容本身。';

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

    const radio = cpCurrentSpace.radio;
    radio.roleStatus   = content;
    radio.roleStatusTs = Date.now();
    if (!radio.timeline) radio.timeline = [];
    radio.timeline.push({ who: 'role', text: content, ts: Date.now() });
    cpSaveSpace();

    if (cpCurrentTab === 'radio') cpRenderRadio();
    if (cpCurrentTab === 'home')  cpRenderHome();

  } catch (e) { /* 静默 */ }
}
