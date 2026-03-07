/* ============================================================
   liao-special.js — 特殊功能状态栏 / 时间戳 / 消息操作
                     表情包 / 语音 / 转账 / 假图片 / 真图片
   注意：openChatView / sendUserMessage / renderRoleLib
         均在 liao-chat.js 中唯一定义，此文件不重定义它们。
   ============================================================ */

/* ---------- 全局状态（由 liao-chat.js 之后加载，可安全引用） ---------- */
var liaoEmojis    = lLoad('emojis',    []);
var liaoEmojiCats = lLoad('emojiCats', ['默认']);

var currentQuoteMsgIdx   = -1;
var pendingImageSrc       = '';
var emojiManageSelectedIds = [];
var emojiManageCurrentCat  = 'all';
var currentTransferMsgId   = null;
var editingMsgIdx          = -1;
var emojiPanelOpen         = false;
var emojiCurrentCat        = 'all';

/* ============================================================
   appendMessageBubble — 全类型气泡渲染
   ============================================================ */
function appendMessageBubble(msg, role, chatUserAvatar, animate) {
  const area       = document.getElementById('liao-chat-messages');
  const roleAvatar = (role && role.avatar) ? role.avatar : defaultAvatar();
  const uAvatar    = chatUserAvatar || liaoUserAvatar;
  const isUser     = msg.role === 'user';

  if (!msg.id) {
    msg.id = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  }

  /* 撤回消息 */
  if (msg.recalled) {
    const recallRow = document.createElement('div');
    recallRow.className    = 'recall-notice';
    recallRow.dataset.msgId = msg.id;
    const who = isUser
      ? '你'
      : (role ? (role.nickname || role.realname) : '对方');
    recallRow.textContent = who + ' 撤回了一条消息';
    recallRow.addEventListener('click', () => {
      document.getElementById('liao-recall-view-content').textContent = msg.recalledContent || '';
      document.getElementById('liao-recall-view-modal').style.display = 'flex';
    });
    area.appendChild(recallRow);
    scrollChatToBottom();
    return;
  }

  const row = document.createElement('div');
  row.className   = 'chat-msg-row' + (isUser ? ' user-row' : '');
  row.dataset.msgId = msg.id;

  /* 时间戳元素 */
  const tsEl = document.createElement('span');
  tsEl.className      = 'chat-msg-timestamp';
  tsEl.dataset.msgId  = msg.id;
  tsEl.textContent    = formatFullTime(msg.ts);
  tsEl.addEventListener('click', (e) => {
    e.stopPropagation();
    openMsgActionMenu(e, msg.id);
  });

  /* 气泡内容 */
  const msgType  = msg.type || 'text';
  let bubbleInner = '';

  if (msg.quoteContent) {
    bubbleInner += `<div class="msg-quote-block">${escHtml(msg.quoteContent)}</div>`;
  }

  if (msgType === 'voice') {
    const duration = calcVoiceDuration(msg.content);
    bubbleInner = `<div class="voice-bubble" title="点击查看语音内容">
      <span class="voice-bubble-icon">◎</span>
      <div class="voice-bubble-bar">${buildVoiceWaves(duration)}</div>
      <span class="voice-bubble-duration">${duration}"</span>
    </div>`;

  } else if (msgType === 'transfer') {
    const statusText  = msg.transferStatus === 'accepted' ? '已收款'
                      : msg.transferStatus === 'declined' ? '已拒绝' : '待收款';
    const statusClass = msg.transferStatus === 'accepted' ? 'accepted'
                      : msg.transferStatus === 'declined' ? 'declined' : '';
    bubbleInner = `<div class="transfer-bubble" data-msg-id="${escHtml(msg.id)}">
      <div class="transfer-bubble-header">
        <span class="transfer-bubble-icon">◇</span>
        <span class="transfer-bubble-amount">${parseFloat(msg.amount || 0).toFixed(2)} 元</span>
      </div>
      ${msg.note ? `<div class="transfer-bubble-note">${escHtml(msg.note)}</div>` : ''}
      <div class="transfer-bubble-status ${statusClass}">${statusText}</div>
    </div>`;

  } else if (msgType === 'fake_photo') {
    const shortDesc = (msg.content || '照片').slice(0, 12) + ((msg.content || '').length > 12 ? '…' : '');
    bubbleInner = `<div class="fake-photo-bubble" data-photo-desc="${escHtml(msg.content)}">
      <div class="fake-photo-bubble-inner">
        <span class="fake-photo-icon">▤</span>
        <span class="fake-photo-label">${escHtml(shortDesc)}</span>
      </div>
    </div>`;

  } else if (msgType === 'image') {
    bubbleInner = `<img class="real-image-bubble" src="${escHtml(msg.content)}" alt="图片">`;

  } else if (msgType === 'emoji') {
    bubbleInner = `<img class="emoji-msg-bubble" src="${escHtml(msg.content)}"
      alt="${escHtml(msg.emojiName || '表情包')}"
      title="${escHtml(msg.emojiName || '')}">`;

  } else {
    /* 普通文字 */
    bubbleInner += escHtml(msg.content);
  }

  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'chat-msg-bubble';
  bubbleEl.innerHTML = bubbleInner;

  const avatarEl = document.createElement('img');
  avatarEl.className = 'chat-msg-avatar' + (isUser ? ' user-avatar' : '');
  avatarEl.src = isUser ? uAvatar : roleAvatar;
  avatarEl.alt = '';

  if (isUser) {
    row.appendChild(tsEl);
    row.appendChild(bubbleEl);
    row.appendChild(avatarEl);
  } else {
    row.appendChild(avatarEl);
    row.appendChild(bubbleEl);
    row.appendChild(tsEl);
  }

  if (animate) {
    row.style.opacity    = '0';
    row.style.transform  = 'translateY(8px)';
    row.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
    area.appendChild(row);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      row.style.opacity   = '1';
      row.style.transform = 'translateY(0)';
    }));
  } else {
    area.appendChild(row);
  }

  bindBubbleEvents(row, msg);
  scrollChatToBottom();
}

/* ---------- 格式化完整时间戳 ---------- */
function formatFullTime(ts) {
  if (!ts) return '';
  const d  = new Date(ts);
  const Y  = d.getFullYear();
  const Mo = String(d.getMonth() + 1).padStart(2, '0');
  const D  = String(d.getDate()).padStart(2, '0');
  const H  = String(d.getHours()).padStart(2, '0');
  const Mi = String(d.getMinutes()).padStart(2, '0');
  const S  = String(d.getSeconds()).padStart(2, '0');
  return `${Y}-${Mo}-${D} ${H}:${Mi}:${S}`;
}

/* ---------- 语音时长 ---------- */
function calcVoiceDuration(text) {
  const len = (text || '').replace(/\s/g, '').length;
  return Math.max(1, Math.round(len * 0.4));
}

function buildVoiceWaves(duration) {
  const count   = Math.min(Math.max(3, duration * 2), 14);
  const heights = [8, 13, 18, 14, 10, 16, 12, 9, 15, 11, 17, 13, 8, 12];
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `<span class="voice-bubble-wave" style="height:${heights[i % heights.length]}px;"></span>`;
  }
  return html;
}

/* ---------- 气泡内部事件绑定 ---------- */
function bindBubbleEvents(row, msg) {
  const transferBubble = row.querySelector('.transfer-bubble');
  if (transferBubble) {
    transferBubble.addEventListener('click', () => {
      if (msg.transferStatus !== 'pending') return;
      currentTransferMsgId = msg.id;
      document.getElementById('liao-transfer-accept-info').innerHTML =
        `转账金额：<b>${parseFloat(msg.amount || 0).toFixed(2)} 元</b>` +
        (msg.note ? `<br>备注：${escHtml(msg.note)}` : '');
      document.getElementById('liao-transfer-accept-modal').style.display = 'flex';
    });
  }

  const fakePic = row.querySelector('.fake-photo-bubble');
  if (fakePic) {
    fakePic.addEventListener('click', () => {
      document.getElementById('liao-fake-photo-content').textContent = msg.content || '';
      document.getElementById('liao-fake-photo-modal').style.display = 'flex';
    });
  }

  const realImg = row.querySelector('.real-image-bubble');
  if (realImg) {
    realImg.addEventListener('click', () => {
      window.open(msg.content, '_blank');
    });
  }

  /* 修复：语音气泡点击使用专用语音内容查看弹窗，不再复用撤回弹窗 */
  const voiceBubble = row.querySelector('.voice-bubble');
  if (voiceBubble) {
    voiceBubble.addEventListener('click', () => {
      document.getElementById('liao-voice-view-content').textContent = msg.content || '';
      document.getElementById('liao-voice-view-modal').style.display = 'flex';
    });
  }
}

/* ============================================================
   消息操作菜单
   ============================================================ */
function openMsgActionMenu(e, msgId) {
  if (currentChatIdx < 0) return;
  const chat   = liaoChats[currentChatIdx];
  const msgs   = chat.messages;
  const msgIdx = msgs.findIndex(m => m.id === msgId);
  if (msgIdx < 0) return;
  const msg    = msgs[msgIdx];
  const isUser = msg.role === 'user';
  const role   = liaoRoles.find(r => r.id === chat.roleId);

  const menu    = document.getElementById('liao-msg-action-menu');
  const menuBox = document.getElementById('liao-msg-action-box');
  menuBox.innerHTML = '';

  const actions = [];

  actions.push({ label: '引用', fn: () => {
    currentQuoteMsgIdx = msgIdx;
    const preview = (msg.content || '').slice(0, 30);
    document.getElementById('chat-quote-bar-text').textContent = preview;
    document.getElementById('chat-quote-bar').style.display = 'flex';
    closeActionMenu();
  }});

  actions.push({ label: '删除', danger: true, fn: () => {
    chat.messages.splice(msgIdx, 1);
    lSave('chats', liaoChats);
    renderChatMessages();
    closeActionMenu();
  }});

  actions.push({ label: '编辑', fn: () => {
    editingMsgIdx = msgIdx;
    document.getElementById('liao-msg-edit-content').value = msg.content || '';
    document.getElementById('liao-msg-edit-time').value    = formatFullTime(msg.ts);
    document.getElementById('liao-msg-edit-modal').style.display = 'flex';
    closeActionMenu();
  }});

  actions.push({ label: '收藏', fn: () => {
    const groupKey = isUser
      ? `角色 ${role ? (role.nickname || role.realname) : ''} 的收藏`
      : '我的收藏';
    addFavorite({
      roleId:     chat.roleId,
      roleName:   role ? (role.nickname || role.realname) : '',
      roleAvatar: role ? (role.avatar || defaultAvatar()) : defaultAvatar(),
      content:    msg.content || '',
      ts:         msg.ts || Date.now(),
      group:      groupKey
    });
    closeActionMenu();
    alert('已收藏');
  }});

  if (isUser) {
    actions.push({ label: '撤回', fn: () => {
      msg.recalled        = true;
      msg.recalledContent = msg.content;
      lSave('chats', liaoChats);
      renderChatMessages();
      closeActionMenu();
    }});
  }

  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className   = 'msg-action-item' + (a.danger ? ' danger' : '');
    btn.textContent = a.label;
    btn.addEventListener('click', a.fn);
    menuBox.appendChild(btn);
  });

  menu.style.display = 'block';

  requestAnimationFrame(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x    = e.clientX;
    let y    = e.clientY;
    const bw = menuBox.offsetWidth  || 130;
    const bh = menuBox.offsetHeight || 180;
    if (x + bw > vw) x = vw - bw - 8;
    if (y + bh > vh) y = vh - bh - 8;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    menuBox.style.left = x + 'px';
    menuBox.style.top  = y + 'px';
  });

  /* 点击菜单外部关闭 */
  setTimeout(() => {
    document.addEventListener('click', function onOutside() {
      closeActionMenu();
      document.removeEventListener('click', onOutside);
    }, { once: true });
  }, 0);
}

function closeActionMenu() {
  document.getElementById('liao-msg-action-menu').style.display = 'none';
}

/* ---------- 消息编辑 ---------- */
document.getElementById('liao-msg-edit-confirm').addEventListener('click', () => {
  if (editingMsgIdx < 0 || currentChatIdx < 0) return;
  const chat = liaoChats[currentChatIdx];
  const msg  = chat.messages[editingMsgIdx];
  const newContent = document.getElementById('liao-msg-edit-content').value.trim();
  const newTimeStr = document.getElementById('liao-msg-edit-time').value.trim();

  if (newContent) msg.content = newContent;
  if (newTimeStr) {
    const parsed = Date.parse(newTimeStr.replace(/-/g, '/'));
    if (!isNaN(parsed)) msg.ts = parsed;
  }
  lSave('chats', liaoChats);
  renderChatMessages();
  document.getElementById('liao-msg-edit-modal').style.display = 'none';
  editingMsgIdx = -1;
});

document.getElementById('liao-msg-edit-cancel').addEventListener('click', () => {
  document.getElementById('liao-msg-edit-modal').style.display = 'none';
  editingMsgIdx = -1;
});

/* ---------- 引用条关闭 ---------- */
document.getElementById('chat-quote-bar-close').addEventListener('click', () => {
  currentQuoteMsgIdx = -1;
  document.getElementById('chat-quote-bar').style.display = 'none';
});

/* ---------- 撤回查看关闭 ---------- */
document.getElementById('liao-recall-view-close').addEventListener('click', () => {
  document.getElementById('liao-recall-view-modal').style.display = 'none';
});

/* ---------- 语音内容查看关闭 ---------- */
document.getElementById('liao-voice-view-close').addEventListener('click', () => {
  document.getElementById('liao-voice-view-modal').style.display = 'none';
});

/* ---------- 假图片关闭 ---------- */
document.getElementById('liao-fake-photo-close').addEventListener('click', () => {
  document.getElementById('liao-fake-photo-modal').style.display = 'none';
});

/* ============================================================
   特殊功能状态栏
   ============================================================ */
function initSpecialBar() {
  document.getElementById('csb-ai').addEventListener('click', () => {
    triggerAiReply();
  });

  document.getElementById('csb-emoji').addEventListener('click', () => {
    toggleEmojiPanel();
  });

  document.getElementById('csb-voice').addEventListener('click', () => {
    document.getElementById('liao-voice-input').value = '';
    document.getElementById('liao-voice-modal').style.display = 'flex';
  });

  document.getElementById('csb-transfer').addEventListener('click', () => {
    document.getElementById('liao-transfer-amount').value = '';
    document.getElementById('liao-transfer-note').value   = '';
    document.getElementById('liao-transfer-modal').style.display = 'flex';
  });

  document.getElementById('csb-camera').addEventListener('click', () => {
    document.getElementById('liao-camera-desc').value = '';
    document.getElementById('liao-camera-modal').style.display = 'flex';
  });

  document.getElementById('csb-image').addEventListener('click', () => {
    document.getElementById('liao-image-url').value = '';
    pendingImageSrc = '';
    document.getElementById('liao-image-preview').style.display = 'none';
    document.getElementById('liao-image-preview').src = '';
    document.getElementById('liao-image-modal').style.display = 'flex';
  });

  document.getElementById('csb-rolephone').addEventListener('click', () => {
    alert('角色手机功能建设中，敬请期待');
  });

  document.getElementById('csb-edit').addEventListener('click', () => {
    alert('编辑功能建设中，敬请期待');
  });
}

/* ============================================================
   AI 回复
   ============================================================ */
async function triggerAiReply() {
  if (currentChatIdx < 0) return;

  const chat = liaoChats[currentChatIdx];
  const role = liaoRoles.find(r => r.id === chat.roleId);
  if (!role) return;

  const activeConfig = loadApiConfig();
  if (!activeConfig || !activeConfig.url) { alert('请先在设置中配置 API 地址'); return; }
  const model = loadApiModel();
  if (!model) { alert('请先在设置中选择模型'); return; }

  const csbAiBtn = document.getElementById('csb-ai');
  csbAiBtn.classList.add('active');
  showTypingIndicator(true);

  const chatSettings    = chat.chatSettings || {};
  const maxApiMsgs      = chatSettings.maxApiMsgs !== undefined ? chatSettings.maxApiMsgs : 0;
  const chatUserSetting = chat.chatUserSetting || '';
  const chatUserName2   = chat.chatUserName   || liaoUserName;
  const roleSetting     = role.setting || '';

  const systemPrompt =
    `你扮演角色：${role.realname}。\n` +
    (roleSetting ? `【角色设定】\n${roleSetting}\n` : '') +
    (chatUserSetting
      ? `【用户设定】\n对方是${chatUserName2}，${chatUserSetting}\n`
      : `【用户设定】\n对方叫${chatUserName2}。\n`) +
    `【特殊消息格式说明】
[VOICE:文字] 表示对方发来了语音，内容是"文字"。
[IMAGE:描述] 表示对方发来了图片。
[EMOJI:名称] 表示对方发来了表情包。
[TRANSFER:金额] 表示对方给你转账，请第一时间对转账做出反应，例如"怎么给我转钱了"。
[PHOTO:描述] 表示对方发来了照片。
你可以在回复中使用以下格式主动发起特殊消息：
[SEND_VOICE:语音内容] 发语音，内容必须像随手拿起手机说出的自然口语，有语气词，不超过20字。
[SEND_EMOJI:表情包名称] 发表情包。
[SEND_TRANSFER:金额:备注] 给用户转账。
[SEND_PHOTO:照片描述] 发假照片。
[RECALL] 撤回自己刚才发的消息。
【回复规则】
1. 用口语短句，像发微信一样聊天，有情绪有立场。
2. 每句话单独一行，换行分隔，绝不写成一段。
3. 允许语气词、不完美表达。
4. 不使用任何emoji或表情符号，纯文字（特殊格式指令除外）。
5. 角色设定优先级最高。
6. 收到转账必须第一条就回应。
7. 发语音时必须像随手拿起手机说出的自然话语，有语气词。`;

  let historyMsgs = chat.messages
    .filter(m => !m.hidden)
    .map(m => ({
      role:    m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content || ''
    }));
  if (maxApiMsgs > 0 && historyMsgs.length > maxApiMsgs) {
    historyMsgs = historyMsgs.slice(-maxApiMsgs);
  }

  const messages = [{ role: 'system', content: systemPrompt }, ...historyMsgs];

  try {
    const endpoint = activeConfig.url.replace(/\/$/, '') + '/chat/completions';
    const headers  = { 'Content-Type': 'application/json' };
    if (activeConfig.key) headers['Authorization'] = 'Bearer ' + activeConfig.key;

    const res = await fetch(endpoint, {
      method:  'POST',
      headers,
      body:    JSON.stringify({ model, messages, stream: false })
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);

    const json       = await res.json();
    let rawContent   = json.choices?.[0]?.message?.content || '';
    rawContent       = removeEmoji(rawContent);

    showTypingIndicator(false);
    processAiResponse(rawContent, role, chat);

  } catch (err) {
    showTypingIndicator(false);
    alert('API 请求失败：' + err.message);
  } finally {
    csbAiBtn.classList.remove('active');
  }
}

/* ---------- 解析并渲染 AI 回复 ---------- */
function processAiResponse(rawContent, role, chat) {
  const lines           = rawContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const chatUserAvatar2 = chat.chatUserAvatar || liaoUserAvatar;
  let cumulativeDelay   = 0;

  lines.forEach((line, i) => {
    const delay = calcBubbleDelay(line);
    cumulativeDelay += (i === 0 ? 200 : delay);

    setTimeout(() => {
      if (currentChatIdx < 0) return;

      let msgObj = null;

      if (/^\[SEND_VOICE:(.+)\]$/.test(line)) {
        const voiceText = line.match(/^\[SEND_VOICE:(.+)\]$/)[1];
        msgObj = {
          role: 'assistant', type: 'voice', content: voiceText,
          ts: Date.now(),
          id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2)
        };

      } else if (/^\[SEND_EMOJI:(.+)\]$/.test(line)) {
        const emojiName = line.match(/^\[SEND_EMOJI:(.+)\]$/)[1];
        const found     = liaoEmojis.find(e => e.name === emojiName);
        if (found) {
          msgObj = {
            role: 'assistant', type: 'emoji', content: found.url, emojiName: found.name,
            ts: Date.now(),
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2)
          };
        }

      } else if (/^\[SEND_TRANSFER:([^:]+):?(.*)\]$/.test(line)) {
        const m      = line.match(/^\[SEND_TRANSFER:([^:]+):?(.*)\]$/);
        const amount = parseFloat(m[1]) || 0;
        const note   = m[2] || '';
        msgObj = {
          role: 'assistant', type: 'transfer', amount, note,
          ts: Date.now(),
          id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2),
          transferStatus: 'pending', fromRole: true
        };

      } else if (/^\[SEND_PHOTO:(.+)\]$/.test(line)) {
        const desc = line.match(/^\[SEND_PHOTO:(.+)\]$/)[1];
        msgObj = {
          role: 'assistant', type: 'fake_photo', content: desc,
          ts: Date.now(),
          id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2)
        };

      } else if (/^\[RECALL\]$/.test(line)) {
        const msgs = liaoChats[currentChatIdx].messages;
        for (let k = msgs.length - 1; k >= 0; k--) {
          if (msgs[k].role === 'assistant' && !msgs[k].recalled) {
            msgs[k].recalled        = true;
            msgs[k].recalledContent = msgs[k].content;
            lSave('chats', liaoChats);
            renderChatMessages();
            break;
          }
        }

      } else {
        const cleanLine = removeEmoji(line);
        if (!cleanLine) return;
        msgObj = {
          role: 'assistant', type: 'text', content: cleanLine,
          ts: Date.now(),
          id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2)
        };
      }

      if (msgObj) {
        liaoChats[currentChatIdx].messages.push(msgObj);
        lSave('chats', liaoChats);
        appendMessageBubble(msgObj, role, chatUserAvatar2, true);
      }

      if (i === lines.length - 1) {
        renderChatList();
        if (Math.random() < 0.10) scheduleRoleSuiyanNew(role);
      }
    }, cumulativeDelay);
  });
}

/* ============================================================
   随言 — 角色自主发布新随言
   ============================================================ */
function scheduleRoleSuiyanNew(role) {
  setTimeout(async () => {
    if (!role) return;
    const activeConfig = loadApiConfig();
    if (!activeConfig || !activeConfig.url) return;
    const model = loadApiModel();
    if (!model) return;

    const systemPrompt =
      `你是角色 ${role.realname}，${role.setting || ''}。
现在请你发一条随言（类似朋友圈的短动态），内容随意，可以和你最近的聊天内容有关，也可以是你此刻的感受、所见所闻、心情或想法。
要求：
1. 不超过80个字。
2. 纯文字，不使用任何特殊格式。
3. 口语化，自然真实，像随手发的朋友圈。
4. 只输出动态内容本身，不要加任何前缀或说明。`;

    try {
      const endpoint = activeConfig.url.replace(/\/$/, '') + '/chat/completions';
      const headers  = { 'Content-Type': 'application/json' };
      if (activeConfig.key) headers['Authorization'] = 'Bearer ' + activeConfig.key;
      const res = await fetch(endpoint, {
        method: 'POST', headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }],
          stream: false
        })
      });
      if (!res.ok) return;
      const json    = await res.json();
      const content = removeEmoji((json.choices?.[0]?.message?.content || '').trim());
      if (!content) return;

      liaoSuiyan.push({
        author:   role.nickname || role.realname,
        avatar:   role.avatar   || defaultAvatar(),
        content,
        ts:       Date.now(),
        likes:    0,
        likedBy:  [],
        comments: [],
        isUser:   false,
        roleId:   role.id
      });
      lSave('suiyan', liaoSuiyan);
    } catch (e) { /* 静默失败 */ }
  }, 1200);
}

/* ============================================================
   随言 — 角色互动（点赞/评论用户随言）
   ============================================================ */
function scheduleRoleInteractSuiyan() {
  if (Math.random() > 0.10) return;
  const userPosts = liaoSuiyan.filter(p => p.isUser);
  if (!userPosts.length || !liaoRoles.length) return;
  const post    = userPosts[userPosts.length - 1];
  const postIdx = liaoSuiyan.lastIndexOf(post);
  const role    = liaoRoles[Math.floor(Math.random() * liaoRoles.length)];

  setTimeout(() => {
    if (!liaoSuiyan[postIdx]) return;
    if (!liaoSuiyan[postIdx].likedBy) liaoSuiyan[postIdx].likedBy = [];
    if (!liaoSuiyan[postIdx].likedBy.includes(role.id)) {
      liaoSuiyan[postIdx].likedBy.push(role.id);
      liaoSuiyan[postIdx].likes = (liaoSuiyan[postIdx].likes || 0) + 1;
    }
    if (Math.random() < 0.5) {
      const comments = ['哈哈', '好的', '嗯嗯', '真的吗', '厉害啊', '是这样啊', '我也是'];
      const c        = comments[Math.floor(Math.random() * comments.length)];
      if (!liaoSuiyan[postIdx].comments) liaoSuiyan[postIdx].comments = [];
      liaoSuiyan[postIdx].comments.push({
        author: role.nickname || role.realname,
        text:   c
      });
    }
    lSave('suiyan', liaoSuiyan);
  }, 2000 + Math.random() * 4000);
}

/* ============================================================
   语音发送
   ============================================================ */
document.getElementById('liao-voice-confirm').addEventListener('click', () => {
  const text = document.getElementById('liao-voice-input').value.trim();
  if (!text || currentChatIdx < 0) return;
  document.getElementById('liao-voice-modal').style.display = 'none';

  const chat = liaoChats[currentChatIdx];
  const role = liaoRoles.find(r => r.id === chat.roleId);
  const uAvt = chat.chatUserAvatar || liaoUserAvatar;

  const quoteContent = (currentQuoteMsgIdx >= 0 && chat.messages[currentQuoteMsgIdx])
    ? (chat.messages[currentQuoteMsgIdx].content || '') : '';

  const msgObj = {
    role: 'user', type: 'voice', content: text,
    quoteContent: quoteContent || undefined,
    ts: Date.now(),
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2)
  };
  chat.messages.push(msgObj);
  lSave('chats', liaoChats);

  currentQuoteMsgIdx = -1;
  const qb = document.getElementById('chat-quote-bar');
  if (qb) qb.style.display = 'none';

  appendMessageBubble(msgObj, role, uAvt, true);

  /* 注入系统提示让 AI 感知语音 */
  setTimeout(() => {
    if (currentChatIdx < 0) return;
    liaoChats[currentChatIdx].messages.push({
      role: 'user', content: `[VOICE:${text}]`,
      type: 'system_hint', hidden: true,
      ts: Date.now(), id: 'sys_' + Date.now()
    });
    lSave('chats', liaoChats);
  }, 100);
});

document.getElementById('liao-voice-cancel').addEventListener('click', () => {
  document.getElementById('liao-voice-modal').style.display = 'none';
});

/* ============================================================
   转账发送
   ============================================================ */
document.getElementById('liao-transfer-confirm').addEventListener('click', () => {
  const amount = parseFloat(document.getElementById('liao-transfer-amount').value);
  const note   = document.getElementById('liao-transfer-note').value.trim();
  if (!amount || amount <= 0 || currentChatIdx < 0) { alert('请输入正确的金额'); return; }
  document.getElementById('liao-transfer-modal').style.display = 'none';

  const chat  = liaoChats[currentChatIdx];
  const role  = liaoRoles.find(r => r.id === chat.roleId);
  const uAvt  = chat.chatUserAvatar || liaoUserAvatar;
  const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2);

  const msgObj = {
    role: 'user', type: 'transfer', amount, note,
    ts: Date.now(), id: msgId,
    transferStatus: 'pending', fromRole: false
  };
  chat.messages.push(msgObj);
  lSave('chats', liaoChats);

  currentQuoteMsgIdx = -1;
  const qb = document.getElementById('chat-quote-bar');
  if (qb) qb.style.display = 'none';

  appendMessageBubble(msgObj, role, uAvt, true);

  /* 注入系统提示让 AI 感知转账 */
  setTimeout(() => {
    if (currentChatIdx < 0) return;
    liaoChats[currentChatIdx].messages.push({
      role: 'user', content: `[TRANSFER:${amount.toFixed(2)}]`,
      type: 'system_hint', hidden: true,
      ts: Date.now(), id: 'sys_' + Date.now()
    });
    lSave('chats', liaoChats);
    triggerAiReply();
  }, 600);
});

document.getElementById('liao-transfer-cancel').addEventListener('click', () => {
  document.getElementById('liao-transfer-modal').style.display = 'none';
});

/* ---------- 转账接受/拒绝 ---------- */
document.getElementById('liao-transfer-accept-btn').addEventListener('click', () => {
  if (!currentTransferMsgId || currentChatIdx < 0) return;
  const chat = liaoChats[currentChatIdx];
  const msg  = chat.messages.find(m => m.id === currentTransferMsgId);
  if (msg) { msg.transferStatus = 'accepted'; lSave('chats', liaoChats); renderChatMessages(); }
  document.getElementById('liao-transfer-accept-modal').style.display = 'none';
  currentTransferMsgId = null;
});

document.getElementById('liao-transfer-decline-btn').addEventListener('click', () => {
  if (!currentTransferMsgId || currentChatIdx < 0) return;
  const chat = liaoChats[currentChatIdx];
  const msg  = chat.messages.find(m => m.id === currentTransferMsgId);
  if (msg) { msg.transferStatus = 'declined'; lSave('chats', liaoChats); renderChatMessages(); }
  document.getElementById('liao-transfer-accept-modal').style.display = 'none';
  currentTransferMsgId = null;
});

/* ============================================================
   拍摄（假图片）
   ============================================================ */
document.getElementById('liao-camera-confirm').addEventListener('click', () => {
  const desc = document.getElementById('liao-camera-desc').value.trim();
  if (!desc || currentChatIdx < 0) return;
  document.getElementById('liao-camera-modal').style.display = 'none';

  const chat = liaoChats[currentChatIdx];
  const role = liaoRoles.find(r => r.id === chat.roleId);
  const uAvt = chat.chatUserAvatar || liaoUserAvatar;

  const msgObj = {
    role: 'user', type: 'fake_photo', content: desc,
    ts: Date.now(),
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2)
  };
  chat.messages.push(msgObj);
  lSave('chats', liaoChats);

  currentQuoteMsgIdx = -1;
  const qb = document.getElementById('chat-quote-bar');
  if (qb) qb.style.display = 'none';

  appendMessageBubble(msgObj, role, uAvt, true);

  setTimeout(() => {
    if (currentChatIdx < 0) return;
    liaoChats[currentChatIdx].messages.push({
      role: 'user', content: `[PHOTO:${desc}]`,
      type: 'system_hint', hidden: true,
      ts: Date.now(), id: 'sys_' + Date.now()
    });
    lSave('chats', liaoChats);
    triggerAiReply();
  }, 500);
});

document.getElementById('liao-camera-cancel').addEventListener('click', () => {
  document.getElementById('liao-camera-modal').style.display = 'none';
});

/* ============================================================
   真实图片发送
   ============================================================ */
document.getElementById('liao-image-local-btn').addEventListener('click', () => {
  document.getElementById('liao-image-local-file').click();
});

document.getElementById('liao-image-local-file').addEventListener('change', function () {
  const file = this.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    pendingImageSrc = e.target.result;
    const preview   = document.getElementById('liao-image-preview');
    preview.src     = pendingImageSrc;
    preview.style.display = 'block';
    document.getElementById('liao-image-url').value = '';
  };
  reader.readAsDataURL(file);
  this.value = '';
});

document.getElementById('liao-image-url').addEventListener('input', function () {
  const url = this.value.trim();
  if (url) {
    pendingImageSrc = url;
    const preview   = document.getElementById('liao-image-preview');
    preview.src     = url;
    preview.style.display = 'block';
  }
});

document.getElementById('liao-image-confirm').addEventListener('click', () => {
  if (!pendingImageSrc || currentChatIdx < 0) { alert('请先选择图片'); return; }
  document.getElementById('liao-image-modal').style.display = 'none';

  const chat = liaoChats[currentChatIdx];
  const role = liaoRoles.find(r => r.id === chat.roleId);
  const uAvt = chat.chatUserAvatar || liaoUserAvatar;

  const msgObj = {
    role: 'user', type: 'image', content: pendingImageSrc,
    ts: Date.now(),
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2)
  };
  chat.messages.push(msgObj);
  lSave('chats', liaoChats);

  currentQuoteMsgIdx = -1;
  const qb = document.getElementById('chat-quote-bar');
  if (qb) qb.style.display = 'none';

  appendMessageBubble(msgObj, role, uAvt, true);
  pendingImageSrc = '';

  setTimeout(() => {
    if (currentChatIdx < 0) return;
    liaoChats[currentChatIdx].messages.push({
      role: 'user', content: '[IMAGE:用户发来了一张图片，请根据上下文分析并回应]',
      type: 'system_hint', hidden: true,
      ts: Date.now(), id: 'sys_' + Date.now()
    });
    lSave('chats', liaoChats);
    triggerAiReply();
  }, 500);
});

document.getElementById('liao-image-cancel').addEventListener('click', () => {
  document.getElementById('liao-image-modal').style.display = 'none';
  pendingImageSrc = '';
});

/* ============================================================
   表情包面板
   ============================================================ */
function toggleEmojiPanel() {
  emojiPanelOpen = !emojiPanelOpen;
  const panel = document.getElementById('emoji-panel');
  panel.style.display = emojiPanelOpen ? 'flex' : 'none';
  document.getElementById('csb-emoji').classList.toggle('active', emojiPanelOpen);
  if (emojiPanelOpen) renderEmojiPanel();
}

function renderEmojiPanel() {
  const catList = document.getElementById('emoji-cat-list');
  catList.innerHTML = '';

  liaoEmojiCats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className   = 'emoji-sidebar-btn' + (emojiCurrentCat === cat ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      emojiCurrentCat = cat;
      document.querySelectorAll('#emoji-cat-list .emoji-sidebar-btn, .emoji-sidebar-btn[data-cat="all"]')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderEmojiGrid();
    });
    catList.appendChild(btn);
  });

  const allBtn = document.querySelector('.emoji-sidebar-btn[data-cat="all"]');
  if (allBtn) {
    allBtn.className = 'emoji-sidebar-btn' + (emojiCurrentCat === 'all' ? ' active' : '');
    /* 重新绑定（避免重复绑定用克隆方式） */
    const newAllBtn = allBtn.cloneNode(true);
    allBtn.parentNode.replaceChild(newAllBtn, allBtn);
    newAllBtn.addEventListener('click', () => {
      emojiCurrentCat = 'all';
      document.querySelectorAll('#emoji-cat-list .emoji-sidebar-btn')
        .forEach(b => b.classList.remove('active'));
      newAllBtn.classList.add('active');
      renderEmojiGrid();
    });
  }

  renderEmojiGrid();
}

function renderEmojiGrid() {
  const grid     = document.getElementById('emoji-panel-grid');
  grid.innerHTML = '';
  const filtered = emojiCurrentCat === 'all'
    ? liaoEmojis
    : liaoEmojis.filter(e => e.cat === emojiCurrentCat);

  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;font-size:12px;color:var(--text-light);">还没有表情包，点击导入吧</div>';
    return;
  }

  filtered.forEach(emoji => {
    const img     = document.createElement('img');
    img.className = 'emoji-grid-item';
    img.src       = emoji.url;
    img.alt       = emoji.name || '';
    img.title     = emoji.name || '';
    img.loading   = 'lazy';
    img.addEventListener('click', () => sendEmojiMsg(emoji));
    grid.appendChild(img);
  });
}

function sendEmojiMsg(emoji) {
  if (currentChatIdx < 0) return;
  const chat = liaoChats[currentChatIdx];
  const role = liaoRoles.find(r => r.id === chat.roleId);
  const uAvt = chat.chatUserAvatar || liaoUserAvatar;

  const msgObj = {
    role: 'user', type: 'emoji',
    content: emoji.url, emojiName: emoji.name || '',
    ts: Date.now(),
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2)
  };
  chat.messages.push(msgObj);
  lSave('chats', liaoChats);

  currentQuoteMsgIdx = -1;
  const qb = document.getElementById('chat-quote-bar');
  if (qb) qb.style.display = 'none';

  appendMessageBubble(msgObj, role, uAvt, true);

  /* 关闭面板 */
  emojiPanelOpen = false;
  document.getElementById('emoji-panel').style.display = 'none';
  document.getElementById('csb-emoji').classList.remove('active');

  /* 注入系统提示 */
  setTimeout(() => {
    if (currentChatIdx < 0) return;
    liaoChats[currentChatIdx].messages.push({
      role: 'user', content: `[EMOJI:${emoji.name || '表情包'}]`,
      type: 'system_hint', hidden: true,
      ts: Date.now(), id: 'sys_' + Date.now()
    });
    lSave('chats', liaoChats);
    triggerAiReply();
  }, 400);
}

/* ---------- 表情包导入按钮 ---------- */
document.getElementById('emoji-import-btn').addEventListener('click', () => {
  emojiPanelOpen = false;
  document.getElementById('emoji-panel').style.display = 'none';
  document.getElementById('csb-emoji').classList.remove('active');
  openEmojiImportModal();
});

document.getElementById('emoji-manage-btn').addEventListener('click', () => {
  emojiPanelOpen = false;
  document.getElementById('emoji-panel').style.display = 'none';
  document.getElementById('csb-emoji').classList.remove('active');
  openEmojiManageModal();
});

/* ============================================================
   表情包导入弹窗
   ============================================================ */
function openEmojiImportModal() {
  const wrap = document.getElementById('liao-emoji-import-cat-wrap');
  wrap.innerHTML = '';
  liaoEmojiCats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className   = 'emoji-cat-tag';
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.emoji-cat-tag').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    wrap.appendChild(btn);
  });
  document.getElementById('liao-emoji-batch-input').value    = '';
  document.getElementById('liao-emoji-import-new-cat').value = '';
  document.getElementById('liao-emoji-import-modal').style.display = 'flex';
}

document.getElementById('liao-emoji-import-confirm').addEventListener('click', () => {
  const batchText  = document.getElementById('liao-emoji-batch-input').value.trim();
  const newCatName = document.getElementById('liao-emoji-import-new-cat').value.trim();
  const wrap       = document.getElementById('liao-emoji-import-cat-wrap');
  const activeTag  = wrap.querySelector('.emoji-cat-tag.active');
  let targetCat    = activeTag ? activeTag.textContent : (newCatName || '默认');

  if (newCatName && !liaoEmojiCats.includes(newCatName)) {
    liaoEmojiCats.push(newCatName);
    lSave('emojiCats', liaoEmojiCats);
    targetCat = newCatName;
  }

  let imported = 0;
  if (batchText) {
    batchText.split('\n').map(l => l.trim()).filter(l => l).forEach(line => {
      const match = line.match(/^(.+?)[：:](https?:\/\/.+)$/);
      if (match) {
        liaoEmojis.push({
          id:  'emoji_' + Date.now() + '_' + Math.random().toString(36).slice(2),
          name: match[1].trim(),
          url:  match[2].trim(),
          cat:  targetCat
        });
        imported++;
      }
    });
  }

  lSave('emojis', liaoEmojis);
  document.getElementById('liao-emoji-import-modal').style.display = 'none';
  if (imported > 0) alert(`成功导入 ${imported} 个表情包`);
});

document.getElementById('liao-emoji-import-cancel').addEventListener('click', () => {
  document.getElementById('liao-emoji-import-modal').style.display = 'none';
});

document.getElementById('liao-emoji-local-btn').addEventListener('click', () => {
  document.getElementById('liao-emoji-local-file').click();
});

document.getElementById('liao-emoji-local-file').addEventListener('change', function () {
  const files = Array.from(this.files);
  if (!files.length) return;
  const wrap       = document.getElementById('liao-emoji-import-cat-wrap');
  const activeTag  = wrap.querySelector('.emoji-cat-tag.active');
  const newCatName = document.getElementById('liao-emoji-import-new-cat').value.trim();
  let targetCat    = activeTag ? activeTag.textContent : (newCatName || '默认');

  if (newCatName && !liaoEmojiCats.includes(newCatName)) {
    liaoEmojiCats.push(newCatName);
    lSave('emojiCats', liaoEmojiCats);
    targetCat = newCatName;
  }

  let done = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      liaoEmojis.push({
        id:   'emoji_' + Date.now() + '_' + Math.random().toString(36).slice(2),
        name: file.name.replace(/\.[^.]+$/, ''),
        url:  e.target.result,
        cat:  targetCat
      });
      done++;
      if (done === files.length) {
        lSave('emojis', liaoEmojis);
        alert(`成功导入 ${done} 个本地表情包`);
        document.getElementById('liao-emoji-import-modal').style.display = 'none';
      }
    };
    reader.readAsDataURL(file);
  });
  this.value = '';
});

/* ============================================================
   表情包管理弹窗
   ============================================================ */
function openEmojiManageModal() {
  emojiManageSelectedIds = [];
  emojiManageCurrentCat  = 'all';
  renderEmojiManageModal();
  document.getElementById('liao-emoji-manage-modal').style.display = 'flex';
}

function renderEmojiManageModal() {
  const catsEl     = document.getElementById('liao-emoji-manage-cats');
  catsEl.innerHTML = '';

  const allTag = document.createElement('button');
  allTag.className   = 'emoji-cat-tag' + (emojiManageCurrentCat === 'all' ? ' active' : '');
  allTag.textContent = '全部';
  allTag.addEventListener('click', () => { emojiManageCurrentCat = 'all'; renderEmojiManageModal(); });
  catsEl.appendChild(allTag);

  liaoEmojiCats.forEach(cat => {
    const tag = document.createElement('button');
    tag.className   = 'emoji-cat-tag' + (emojiManageCurrentCat === cat ? ' active' : '');
    tag.textContent = cat;
    tag.addEventListener('click', () => { emojiManageCurrentCat = cat; renderEmojiManageModal(); });
    catsEl.appendChild(tag);
  });

  const grid     = document.getElementById('liao-emoji-manage-grid');
  grid.innerHTML = '';
  const filtered = emojiManageCurrentCat === 'all'
    ? liaoEmojis
    : liaoEmojis.filter(e => e.cat === emojiManageCurrentCat);

  filtered.forEach(emoji => {
    const item = document.createElement('div');
    item.className = 'emoji-manage-item' + (emojiManageSelectedIds.includes(emoji.id) ? ' selected' : '');
    item.innerHTML = `
      <img src="${escHtml(emoji.url)}" alt="${escHtml(emoji.name || '')}" loading="lazy">
      <span class="emoji-manage-check">√</span>`;
    item.addEventListener('click', () => {
      const idx = emojiManageSelectedIds.indexOf(emoji.id);
      if (idx >= 0) emojiManageSelectedIds.splice(idx, 1);
      else emojiManageSelectedIds.push(emoji.id);
      item.classList.toggle('selected', emojiManageSelectedIds.includes(emoji.id));
    });
    grid.appendChild(item);
  });
}

document.getElementById('liao-emoji-manage-delete').addEventListener('click', () => {
  if (!emojiManageSelectedIds.length) { alert('请先选择要删除的表情包'); return; }
  liaoEmojis = liaoEmojis.filter(e => !emojiManageSelectedIds.includes(e.id));
  emojiManageSelectedIds = [];
  lSave('emojis', liaoEmojis);
  renderEmojiManageModal();
});

document.getElementById('liao-emoji-manage-move').addEventListener('click', () => {
  if (!emojiManageSelectedIds.length) { alert('请先选择表情包'); return; }
  const catName = prompt('移动到哪个分类？（输入已有分类名或新建名称）');
  if (!catName) return;
  if (!liaoEmojiCats.includes(catName)) {
    liaoEmojiCats.push(catName);
    lSave('emojiCats', liaoEmojiCats);
  }
  liaoEmojis.forEach(e => {
    if (emojiManageSelectedIds.includes(e.id)) e.cat = catName;
  });
  emojiManageSelectedIds = [];
  lSave('emojis', liaoEmojis);
  renderEmojiManageModal();
});

document.getElementById('liao-emoji-manage-export').addEventListener('click', () => {
  const toExport = emojiManageSelectedIds.length
    ? liaoEmojis.filter(e => emojiManageSelectedIds.includes(e.id))
    : liaoEmojis;
  const lines = toExport.filter(e => e.url.startsWith('http')).map(e => `${e.name}:${e.url}`);
  if (!lines.length) { alert('没有可导出的网络图片链接'); return; }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'emoji-export.txt';
  a.click();
});

document.getElementById('liao-emoji-manage-close').addEventListener('click', () => {
  document.getElementById('liao-emoji-manage-modal').style.display = 'none';
});

/* ============================================================
   时间戳隐藏设置
   ============================================================ */
document.getElementById('cs-timestamp-save-btn').addEventListener('click', () => {
  if (currentChatIdx < 0) return;
  const chat   = liaoChats[currentChatIdx];
  const hidden = document.getElementById('cs-hide-timestamp').checked;
  if (!chat.chatSettings) chat.chatSettings = {};
  chat.chatSettings.hideTimestamp = hidden;
  lSave('chats', liaoChats);
  document.body.classList.toggle('timestamp-hidden', hidden);
  alert('时间戳设置已保存');
});

/* ============================================================
   角色库渲染（含进入聊天设置按钮）
   ============================================================ */
function renderRoleLib() {
  const grid  = document.getElementById('liao-role-grid');
  const count = document.getElementById('liao-role-count');
  if (!grid) return;
  grid.innerHTML = '';

  liaoRoles.forEach(role => {
    const card = document.createElement('div');
    card.className = 'role-card';
    card.innerHTML = `
      <img class="role-card-avatar" src="${escHtml(role.avatar || defaultAvatar())}" alt="">
      <div class="role-card-name">${escHtml(role.nickname)}</div>
      <div class="role-card-real">${escHtml(role.realname)}</div>
      <button class="role-card-settings-btn" data-role-id="${escHtml(role.id)}">聊天设置</button>`;

    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('role-card-settings-btn')) return;
      const chatIdx = liaoChats.findIndex(c => c.roleId === role.id);
      if (chatIdx >= 0) {
        switchLiaoTab('chatlist');
        setTimeout(() => openChatView(chatIdx), 80);
      }
    });

    card.querySelector('.role-card-settings-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const chatIdx = liaoChats.findIndex(c => c.roleId === role.id);
      if (chatIdx >= 0) {
        currentChatIdx = chatIdx;
        const csCloseBtn = document.getElementById('cs-close-btn');
        if (csCloseBtn) csCloseBtn.dataset.returnTo = 'rolelib';
        openChatSettings();
      }
    });

    grid.appendChild(card);
  });

  if (count) count.textContent = `共 ${liaoRoles.length} 个角色`;
}

/* ============================================================
   从人设库导入到用户设置
   ============================================================ */
document.getElementById('cs-import-persona-btn').addEventListener('click', () => {
  const personas = lLoad('personas', []);
  const list     = document.getElementById('liao-persona-pick-list');
  list.innerHTML = '';

  if (!personas.length) {
    list.innerHTML = '<div style="font-size:13px;color:var(--text-light);padding:8px 0;">人设库为空，请先在我的人设库中新建</div>';
  } else {
    personas.forEach(p => {
      const card = document.createElement('div');
      card.className = 'persona-card';
      card.innerHTML = `
        <img class="persona-card-avatar" src="${escHtml(p.avatar || defaultAvatar())}" alt="">
        <div class="persona-card-info">
          <div class="persona-card-name">${escHtml(p.name)}</div>
          <div class="persona-card-setting">${escHtml((p.setting || '').slice(0, 40))}</div>
        </div>`;
      card.addEventListener('click', () => {
        document.getElementById('cs-user-name').value    = p.name    || '';
        document.getElementById('cs-user-setting').value = p.setting || '';
        if (p.avatar) {
          document.getElementById('cs-user-avatar-preview').src = p.avatar;
          csUserAvatarSrc = p.avatar;
        }
        document.getElementById('liao-persona-pick-modal').style.display = 'none';
      });
      list.appendChild(card);
    });
  }
  document.getElementById('liao-persona-pick-modal').style.display = 'flex';
});

document.getElementById('liao-persona-pick-cancel').addEventListener('click', () => {
  document.getElementById('liao-persona-pick-modal').style.display = 'none';
});

/* ============================================================
   初始化
   ============================================================ */
initSpecialBar();
