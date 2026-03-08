/* ============================================================
   liao-special.js — 特殊功能状态栏 / 时间戳 / 消息操作
                     表情包 / 语音 / 转账 / 假图片 / 真图片
   注意：openChatView / sendUserMessage / renderRoleLib
         均在 liao-chat.js 中唯一定义，此文件不重定义它们。
   ============================================================ */

/* ---------- 全局状态 ---------- */
var liaoEmojis    = lLoad('emojis',    []);
var liaoEmojiCats = lLoad('emojiCats', ['默认']);

var currentQuoteMsgIdx     = -1;
var pendingImageSrc         = '';
var emojiManageSelectedIds  = [];
var emojiManageCurrentCat   = 'all';
var currentTransferMsgId    = null;
var editingMsgIdx           = -1;
var emojiPanelOpen          = false;
var emojiCurrentCat         = 'all';

/* ============================================================
   renderSpecialContent — 统一特殊内容渲染
   输入：消息 content 字符串、消息对象 msg（用于转账状态）
   输出：{ html: string, isEmojiOnly: bool, isSpecialOnly: bool }
   ============================================================ */
function renderSpecialContent(content, msg) {
  if (!content) return { html: '', isEmojiOnly: false, isSpecialOnly: false };

  const raw = content;

  /* 判断整条消息是否纯表情包（只含一个表情包格式，无其他文字） */
  const emojiOnlyRe = /^\[.+?发送了一个表情包：(.+?)\]$/;
  const isEmojiOnly = emojiOnlyRe.test(raw.trim());

  /* 判断是否纯特殊消息（语音/转账/假图片） */
  const specialOnlyRe = /^\[.+?(?:发送了一条语音|发起了一笔转账|发送了一张照片)：[\s\S]+?\]$/;
  const isSpecialOnly = specialOnlyRe.test(raw.trim());

  /* 转账按钮 HTML 片段（仅角色发出时显示接受/拒绝） */
  function transferButtons(msgId, status) {
    if (status === 'accepted') return '<div class="transfer-inline-status accepted">已收款</div>';
    if (status === 'declined') return '<div class="transfer-inline-status declined">已拒绝</div>';
    return `<div class="transfer-inline-actions">
      <button class="transfer-inline-accept" data-transfer-id="${escHtml(msgId)}">接受</button>
      <button class="transfer-inline-decline" data-transfer-id="${escHtml(msgId)}">拒绝</button>
    </div>`;
  }

  /* 分段处理：按特殊格式正则切割，逐段替换 */
  /* 匹配所有特殊格式（贪婪最短） */
  const globalRe = /\[(.+?)(?:发送了一个表情包：(.+?)|发送了一条语音：([\s\S]+?)|发起了一笔转账：(\d+\.?\d*)元(?:，备注：([\s\S]+?))?|发送了一张照片：([\s\S]+?))\]/g;

  let result = '';
  let last   = 0;
  let match;

  while ((match = globalRe.exec(raw)) !== null) {
    /* 前面的普通文字：HTML 转义 */
    if (match.index > last) {
      result += escHtml(raw.slice(last, match.index));
    }

    const full      = match[0];
    const sender    = match[1]; // 发送者名字部分（不使用，仅用于匹配）

    if (match[2] !== undefined) {
      /* 表情包 */
      const emojiName = match[2].trim();
      const found     = liaoEmojis.find(e => e.name === emojiName);
      if (found) {
        result += `<img class="emoji-msg-bubble" src="${escHtml(found.url)}" alt="${escHtml(emojiName)}" title="${escHtml(emojiName)}">`;
      } else {
        result += escHtml(full);
      }

    } else if (match[3] !== undefined) {
      /* 语音 */
      const voiceText = match[3].trim();
      const duration  = calcVoiceDuration(voiceText);
      result += `<div class="voice-bubble special-inline-bubble" data-voice-text="${escHtml(voiceText)}" title="点击查看语音内容">
        <span class="voice-bubble-icon">◎</span>
        <div class="voice-bubble-bar">${buildVoiceWaves(duration)}</div>
        <span class="voice-bubble-duration">${duration}"</span>
      </div>`;

    } else if (match[4] !== undefined) {
      /* 转账 */
      const amount  = parseFloat(match[4]) || 0;
      const note    = match[5] ? match[5].trim() : '';
      const msgId   = msg ? (msg.id || '') : '';
      const status  = msg ? (msg.transferStatus || 'pending') : 'pending';
      /* 仅角色发出的转账才显示接受/拒绝（role === assistant） */
      const isRole  = msg ? (msg.role === 'assistant') : false;
      const btnHtml = isRole ? transferButtons(msgId, status) : `<div class="transfer-inline-status">${status === 'accepted' ? '已收款' : status === 'declined' ? '已拒绝' : '已发出'}</div>`;
      result += `<div class="transfer-inline-card" data-transfer-id="${escHtml(msgId)}">
        <div class="transfer-inline-header">
          <span class="transfer-bubble-icon">◇</span>
          <span class="transfer-bubble-amount">${amount.toFixed(2)} 元</span>
        </div>
        ${note ? `<div class="transfer-bubble-note">${escHtml(note)}</div>` : ''}
        ${btnHtml}
      </div>`;

    } else if (match[6] !== undefined) {
      /* 假图片 */
      const desc      = match[6].trim();
      const shortDesc = desc.slice(0, 12) + (desc.length > 12 ? '…' : '');
      result += `<div class="fake-photo-bubble special-inline-bubble" data-photo-desc="${escHtml(desc)}">
        <div class="fake-photo-bubble-inner">
          <span class="fake-photo-icon">▤</span>
          <span class="fake-photo-label">${escHtml(shortDesc)}</span>
        </div>
      </div>`;
    } else {
      result += escHtml(full);
    }

    last = match.index + match[0].length;
  }

  /* 剩余普通文字 */
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

  /* 撤回消息 */
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

  /* 时间戳 */
  const tsEl = document.createElement('span');
  tsEl.className     = 'chat-msg-timestamp';
  tsEl.dataset.msgId = msg.id;
  tsEl.textContent   = formatFullTime(msg.ts);
  tsEl.addEventListener('click', (e) => {
    e.stopPropagation();
    openMsgActionMenu(e, msg.id);
  });

  /* 气泡 */
  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'chat-msg-bubble';

  let bubbleInner = '';

  /* 引用块 */
  if (msg.quoteContent) {
    bubbleInner += `<div class="msg-quote-block">${escHtml(msg.quoteContent)}</div>`;
  }

  const msgType = msg.type || 'text';

  if (msgType === 'image') {
    /* 真实图片：保持不变 */
    bubbleInner += `<img class="real-image-bubble" src="${escHtml(msg.content)}" alt="图片">`;
    bubbleEl.innerHTML = bubbleInner;

  } else {
    /* 所有 text 类型（含语音/转账/假图片/表情包的统一格式）统一走 renderSpecialContent */
    const { html, isEmojiOnly, isSpecialOnly } = renderSpecialContent(msg.content || '', msg);
    bubbleInner += html;
    bubbleEl.innerHTML = bubbleInner;

    if (isEmojiOnly) {
      bubbleEl.classList.add('bubble-emoji-only');
    } else if (isSpecialOnly) {
      bubbleEl.classList.add('bubble-special-only');
    }
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
  /* 语音气泡点击 */
  row.querySelectorAll('.voice-bubble').forEach(el => {
    el.addEventListener('click', () => {
      const text = el.dataset.voiceText || msg.content || '';
      document.getElementById('liao-voice-view-content').textContent = text;
      document.getElementById('liao-voice-view-modal').style.display = 'flex';
    });
  });

  /* 假图片点击 */
  row.querySelectorAll('.fake-photo-bubble').forEach(el => {
    el.addEventListener('click', () => {
      const desc = el.dataset.photoDesc || msg.content || '';
      document.getElementById('liao-fake-photo-content').textContent = desc;
      document.getElementById('liao-fake-photo-modal').style.display = 'flex';
    });
  });

  /* 转账内联接受/拒绝按钮 */
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

  /* 真实图片点击 */
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
  const chatUserName2   = chat.chatUserName || liaoUserName;
  const roleSetting     = role.setting || '';
  const roleName2       = role.nickname || role.realname;

  const emojiNameList = liaoEmojis.length
    ? liaoEmojis.map(e => e.name).join('、')
    : '（暂无，不可发送表情包）';

  const systemPrompt =
    `你扮演角色：${roleName2}。\n` +
    (roleSetting ? `【角色设定】\n${roleSetting}\n` : '') +
    (chatUserSetting
      ? `【用户设定】\n对方是${chatUserName2}，${chatUserSetting}\n`
      : `【用户设定】\n对方叫${chatUserName2}。\n`) +
    `【消息格式说明】
所有特殊消息统一使用以下格式，出现在消息文字中：
· [(名字)发送了一个表情包：名称] — 表情包，名称代表情绪含义
· [(名字)发送了一条语音：内容] — 语音消息，内容已转为文字
· [(名字)发起了一笔转账：金额元，备注：备注内容] — 转账，无备注时省略备注部分
· [(名字)发送了一张照片：描述] — 照片，括号内是描述
【你可以在回复里使用的特殊格式】
以下每种格式必须单独占一行，不可和其他文字混写在同一行：
如果你想发表情包，写 [(${roleName2})发送了一个表情包：表情包名称]，名称必须从以下列表选择，列表为空则不可发：${emojiNameList}
如果你想发语音，写 [(${roleName2})发送了一条语音：语音内容]，内容用自然口语不超过20字。
如果你想给对方转账，写 [(${roleName2})发起了一笔转账：金额元，备注：备注内容]，无备注时省略备注部分写成 [(${roleName2})发起了一笔转账：金额元]。
如果你想发一张照片，写 [(${roleName2})发送了一张照片：照片描述]。
如果你想引用某条消息，单独一行写 [QUOTE:ts:时间戳数字]，时间戳对应你看到的消息开头 [ts:数字] 标记，下一行写回复正文。
如果你想撤回你刚才发的上一条消息，单独一行写 [RECALL]。
【回复规则】
1. 用口语短句，像发微信一样聊天，有情绪有立场。
2. 每句话单独一行，换行分隔，绝不写成一段。
3. 允许语气词、不完美表达。
4. 不使用任何 emoji 或颜文字，纯文字（特殊格式除外）。
5. 角色设定优先级最高。
6. 收到转账必须第一条就回应。
7. 发语音内容必须自然口语，有语气词。`;

  let worldBookSection = '';
  if (typeof getWorldBookInjection === 'function') {
    const wbText = getWorldBookInjection(chat.messages, role.id);
    if (wbText) {
      worldBookSection = '\n\n【世界背景设定】\n以下是本次对话适用的世界书背景设定，请将其作为背景知识融入角色扮演，不要直接引用或朗读这些设定：\n' + wbText;
    }
  }

  const finalSystemPrompt = systemPrompt + worldBookSection;

  /* 构建历史消息，每条加 [ts:数字] 前缀 */
  let historyMsgs = chat.messages
    .filter(m => !m.hidden && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({
      role:    m.role === 'assistant' ? 'assistant' : 'user',
      content: '[ts:' + (m.ts || 0) + '] ' + (m.content || '')
    }));
  if (maxApiMsgs > 0 && historyMsgs.length > maxApiMsgs) {
    historyMsgs = historyMsgs.slice(-maxApiMsgs);
  }

  const messages = [{ role: 'system', content: finalSystemPrompt }, ...historyMsgs];

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

    const json     = await res.json();
    let rawContent = json.choices?.[0]?.message?.content || '';
    rawContent     = removeEmoji(rawContent);

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

  /*
   * 预处理：匹配 [QUOTE:ts:数字] 行，提取时间戳查找对应消息。
   * RECALL 保留。其余所有行（含特殊格式）直接作为 type:text 存储。
   */
  const processedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const quoteMatch = lines[i].match(/^\[QUOTE:ts:(\d+)\]$/);
    if (quoteMatch) {
      const ts       = parseInt(quoteMatch[1], 10);
      const foundMsg = liaoChats[currentChatIdx].messages.find(m => m.ts === ts);
      const quoteContent = foundMsg ? (foundMsg.content || '') : '';
      if (i + 1 < lines.length && !/^\[QUOTE:ts:\d+\]$/.test(lines[i + 1])) {
        processedLines.push({ text: lines[i + 1].trim(), quoteContent });
        i++;
      }
      /* 孤立的 [QUOTE:ts:] 没有正文则丢弃 */
    } else {
      processedLines.push({ text: lines[i], quoteContent: '' });
    }
  }

  processedLines.forEach((item, i) => {
    const line         = item.text;
    const quoteContent = item.quoteContent;
    const delay        = calcBubbleDelay(line);
    cumulativeDelay   += (i === 0 ? 200 : delay);

    setTimeout(() => {
      if (currentChatIdx < 0) return;

      let msgObj = null;

      if (/^\[RECALL\]$/.test(line)) {
        /* 撤回：保留 */
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
        /* 所有其他行（含特殊格式字符串）统一作为 type:text 存储 */
        const cleanLine = removeEmoji(line);
        if (!cleanLine) return;
        msgObj = {
          role: 'assistant', type: 'text', content: cleanLine,
          quoteContent: quoteContent || undefined,
          ts: Date.now(),
          id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2)
        };
      }

      if (msgObj) {
        liaoChats[currentChatIdx].messages.push(msgObj);
        lSave('chats', liaoChats);
        appendMessageBubble(msgObj, role, chatUserAvatar2, true);
      }

      if (i === processedLines.length - 1) {
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
      liaoSuiyan[postIdx].comments.push({ author: role.nickname || role.realname, text: c });
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

  const chat     = liaoChats[currentChatIdx];
  const role     = liaoRoles.find(r => r.id === chat.roleId);
  const uAvt     = chat.chatUserAvatar || liaoUserAvatar;
  const userName = chat.chatUserName || liaoUserName;

  const quoteContent = (currentQuoteMsgIdx >= 0 && chat.messages[currentQuoteMsgIdx])
    ? (chat.messages[currentQuoteMsgIdx].content || '') : '';

  /* type:text，content 统一格式 */
  const content = `[(${userName})发送了一条语音：${text}]`;
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

  /* type:text，content 统一格式 */
  const content = note
    ? `[(${userName})发起了一笔转账：${amount.toFixed(2)}元，备注：${note}]`
    : `[(${userName})发起了一笔转账：${amount.toFixed(2)}元]`;
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

  /* type:text，content 统一格式 */
  const content = `[(${userName})发送了一张照片：${desc}]`;
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
   真实图片发送（保持 type:image 不变）
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
    const empty = document.createElement('div');
    empty.style.cssText = 'grid-column:1/-1;text-align:center;padding:20px;font-size:12px;color:var(--text-light);';
    empty.textContent   = '还没有表情包，点击导入吧';
    grid.appendChild(empty);
    return;
  }

  filtered.forEach(emoji => {
    const wrap = document.createElement('div');
    wrap.className = 'emoji-grid-wrap';
    wrap.addEventListener('click', () => sendEmojiMsg(emoji));

    const img     = document.createElement('img');
    img.className = 'emoji-grid-item';
    img.src       = emoji.url;
    img.alt       = emoji.name || '';
    img.title     = emoji.name || '';
    img.loading   = 'lazy';

    const nameP     = document.createElement('p');
    nameP.className = 'emoji-grid-name';
    nameP.textContent = emoji.name || '';

    wrap.appendChild(img);
    wrap.appendChild(nameP);
    grid.appendChild(wrap);
  });
}

function sendEmojiMsg(emoji) {
  if (currentChatIdx < 0) return;
  const chat     = liaoChats[currentChatIdx];
  const role     = liaoRoles.find(r => r.id === chat.roleId);
  const uAvt     = chat.chatUserAvatar || liaoUserAvatar;
  const userName = chat.chatUserName || liaoUserName;

  /* type:text，content 统一格式 */
  const content = `[(${userName})发送了一个表情包：${emoji.name || '表情包'}]`;
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

  /* 关闭面板 */
  emojiPanelOpen = false;
  document.getElementById('emoji-panel').style.display = 'none';
  document.getElementById('csb-emoji').classList.remove('active');
}

/* ---------- 表情包导入/管理按钮 ---------- */
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
          id:   'emoji_' + Date.now() + '_' + Math.random().toString(36).slice(2),
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

    const img     = document.createElement('img');
    img.src       = emoji.url;
    img.alt       = emoji.name || '';
    img.loading   = 'lazy';

    const nameP     = document.createElement('p');
    nameP.className = 'emoji-manage-name';
    nameP.textContent = emoji.name || '';

    const check     = document.createElement('span');
    check.className = 'emoji-manage-check';
    check.textContent = '√';

    item.appendChild(img);
    item.appendChild(nameP);
    item.appendChild(check);

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

    const avatarImg       = document.createElement('img');
    avatarImg.className   = 'role-card-avatar';
    avatarImg.src         = role.avatar || defaultAvatar();
    avatarImg.alt         = '';

    const nameDiv         = document.createElement('div');
    nameDiv.className     = 'role-card-name';
    nameDiv.textContent   = role.nickname;

    const realDiv         = document.createElement('div');
    realDiv.className     = 'role-card-real';
    realDiv.textContent   = role.realname;

    const settingsBtn           = document.createElement('button');
    settingsBtn.className       = 'role-card-settings-btn';
    settingsBtn.dataset.roleId  = role.id;
    settingsBtn.textContent     = '聊天设置';

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
