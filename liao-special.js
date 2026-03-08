/* ============================================================
   liao-special.js — 气泡渲染 / 消息操作 / 特殊功能状态栏
                     语音 / 转账 / 假图片 / 真图片
   ============================================================ */

/* ---------- 全局状态 ---------- */
var currentQuoteMsgIdx    = -1;
var pendingImageSrc        = '';
var currentTransferMsgId   = null;
var editingMsgIdx          = -1;

/* ============================================================
   renderSpecialContent — 统一特殊内容渲染
   ============================================================ */
function renderSpecialContent(content, msg) {
  if (!content) return { html: '', isEmojiOnly: false, isSpecialOnly: false };

  const raw = content;

  const emojiOnlyRe   = /^\[.+?发送了一个表情包：(.+?)\]$/;
  const specialOnlyRe = /^\[.+?(?:发送了一条语音|发起了一笔转账|发送了一张照片)：[\s\S]+?\]$/;
  const isEmojiOnly   = emojiOnlyRe.test(raw.trim());
  const isSpecialOnly = specialOnlyRe.test(raw.trim());

  function transferButtons(msgId, status) {
    if (status === 'accepted') return '<div class="transfer-inline-status accepted">已收款</div>';
    if (status === 'declined') return '<div class="transfer-inline-status declined">已拒绝</div>';
    return '<div class="transfer-inline-actions">' +
      '<button class="transfer-inline-accept" data-transfer-id="' + escHtml(msgId) + '">接受</button>' +
      '<button class="transfer-inline-decline" data-transfer-id="' + escHtml(msgId) + '">拒绝</button>' +
      '</div>';
  }

  const globalRe = /\[(.+?)(?:发送了一个表情包：(.+?)|发送了一条语音：([\s\S]+?)|发起了一笔转账：(\d+\.?\d*)元(?:，备注：([\s\S]+?))?|发送了一张照片：([\s\S]+?))\]/g;

  let result = '';
  let last   = 0;
  let match;

  while ((match = globalRe.exec(raw)) !== null) {
    if (match.index > last) {
      result += escHtml(raw.slice(last, match.index));
    }

    const full = match[0];

    if (match[2] !== undefined) {
      const emojiName = match[2].trim();
      const found     = liaoEmojis.find(e => e.name === emojiName);
      if (found) {
        result += '<img class="emoji-msg-bubble" src="' + escHtml(found.url) + '" alt="' + escHtml(emojiName) + '" title="' + escHtml(emojiName) + '">';
      } else {
        result += escHtml(full);
      }

    } else if (match[3] !== undefined) {
      const voiceText = match[3].trim();
      const duration  = calcVoiceDuration(voiceText);
      result += '<div class="voice-bubble special-inline-bubble" data-voice-text="' + escHtml(voiceText) + '" title="点击查看语音内容">' +
        '<span class="voice-bubble-icon">◎</span>' +
        '<div class="voice-bubble-bar">' + buildVoiceWaves(duration) + '</div>' +
        '<span class="voice-bubble-duration">' + duration + '"</span>' +
        '</div>';

    } else if (match[4] !== undefined) {
      const amount  = parseFloat(match[4]) || 0;
      const note    = match[5] ? match[5].trim() : '';
      const msgId   = msg ? (msg.id || '') : '';
      const status  = msg ? (msg.transferStatus || 'pending') : 'pending';
      const isRole  = msg ? (msg.role === 'assistant') : false;
      const btnHtml = isRole
        ? transferButtons(msgId, status)
        : '<div class="transfer-inline-status">' + (status === 'accepted' ? '已收款' : status === 'declined' ? '已拒绝' : '已发出') + '</div>';
      result += '<div class="transfer-inline-card" data-transfer-id="' + escHtml(msgId) + '">' +
        '<div class="transfer-inline-header">' +
        '<span class="transfer-bubble-icon">◇</span>' +
        '<span class="transfer-bubble-amount">' + amount.toFixed(2) + ' 元</span>' +
        '</div>' +
        (note ? '<div class="transfer-bubble-note">' + escHtml(note) + '</div>' : '') +
        btnHtml +
        '</div>';

    } else if (match[6] !== undefined) {
      const desc      = match[6].trim();
      const shortDesc = desc.slice(0, 12) + (desc.length > 12 ? '…' : '');
      result += '<div class="fake-photo-bubble special-inline-bubble" data-photo-desc="' + escHtml(desc) + '">' +
        '<div class="fake-photo-bubble-inner">' +
        '<span class="fake-photo-icon">▤</span>' +
        '<span class="fake-photo-label">' + escHtml(shortDesc) + '</span>' +
        '</div>' +
        '</div>';
    } else {
      result += escHtml(full);
    }

    last = match.index + match[0].length;
  }

  if (last < raw.length) {
    result += escHtml(raw.slice(last));
  }

  return { html: result, isEmojiOnly, isSpecialOnly };
}

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

  if (msg.recalled) {
    const recallRow = document.createElement('div');
    recallRow.className     = 'recall-notice';
    recallRow.dataset.msgId = msg.id;
    const who = isUser ? '你' : (role ? (role.nickname || role.realname) : '对方');
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
  row.className     = 'chat-msg-row' + (isUser ? ' user-row' : '');
  row.dataset.msgId = msg.id;

  const tsEl = document.createElement('span');
  tsEl.className     = 'chat-msg-timestamp';
  tsEl.dataset.msgId = msg.id;
  tsEl.textContent   = formatFullTime(msg.ts);
  tsEl.addEventListener('click', (e) => {
    e.stopPropagation();
    openMsgActionMenu(e, msg.id);
  });

  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'chat-msg-bubble';

  let bubbleInner = '';

  if (msg.quoteContent) {
    bubbleInner += '<div class="msg-quote-block">' + escHtml(msg.quoteContent) + '</div>';
  }

  const msgType = msg.type || 'text';

  if (msgType === 'image') {
    bubbleInner += '<img class="real-image-bubble" src="' + escHtml(msg.content) + '" alt="图片">';
    bubbleEl.innerHTML = bubbleInner;
  } else {
    const { html, isEmojiOnly, isSpecialOnly } = renderSpecialContent(msg.content || '', msg);
    bubbleInner += html;
    bubbleEl.innerHTML = bubbleInner;
    if (isEmojiOnly)        bubbleEl.classList.add('bubble-emoji-only');
    else if (isSpecialOnly) bubbleEl.classList.add('bubble-special-only');
  }

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
  return Y + '-' + Mo + '-' + D + ' ' + H + ':' + Mi + ':' + S;
}

/* ---------- 动态时间描述（记忆宫殿用） ---------- */
function formatMemoryTime(ts) {
  if (!ts) return '';
  const now      = Date.now();
  const diffMs   = now - ts;
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays < 1)   return '今天';
  if (diffDays < 2)   return '昨天';
  if (diffDays < 3)   return '前天';
  if (diffDays < 7)   return diffDays + '天前';
  if (diffDays < 14)  return '上周';
  if (diffDays < 30)  return diffDays + '天前';
  if (diffDays < 60)  return '上个月';
  if (diffDays < 365) return Math.floor(diffDays / 30) + '个月前';
  if (diffDays < 730) return '去年';
  return Math.floor(diffDays / 365) + '年前';
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
    html += '<span class="voice-bubble-wave" style="height:' + heights[i % heights.length] + 'px;"></span>';
  }
  return html;
}

/* ---------- 气泡内部事件绑定 ---------- */
function bindBubbleEvents(row, msg) {
  row.querySelectorAll('.voice-bubble').forEach(el => {
    el.addEventListener('click', () => {
      const text = el.dataset.voiceText || msg.content || '';
      document.getElementById('liao-voice-view-content').textContent = text;
      document.getElementById('liao-voice-view-modal').style.display = 'flex';
    });
  });

  row.querySelectorAll('.fake-photo-bubble').forEach(el => {
    el.addEventListener('click', () => {
      const desc = el.dataset.photoDesc || msg.content || '';
      document.getElementById('liao-fake-photo-content').textContent = desc;
      document.getElementById('liao-fake-photo-modal').style.display = 'flex';
    });
  });

  row.querySelectorAll('.transfer-inline-accept').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentChatIdx < 0) return;
      const chat = liaoChats[currentChatIdx];
      const m    = chat.messages.find(x => x.id === msg.id);
      if (m && m.transferStatus === 'pending') {
        m.transferStatus = 'accepted';
        lSave('chats', liaoChats);
        renderChatMessages();
      }
    });
  });

  row.querySelectorAll('.transfer-inline-decline').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentChatIdx < 0) return;
      const chat = liaoChats[currentChatIdx];
      const m    = chat.messages.find(x => x.id === msg.id);
      if (m && m.transferStatus === 'pending') {
        m.transferStatus = 'declined';
        lSave('chats', liaoChats);
        renderChatMessages();
      }
    });
  });

  const realImg = row.querySelector('.real-image-bubble');
  if (realImg) {
    realImg.addEventListener('click', () => {
      window.open(msg.content, '_blank');
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
      ? '角色 ' + (role ? (role.nickname || role.realname) : '') + ' 的收藏'
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

/* ---------- 弹窗关闭 ---------- */
document.getElementById('liao-recall-view-close').addEventListener('click', () => {
  document.getElementById('liao-recall-view-modal').style.display = 'none';
});
document.getElementById('liao-voice-view-close').addEventListener('click', () => {
  document.getElementById('liao-voice-view-modal').style.display = 'none';
});
document.getElementById('liao-fake-photo-close').addEventListener('click', () => {
  document.getElementById('liao-fake-photo-modal').style.display = 'none';
});

/* ============================================================
   特殊功能状态栏
   ============================================================ */
function initSpecialBar() {
  document.getElementById('csb-ai').addEventListener('click', () => triggerAiReply());
  document.getElementById('csb-emoji').addEventListener('click', () => toggleEmojiPanel());
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
   语音发送
   ============================================================ */
document.getElementById('liao-voice-confirm').addEventListener('click', () => {
  const text = document.getElementById('liao-voice-input').value.trim();
  if (!text || currentChatIdx < 0) return;
  document.getElementById('liao-voice-modal').style.display = 'none';

  const chat     = liaoChats[currentChatIdx];
  const role     = liaoRoles.find(r => r.id === chat.roleId);
  const uAvt     = chat.chatUserAvatar || liaoUserAvatar;
  const userName = chat.chatUserName || liaoUserName;

  const quoteContent = (currentQuoteMsgIdx >= 0 && chat.messages[currentQuoteMsgIdx])
    ? (chat.messages[currentQuoteMsgIdx].content || '') : '';

  const content = '[(' + userName + ')发送了一条语音：' + text + ']';
  const msgObj  = {
    role: 'user', type: 'text', content,
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

  const chat     = liaoChats[currentChatIdx];
  const role     = liaoRoles.find(r => r.id === chat.roleId);
  const uAvt     = chat.chatUserAvatar || liaoUserAvatar;
  const userName = chat.chatUserName || liaoUserName;

  const content = note
    ? '[(' + userName + ')发起了一笔转账：' + amount.toFixed(2) + '元，备注：' + note + ']'
    : '[(' + userName + ')发起了一笔转账：' + amount.toFixed(2) + '元]';
  const msgObj = {
    role: 'user', type: 'text', content,
    ts: Date.now(),
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    transferStatus: 'pending'
  };
  chat.messages.push(msgObj);
  lSave('chats', liaoChats);

  currentQuoteMsgIdx = -1;
  const qb = document.getElementById('chat-quote-bar');
  if (qb) qb.style.display = 'none';

  appendMessageBubble(msgObj, role, uAvt, true);
});

document.getElementById('liao-transfer-cancel').addEventListener('click', () => {
  document.getElementById('liao-transfer-modal').style.display = 'none';
});

/* ============================================================
   拍摄（假图片）
   ============================================================ */
document.getElementById('liao-camera-confirm').addEventListener('click', () => {
  const desc = document.getElementById('liao-camera-desc').value.trim();
  if (!desc || currentChatIdx < 0) return;
  document.getElementById('liao-camera-modal').style.display = 'none';

  const chat     = liaoChats[currentChatIdx];
  const role     = liaoRoles.find(r => r.id === chat.roleId);
  const uAvt     = chat.chatUserAvatar || liaoUserAvatar;
  const userName = chat.chatUserName || liaoUserName;

  const content = '[(' + userName + ')发送了一张照片：' + desc + ']';
  const msgObj  = {
    role: 'user', type: 'text', content,
    ts: Date.now(),
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2)
  };
  chat.messages.push(msgObj);
  lSave('chats', liaoChats);

  currentQuoteMsgIdx = -1;
  const qb = document.getElementById('chat-quote-bar');
  if (qb) qb.style.display = 'none';

  appendMessageBubble(msgObj, role, uAvt, true);
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
});

document.getElementById('liao-image-cancel').addEventListener('click', () => {
  document.getElementById('liao-image-modal').style.display = 'none';
  pendingImageSrc = '';
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
   角色库渲染
   ============================================================ */
function renderRoleLib() {
  const grid  = document.getElementById('liao-role-grid');
  const count = document.getElementById('liao-role-count');
  if (!grid) return;
  grid.innerHTML = '';

  liaoRoles.forEach(role => {
    const card = document.createElement('div');
    card.className = 'role-card';

    const avatarImg     = document.createElement('img');
    avatarImg.className = 'role-card-avatar';
    avatarImg.src       = role.avatar || defaultAvatar();
    avatarImg.alt       = '';

    const nameDiv       = document.createElement('div');
    nameDiv.className   = 'role-card-name';
    nameDiv.textContent = role.nickname;

    const realDiv       = document.createElement('div');
    realDiv.className   = 'role-card-real';
    realDiv.textContent = role.realname;

    const settingsBtn          = document.createElement('button');
    settingsBtn.className      = 'role-card-settings-btn';
    settingsBtn.dataset.roleId = role.id;
    settingsBtn.textContent    = '聊天设置';

    card.appendChild(avatarImg);
    card.appendChild(nameDiv);
    card.appendChild(realDiv);
    card.appendChild(settingsBtn);

    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('role-card-settings-btn')) return;
      const chatIdx = liaoChats.findIndex(c => c.roleId === role.id);
      if (chatIdx >= 0) {
        switchLiaoTab('chatlist');
        setTimeout(() => openChatView(chatIdx), 80);
      }
    });

    settingsBtn.addEventListener('click', (e) => {
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

  if (count) count.textContent = '共 ' + liaoRoles.length + ' 个角色';
}

/* ============================================================
   从人设库导入到用户设置
   ============================================================ */
document.getElementById('cs-import-persona-btn').addEventListener('click', () => {
  const personas = lLoad('personas', []);
  const list     = document.getElementById('liao-persona-pick-list');
  list.innerHTML = '';

  if (!personas.length) {
    const empty       = document.createElement('div');
    empty.style.cssText = 'font-size:13px;color:var(--text-light);padding:8px 0;';
    empty.textContent   = '人设库为空，请先在我的人设库中新建';
    list.appendChild(empty);
  } else {
    personas.forEach(p => {
      const card = document.createElement('div');
      card.className = 'persona-card';

      const avatarImg     = document.createElement('img');
      avatarImg.className = 'persona-card-avatar';
      avatarImg.src       = p.avatar || defaultAvatar();
      avatarImg.alt       = '';

      const infoDiv       = document.createElement('div');
      infoDiv.className   = 'persona-card-info';

      const nameDiv       = document.createElement('div');
      nameDiv.className   = 'persona-card-name';
      nameDiv.textContent = p.name;

      const settingDiv       = document.createElement('div');
      settingDiv.className   = 'persona-card-setting';
      settingDiv.textContent = (p.setting || '').slice(0, 40);

      infoDiv.appendChild(nameDiv);
      infoDiv.appendChild(settingDiv);
      card.appendChild(avatarImg);
      card.appendChild(infoDiv);

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
