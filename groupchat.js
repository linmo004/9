/* ============================================================
   groupchat.js — QQ风格群聊室（多角色群聊 + AI回复）
   ============================================================ */

/* ---- 数据 ---- */
let gcGroups     = lLoad('gcGroups', []);
let gcCurrentGid = null;
let gcPendingImg = '';
let gcExtraOpen  = false;

function gcSave() { lSave('gcGroups', gcGroups); }

/* ---- 工具 ---- */
function gcFormatTime(ts) {
  return typeof formatTime === 'function' ? formatTime(ts) : '';
}

function gcHHMM(ts) {
  if (!ts) return '';
  const d  = new Date(ts);
  const H  = String(d.getHours()).padStart(2, '0');
  const Mi = String(d.getMinutes()).padStart(2, '0');
  return H + ':' + Mi;
}

function gcScrollToBottom() {
  const area = document.getElementById('gc-messages-area');
  if (area) area.scrollTop = area.scrollHeight;
}

function gcShowTyping(show, roleName) {
  const el = document.getElementById('gc-typing');
  const nm = document.getElementById('gc-typing-name');
  if (!el) return;
  el.classList.toggle('show', show);
  if (nm) nm.textContent = show ? (roleName + ' 正在输入…') : '';
  if (show) gcScrollToBottom();
}

function gcGetRole(roleId) {
  return liaoRoles.find(r => r.id === roleId) || null;
}

function gcGetSenderName(group, roleField) {
  if (roleField === 'user') return lLoad('userName', '我');
  const role = gcGetRole(roleField);
  return role ? (role.nickname || role.realname) : '未知';
}

function gcGetSenderAvatar(roleField) {
  if (roleField === 'user') {
    return lLoad('userAvatar', 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=user');
  }
  const role = gcGetRole(roleField);
  return role ? (role.avatar || defaultAvatar()) : defaultAvatar();
}

function gcGetCurrentGroup() {
  if (!gcCurrentGid) return null;
  return gcGroups.find(g => g.id === gcCurrentGid) || null;
}

/* ---- 打开/关闭 App ---- */
function openGroupChatApp() {
  const el = document.getElementById('groupchat-app');
  if (el) {
    el.style.display = 'flex';
    gcRenderGroupList();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function closeGroupChatApp() {
  const el = document.getElementById('groupchat-app');
  if (el) el.style.display = 'none';
}

/* ---- 渲染群列表 ---- */
function gcRenderGroupList() {
  const listEl = document.getElementById('gc-group-list');
  const hintEl = document.getElementById('gc-empty-hint');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (!gcGroups.length) {
    if (hintEl) hintEl.style.display = 'block';
    return;
  }
  if (hintEl) hintEl.style.display = 'none';

  gcGroups.forEach(group => {
    const msgs    = group.messages || [];
    const lastMsg = msgs.length ? msgs[msgs.length - 1] : null;
    let preview   = '暂无消息';

    if (lastMsg) {
      const sName = gcGetSenderName(group, lastMsg.role);
      if (lastMsg.recalled)              preview = sName + ': [撤回了一条消息]';
      else if (lastMsg.type === 'image') preview = sName + ': [图片]';
      else if (lastMsg.type === 'voice') preview = sName + ': [语音]';
      else                               preview = sName + ': ' + (lastMsg.content || '');
    }

    const item = document.createElement('div');
    item.className = 'gc-group-item';

    let avatarHtml = '';
    if (group.avatar) {
      avatarHtml = '<img class="gc-group-avatar" src="' + escHtml(group.avatar) + '" alt="">';
    } else {
      const initial = (group.name || '群')[0];
      avatarHtml = '<div class="gc-group-avatar-default">' + escHtml(initial) + '</div>';
    }

    item.innerHTML =
      avatarHtml +
      '<div class="gc-group-body">' +
        '<div class="gc-group-name">' + escHtml(group.name) + '</div>' +
        '<div class="gc-group-preview">' + escHtml(preview.slice(0, 40)) + '</div>' +
      '</div>' +
      '<div class="gc-group-meta">' +
        '<div class="gc-group-time">' + (lastMsg ? gcFormatTime(lastMsg.ts) : '') + '</div>' +
      '</div>';

    item.addEventListener('click', () => gcOpenGroup(group.id));
    listEl.appendChild(item);
  });
}

/* ---- 打开群聊界面 ---- */
function gcOpenGroup(gid) {
  gcCurrentGid = gid;
  const group  = gcGetCurrentGroup();
  if (!group) return;

  document.getElementById('gc-chat-title').textContent    = group.name;
  document.getElementById('gc-chat-subtitle').textContent = (group.memberRoleIds.length + 1) + '人';

  gcExtraOpen = false;
  const extraBar = document.getElementById('gc-extra-bar');
  if (extraBar) extraBar.style.display = 'none';

  /* 启动该群的自动回复定时器 */
  if (group.autoReplyInterval > 0 || (group.autoReplyTimes && group.autoReplyTimes.length > 0)) {
    gcStartAutoReply(gid);
  }

  gcRenderMessages();

  const chatView = document.getElementById('gc-chat-view');
  if (chatView) {
    chatView.style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  setTimeout(gcScrollToBottom, 80);
}

function gcCloseChatView() {
  gcCurrentGid = null;
  const chatView = document.getElementById('gc-chat-view');
  if (chatView) chatView.style.display = 'none';

  gcExtraOpen = false;
  const extraBar = document.getElementById('gc-extra-bar');
  if (extraBar) extraBar.style.display = 'none';

  gcRenderGroupList();
}

/* ---- 渲染消息 ---- */
function gcRenderMessages() {
  const area  = document.getElementById('gc-messages-area');
  const group = gcGetCurrentGroup();
  if (!area || !group) return;
  area.innerHTML = '';

  const msgs     = group.messages || [];
  const maxLoad  = 50;
  const toRender = msgs.length > maxLoad ? msgs.slice(-maxLoad) : msgs;

  if (msgs.length > maxLoad) {
    const loadBtn = document.createElement('div');
    loadBtn.style.cssText =
      'text-align:center;padding:8px 0;cursor:pointer;font-size:11.5px;color:#07C160;';
    loadBtn.textContent = '↑ 加载更多';
    loadBtn.addEventListener('click', gcRenderAllMessages);
    area.appendChild(loadBtn);
  }

  let lastTs = null;
  toRender.forEach(msg => {
    if (lastTs && (msg.ts - lastTs) >= 5 * 60 * 1000) {
      const div       = document.createElement('div');
      div.className   = 'gc-time-divider';
      div.textContent = gcHHMM(msg.ts);
      area.appendChild(div);
    }
    lastTs = msg.ts;
    gcAppendBubble(msg, group, false);
  });

  gcScrollToBottom();
}

function gcRenderAllMessages() {
  const area  = document.getElementById('gc-messages-area');
  const group = gcGetCurrentGroup();
  if (!area || !group) return;
  area.innerHTML = '';
  const msgs = group.messages || [];
  let lastTs = null;
  msgs.forEach(msg => {
    if (lastTs && (msg.ts - lastTs) >= 5 * 60 * 1000) {
      const div       = document.createElement('div');
      div.className   = 'gc-time-divider';
      div.textContent = gcHHMM(msg.ts);
      area.appendChild(div);
    }
    lastTs = msg.ts;
    gcAppendBubble(msg, group, false);
  });
  gcScrollToBottom();
}

/* ---- 消息内容渲染（表情包解析） ---- */
function gcRenderContent(content) {
  const re = /\[\(([^)]+)\)发送了一个表情包：([^\]]+)\]/g;
  let result   = '';
  let last     = 0;
  let hasEmoji = false;
  let match;

  while ((match = re.exec(content)) !== null) {
    if (match.index > last) {
      result += escHtml(content.slice(last, match.index));
    }
    const emojiName = match[2].trim();

    /* 先从了了表情包库找 */
    let found = null;
    /* 优先从 liao_emojis 的 localStorage 直读，兼容异步加载未完成的情况 */
    let liaoEmojiList = (typeof liaoEmojis !== 'undefined' && Array.isArray(liaoEmojis) && liaoEmojis.length > 0)
      ? liaoEmojis
      : lLoad('emojis', []);
    found = liaoEmojiList.find(e => e.name === emojiName);
    /* 再从群专属表情包找（只找允许分类的） */
    if (!found && gcCurrentGid) {
      const group       = gcGetCurrentGroup();
      const allowedCats = (group && group.emojiAllowedCats) ? group.emojiAllowedCats : [];
      const allGc       = gcLoadGroupEmojis(gcCurrentGid);
      const gcFiltered  = allGc.filter(e => allowedCats.includes(e.cat));
      found = gcFiltered.find(e => e.name === emojiName);
    }

    if (found) {
      hasEmoji = true;
      result +=
        '<img class="gc-emoji-img" src="' + escHtml(found.url) + '"' +
        ' alt="' + escHtml(emojiName) + '" title="' + escHtml(emojiName) + '">';
    } else {
      result += escHtml(match[0]);
    }
    last = match.index + match[0].length;
  }

  if (last < content.length) {
    result += escHtml(content.slice(last));
  }

  return { html: result, hasEmoji };
}

/* ---- 渲染单条气泡 ---- */
function gcAppendBubble(msg, group, animate) {
  const area = document.getElementById('gc-messages-area');
  if (!area) return;

  /* 系统通知（群公告等） */
  if (msg.type === 'notice') {
    const div       = document.createElement('div');
    div.className   = 'gc-time-divider';
    div.textContent = msg.content || '';
    div.style.cssText +=
      'background:rgba(0,0,0,0.06);padding:4px 12px;' +
      'border-radius:999px;margin:6px auto;max-width:fit-content;';
    area.appendChild(div);
    gcScrollToBottom();
    return;
  }

  const isUser = msg.role === 'user';
  const avatar = gcGetSenderAvatar(msg.role);
  const name   = gcGetSenderName(group, msg.role);

  if (!msg.id) {
    msg.id = 'gcmsg_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  }

  /* 撤回消息 */
  if (msg.recalled) {
    const notice         = document.createElement('div');
    notice.className     = 'gc-recall-notice';
    notice.dataset.msgId = msg.id;
    notice.textContent   = name + ' 撤回了一条消息';
    area.appendChild(notice);
    gcScrollToBottom();
    return;
  }

  const row         = document.createElement('div');
  row.className     = 'gc-msg-row' + (isUser ? ' gc-user-row' : '');
  row.dataset.msgId = msg.id;

  const avatarEl     = document.createElement('img');
  avatarEl.className = 'gc-msg-avatar';
  avatarEl.src       = avatar;
  avatarEl.alt       = '';

  const contentEl     = document.createElement('div');
  contentEl.className = 'gc-msg-content';

  if (true) {
    const senderEl       = document.createElement('div');
    senderEl.className   = 'gc-msg-sender';
    senderEl.textContent = name;
    contentEl.appendChild(senderEl);
  }

  const bubbleEl     = document.createElement('div');
  bubbleEl.className = 'gc-msg-bubble';

  if (msg.type === 'image') {
    bubbleEl.classList.add('gc-msg-bubble-image');
    const img = document.createElement('img');
    img.src   = msg.content || '';
    img.alt   = '图片';
    img.addEventListener('click', () => window.open(msg.content, '_blank'));
    bubbleEl.appendChild(img);

  } else if (msg.type === 'voice') {
    bubbleEl.classList.add('gc-voice-bubble');
    const duration = Math.max(1, Math.round(((msg.content || '').length) * 0.4));
    bubbleEl.innerHTML =
      '<span class="gc-voice-icon">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"' +
        ' fill="none" stroke="currentColor" stroke-width="2">' +
        '<path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/>' +
        '<path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/>' +
        '</svg>' +
      '</span>' +
      '<div class="gc-voice-waves">' +
        '<span class="gc-voice-wave" style="height:8px;"></span>' +
        '<span class="gc-voice-wave" style="height:14px;"></span>' +
        '<span class="gc-voice-wave" style="height:10px;"></span>' +
        '<span class="gc-voice-wave" style="height:16px;"></span>' +
        '<span class="gc-voice-wave" style="height:11px;"></span>' +
      '</div>' +
      '<span class="gc-voice-duration">' + duration + '"</span>';
    bubbleEl.addEventListener('click', () => {
      alert('语音内容：' + (msg.content || ''));
    });

    } else {
    const rendered = gcRenderContent(msg.content || '');
    if (rendered.hasEmoji) {
      bubbleEl.innerHTML   = rendered.html;
      bubbleEl.classList.add('gc-bubble-has-emoji');
    } else {
      bubbleEl.textContent = msg.content || '';
    }
  }


  contentEl.appendChild(bubbleEl);

  row.appendChild(avatarEl);
  row.appendChild(contentEl);

  let pressTimer = null;
  bubbleEl.addEventListener('touchstart', (e) => {
    pressTimer = setTimeout(() => gcOpenMsgMenu(e, msg, group), 550);
  }, { passive: true });
  bubbleEl.addEventListener('touchend',    () => clearTimeout(pressTimer));
  bubbleEl.addEventListener('touchmove',   () => clearTimeout(pressTimer));
  bubbleEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    gcOpenMsgMenu(e, msg, group);
  });

  if (animate) {
    row.style.opacity    = '0';
    row.style.transform  = 'translateY(6px)';
    row.style.transition = 'opacity .18s, transform .18s';
    area.appendChild(row);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      row.style.opacity   = '1';
      row.style.transform = 'translateY(0)';
    }));
  } else {
    area.appendChild(row);
  }

  gcScrollToBottom();
}

/* ---- 消息操作菜单 ---- */
function gcOpenMsgMenu(e, msg, group) {
  const menu    = document.getElementById('gc-msg-menu');
  const menuBox = document.getElementById('gc-msg-menu-box');
  if (!menu || !menuBox) return;
  menuBox.innerHTML = '';

  const actions = [
    { label: '复制', fn: () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(msg.content || '');
      } else {
        const ta = document.createElement('textarea');
        ta.value = msg.content || '';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      gcCloseMsgMenu();
    }},
    { label: '撤回', fn: () => {
      const m = group.messages.find(x => x.id === msg.id);
      if (m) {
        m.recalled        = true;
        m.recalledContent = m.content;
        gcSave();
        gcRenderMessages();
      }
      gcCloseMsgMenu();
    }},
    { label: '删除', danger: true, fn: () => {
      const idx = group.messages.findIndex(m => m.id === msg.id);
      if (idx >= 0) {
        group.messages.splice(idx, 1);
        gcSave();
        gcRenderMessages();
      }
      gcCloseMsgMenu();
    }}
  ];

  actions.forEach(a => {
    const btn       = document.createElement('button');
    btn.className   = 'gc-msg-menu-item' + (a.danger ? ' danger' : '');
    btn.textContent = a.label;
    btn.addEventListener('click', a.fn);
    menuBox.appendChild(btn);
  });

  menu.style.display = 'block';

  requestAnimationFrame(() => {
    const clientX = e.clientX ||
      (e.touches && e.touches[0] ? e.touches[0].clientX : window.innerWidth / 2);
    const clientY = e.clientY ||
      (e.touches && e.touches[0] ? e.touches[0].clientY : window.innerHeight / 2);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bw = menuBox.offsetWidth  || 130;
    const bh = menuBox.offsetHeight || 120;
    let x = clientX;
    let y = clientY;
    if (x + bw > vw) x = vw - bw - 8;
    if (y + bh > vh) y = vh - bh - 8;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    menuBox.style.left = x + 'px';
    menuBox.style.top  = y + 'px';
  });

  setTimeout(() => {
    document.addEventListener('click', function onOut() {
      gcCloseMsgMenu();
      document.removeEventListener('click', onOut);
    }, { once: true });
  }, 0);
}

function gcCloseMsgMenu() {
  const menu = document.getElementById('gc-msg-menu');
  if (menu) menu.style.display = 'none';
}

/* ---- 发送用户消息 ---- */
function gcSendUserMessage(content, type) {
  const group = gcGetCurrentGroup();
  if (!group) return;
  type = type || 'text';
  const msg = {
    id:      'gcmsg_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    role:    'user',
    type,
    content,
    ts:      Date.now()
  };
  group.messages.push(msg);
  gcSave();
  gcAppendBubble(msg, group, true);
  gcRenderGroupList();
}

/* ---- 群设置面板 ---- */
function gcOpenSettingsPanel() {
  const group = gcGetCurrentGroup();
  if (!group) return;

  const row = document.getElementById('gc-members-row');
  if (row) {
    row.innerHTML = '';

    const userItem     = document.createElement('div');
    userItem.className = 'gc-member-item';
    const userAvt      = lLoad('userAvatar', 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=user');
    const userName2    = lLoad('userName', '我');
    userItem.innerHTML =
      '<img class="gc-member-avatar" src="' + escHtml(userAvt) + '" alt="">' +
      '<div class="gc-member-name">' + escHtml(userName2) + '</div>';
    row.appendChild(userItem);

    group.memberRoleIds.forEach(rid => {
      const r = gcGetRole(rid);
      if (!r) return;
      const item      = document.createElement('div');
      item.className  = 'gc-member-item';
      item.innerHTML  =
        '<img class="gc-member-avatar" src="' + escHtml(r.avatar || defaultAvatar()) + '" alt="">' +
        '<div class="gc-member-name">' + escHtml(r.nickname || r.realname) + '</div>';
      row.appendChild(item);
    });
  }

  const panel = document.getElementById('gc-settings-panel');
  if (panel) {
    panel.style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function gcCloseSettingsPanel() {
  const panel = document.getElementById('gc-settings-panel');
  if (panel) panel.style.display = 'none';
}

/* ---- 表情包面板 ---- */
function gcToggleEmojiPanel() {
  let panel = document.getElementById('gc-emoji-panel');
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') gcBuildEmojiPanel(panel);
    return;
  }

  panel = document.createElement('div');
  panel.id = 'gc-emoji-panel';
  panel.style.cssText =
    'position:fixed;bottom:120px;left:0;right:0;z-index:500;' +
    'background:#fff;border-top:1px solid #e5e5e5;' +
    'max-height:280px;display:flex;flex-direction:column;';

  document.getElementById('gc-chat-view').appendChild(panel);
  gcBuildEmojiPanel(panel);
}

function gcBuildEmojiPanel(panel) {
  panel.innerHTML = '';

  /* 合并了了表情包 + 群允许分类的表情包 */
  const liaoEmojiSource = (typeof liaoEmojis !== 'undefined' && Array.isArray(liaoEmojis) && liaoEmojis.length > 0)
    ? liaoEmojis
    : lLoad('emojis', []);
  const liaoList = liaoEmojiSource.map(e => ({ ...e, _src: 'liao' }));

  let gcList = [];
  if (gcCurrentGid) {
    const group       = gcGetCurrentGroup();
    const allowedCats = (group && group.emojiAllowedCats) ? group.emojiAllowedCats : [];
    const allGc       = gcLoadGroupEmojis(gcCurrentGid);
    gcList = allGc
      .filter(e => allowedCats.includes(e.cat))
      .map(e => ({ ...e, _src: 'gc' }));
  }

  const allEmojis = [...liaoList, ...gcList];

  if (!allEmojis.length) {
    panel.style.alignItems     = 'center';
    panel.style.justifyContent = 'center';
    panel.style.height         = '80px';
    panel.textContent = '表情包库为空，请先在了了或群设置中导入表情包';
    panel.style.fontSize = '12px';
    panel.style.color    = '#aaa';
    return;
  }

  /* 分类标签栏 */
  const cats = ['全部'];
  allEmojis.forEach(e => {
    const c = e.cat || (e._src === 'liao' ? '了了' : '群');
    if (!cats.includes(c)) cats.push(c);
  });

  const catBar = document.createElement('div');
  catBar.style.cssText =
    'display:flex;gap:6px;padding:8px 10px;overflow-x:auto;' +
    'border-bottom:1px solid #e5e5e5;flex-shrink:0;scrollbar-width:none;';

  let activeCat = '全部';

  const grid = document.createElement('div');
  grid.style.cssText =
    'flex:1;overflow-y:auto;padding:8px;' +
    'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;';

  function renderGrid(cat) {
    activeCat = cat;
    grid.innerHTML = '';

    /* 更新标签高亮 */
    catBar.querySelectorAll('button').forEach(b => {
      b.style.background = b.dataset.cat === cat ? '#07C160' : '#f0f0f0';
      b.style.color      = b.dataset.cat === cat ? '#fff'    : '#555';
    });

    const toShow = cat === '全部'
      ? allEmojis
      : allEmojis.filter(e => (e.cat || (e._src === 'liao' ? '了了' : '群')) === cat);

    toShow.forEach(emoji => {
      const item = document.createElement('div');
      item.style.cssText =
        'display:flex;flex-direction:column;align-items:center;gap:3px;' +
        'cursor:pointer;padding:4px;border-radius:8px;';
      item.addEventListener('mouseenter', () => item.style.background = '#f5f5f5');
      item.addEventListener('mouseleave', () => item.style.background = '');

      const img       = document.createElement('img');
      img.src         = emoji.url || '';
      img.alt         = emoji.name || '';
      img.style.cssText = 'width:52px;height:52px;object-fit:contain;border-radius:6px;';

      const label         = document.createElement('div');
      label.textContent   = emoji.name || '';
      label.style.cssText =
        'font-size:9px;color:#aaa;white-space:nowrap;overflow:hidden;' +
        'text-overflow:ellipsis;max-width:56px;text-align:center;';

      item.appendChild(img);
      item.appendChild(label);

      item.addEventListener('click', () => {
        if (!gcCurrentGid) return;
        const userName = lLoad('userName', '用户');
        const content  = '[(' + userName + ')发送了一个表情包：' + (emoji.name || '') + ']';
        gcSendUserMessage(content, 'text');
        panel.style.display = 'none';
      });

      grid.appendChild(item);
    });
  }

  /* 渲染分类按钮 */
  cats.forEach(cat => {
    const btn       = document.createElement('button');
    btn.textContent = cat;
    btn.dataset.cat = cat;
    btn.style.cssText =
      'padding:4px 12px;border-radius:999px;border:none;cursor:pointer;' +
      'font-size:11px;font-family:inherit;white-space:nowrap;' +
      'background:#f0f0f0;color:#555;flex-shrink:0;';
    btn.addEventListener('click', () => renderGrid(cat));
    catBar.appendChild(btn);
  });

  panel.appendChild(catBar);
  panel.appendChild(grid);
  renderGrid('全部');
}


/* ---- 点击其他地方关闭表情包面板 ---- */
document.addEventListener('click', function (e) {
  const panel = document.getElementById('gc-emoji-panel');
  if (!panel) return;
  const btn = document.getElementById('gc-emoji-btn');
  if (btn && btn.contains(e.target)) return;
  if (!panel.contains(e.target)) {
    panel.style.display = 'none';
  }
});

/* ---- 群专属表情包存取 ---- */
function gcLoadGroupEmojis(gid) {
  return lLoad('gcEmojis_' + gid, []);
}

function gcSaveGroupEmojis(gid, list) {
  lSave('gcEmojis_' + gid, list);
}

function gcGetAllGroupEmojis() {
  if (!gcCurrentGid) return [];
  return gcLoadGroupEmojis(gcCurrentGid);
}
/* ---- 群表情包管理面板 ---- */
let gcEmojiManageCat    = '全部';
let gcEmojiAddPendingImg = '';

function gcOpenEmojiManagePanel() {
  gcCloseSettingsPanel();
  const panel = document.getElementById('gc-emoji-manage-panel');
  if (panel) {
    panel.style.display = 'flex';
    gcRenderEmojiManagePanel();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function gcCloseEmojiManagePanel() {
  const panel = document.getElementById('gc-emoji-manage-panel');
  if (panel) panel.style.display = 'none';
}

function gcRenderEmojiManagePanel() {
  if (!gcCurrentGid) return;
  const list = gcLoadGroupEmojis(gcCurrentGid);

  /* 收集所有分类 */
  const cats = ['全部'];
  list.forEach(e => {
    if (e.cat && !cats.includes(e.cat)) cats.push(e.cat);
  });

  /* 渲染分类标签 */
  const catBar = document.getElementById('gc-emoji-cat-bar');
  if (catBar) {
    catBar.innerHTML = '';
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.textContent = cat;
      btn.style.cssText =
        'padding:5px 14px;border-radius:999px;border:none;cursor:pointer;' +
        'font-size:12px;font-family:inherit;transition:background .12s;white-space:nowrap;' +
        (cat === gcEmojiManageCat
          ? 'background:#07C160;color:#fff;'
          : 'background:#f0f0f0;color:#555;');
      btn.addEventListener('click', () => {
        gcEmojiManageCat = cat;
        gcRenderEmojiManagePanel();
      });
      catBar.appendChild(btn);
    });
  }

  /* 渲染表情包网格 */
  const grid = document.getElementById('gc-emoji-manage-grid');
  if (grid) {
    grid.innerHTML = '';
    const toShow = gcEmojiManageCat === '全部'
      ? list
      : list.filter(e => e.cat === gcEmojiManageCat);

    if (!toShow.length) {
      grid.style.display = 'flex';
      grid.style.alignItems = 'center';
      grid.style.justifyContent = 'center';
      grid.innerHTML =
        '<div style="font-size:12px;color:#aaa;text-align:center;">暂无表情包，点击右上角 + 添加</div>';
    } else {
      grid.style.display = 'grid';
      toShow.forEach((emoji, idx) => {
        const realIdx = list.indexOf(emoji);
        const item    = document.createElement('div');
        item.style.cssText =
          'display:flex;flex-direction:column;align-items:center;gap:4px;' +
          'background:#fff;border-radius:10px;padding:8px 4px;position:relative;';

        const img       = document.createElement('img');
        img.src         = emoji.url || '';
        img.alt         = emoji.name || '';
        img.style.cssText = 'width:56px;height:56px;object-fit:contain;border-radius:6px;';

        const name       = document.createElement('div');
        name.textContent = emoji.name || '';
        name.style.cssText =
          'font-size:10px;color:#888;text-align:center;' +
          'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:64px;';

        const cat       = document.createElement('div');
        cat.textContent = emoji.cat || '';
        cat.style.cssText =
          'font-size:9px;color:#07C160;text-align:center;';

        const delBtn       = document.createElement('button');
        delBtn.textContent = '×';
        delBtn.style.cssText =
          'position:absolute;top:3px;right:3px;background:#f23d3d;color:#fff;' +
          'border:none;border-radius:50%;width:16px;height:16px;font-size:11px;' +
          'cursor:pointer;display:flex;align-items:center;justify-content:center;' +
          'font-family:inherit;line-height:1;padding:0;';
        delBtn.addEventListener('click', () => {
          if (!confirm('删除这个表情包？')) return;
          list.splice(realIdx, 1);
          gcSaveGroupEmojis(gcCurrentGid, list);
          gcRenderEmojiManagePanel();
        });

        item.appendChild(img);
        item.appendChild(name);
        item.appendChild(cat);
        item.appendChild(delBtn);
        grid.appendChild(item);
      });
    }
  }

  /* 渲染允许分类勾选 */
  const allowedDiv = document.getElementById('gc-emoji-allowed-cats');
  if (allowedDiv) {
    allowedDiv.innerHTML = '';
    const group       = gcGetCurrentGroup();
    const allowedCats = (group && group.emojiAllowedCats) ? group.emojiAllowedCats : [];
    const realCats    = cats.filter(c => c !== '全部');

    if (!realCats.length) {
      allowedDiv.innerHTML =
        '<div style="font-size:12px;color:#aaa;">先添加表情包并设置分类</div>';
    } else {
      realCats.forEach(cat => {
        const label = document.createElement('label');
        label.style.cssText =
          'display:flex;align-items:center;gap:5px;cursor:pointer;' +
          'font-size:13px;color:#333;padding:4px 0;';
        const cb    = document.createElement('input');
        cb.type     = 'checkbox';
        cb.checked  = allowedCats.includes(cat);
        cb.style.accentColor = '#07C160';
        cb.addEventListener('change', () => {
          const g = gcGetCurrentGroup();
          if (!g) return;
          if (!g.emojiAllowedCats) g.emojiAllowedCats = [];
          if (cb.checked) {
            if (!g.emojiAllowedCats.includes(cat)) g.emojiAllowedCats.push(cat);
          } else {
            g.emojiAllowedCats = g.emojiAllowedCats.filter(c => c !== cat);
          }
          gcSave();
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(cat));
        allowedDiv.appendChild(label);
      });
    }
  }
}
/* ---- 自动群聊定时器 ---- */
let gcAutoReplyTimer  = null;
let gcAutoTimeChecker = null;

function gcStartAutoReply(gid) {
  gcStopAutoReply();
  const group = gcGroups.find(g => g.id === gid);
  if (!group) return;

  const interval  = group.autoReplyInterval || 0;
  const timesList = group.autoReplyTimes || [];

  if (interval > 0) {
    gcAutoReplyTimer = setInterval(() => {
      const cg = gcGroups.find(g => g.id === gid);
      if (!cg || !cg.memberRoleIds || !cg.memberRoleIds.length) return;
      gcTriggerAiChat(cg);
    }, interval * 1000);
  }

  if (timesList.length > 0) {
    const firedToday = new Set();
    gcAutoTimeChecker = setInterval(() => {
      const now    = new Date();
      const hh     = String(now.getHours()).padStart(2, '0');
      const mm     = String(now.getMinutes()).padStart(2, '0');
      const nowStr = hh + ':' + mm;
      if (nowStr === '00:00') firedToday.clear();
      if (timesList.includes(nowStr) && !firedToday.has(nowStr)) {
        firedToday.add(nowStr);
        const cg = gcGroups.find(g => g.id === gid);
        if (!cg || !cg.memberRoleIds || !cg.memberRoleIds.length) return;
        gcTriggerAiChat(cg);
      }
    }, 30000);
  }
}

function gcStopAutoReply() {
  if (gcAutoReplyTimer)  { clearInterval(gcAutoReplyTimer);  gcAutoReplyTimer  = null; }
  if (gcAutoTimeChecker) { clearInterval(gcAutoTimeChecker); gcAutoTimeChecker = null; }
}

async function gcTriggerAiChat(group) {
  if (!group || !group.memberRoleIds || !group.memberRoleIds.length) return;
  const activeConfig = loadApiConfig();
  if (!activeConfig || !activeConfig.url) return;
  const model = loadApiModel();
  if (!model) return;

  const members = group.memberRoleIds.map(rid => gcGetRole(rid)).filter(Boolean);
  if (!members.length) return;

  const userName       = lLoad('userName', '用户');
  const memberNames    = members.map(r => r.nickname || r.realname).join('、');
  const memberSettings = members.map(r =>
    '【' + (r.nickname || r.realname) + '】' + (r.setting || '普通群成员')
  ).join('\n');

  const historyMsgs = (group.messages || [])
    .filter(m => !m.recalled && (m.type === 'text' || !m.type))
    .slice(-20)
    .map(m => gcGetSenderName(group, m.role) + '：' + (m.content || ''))
    .join('\n');

  const systemPrompt =
    '这是群「' + group.name + '」，成员：' + memberNames + '。\n' +
    memberSettings + '\n\n' +
    '根据聊天记录，模拟群成员自然聊天3到6条，每行格式：名字：内容\n' +
    '名字只能是：' + memberNames + '\n' +
    '【严禁】以「' + userName + '」名义发言。只输出对话行。\n\n' +
    '最近记录：\n' + (historyMsgs || '（暂无）');

  try {
    const endpoint = activeConfig.url.replace(/\/$/, '') + '/chat/completions';
    const headers  = { 'Content-Type': 'application/json' };
    if (activeConfig.key) headers['Authorization'] = 'Bearer ' + activeConfig.key;

    const res = await fetch(endpoint, {
      method: 'POST', headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: systemPrompt }],
        stream: false
      })
    });
    if (!res.ok) return;

    const json       = await res.json();
    let   rawContent = (json.choices?.[0]?.message?.content || '').trim();
    if (typeof removeEmoji === 'function') rawContent = removeEmoji(rawContent);

    const lines  = rawContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsed = [];

    lines.forEach(line => {
      const colonIdx = line.search(/：|:/);
      if (colonIdx <= 0) return;
      const speakerName = line.slice(0, colonIdx).trim();
      const content     = line.slice(colonIdx + 1).trim();
      if (!speakerName || !content) return;
      const role = members.find(r =>
        r.nickname === speakerName || r.realname === speakerName
      );
      if (!role) return;
      parsed.push({ roleId: role.id, roleName: speakerName, content, role });
    });

    let delay = 300;
    parsed.forEach((item, i) => {
      const lineDelay = typeof calcBubbleDelay === 'function'
        ? calcBubbleDelay(item.content) : 800;
      setTimeout(() => {
        const cg = gcGroups.find(g => g.id === group.id);
        if (!cg) return;
        const msg = {
          id:      'gcmsg_' + Date.now() + '_' + Math.random().toString(36).slice(2),
          role:    item.roleId,
          type:    'text',
          content: item.content,
          ts:      Date.now()
        };
        cg.messages.push(msg);
        gcSave();
        if (gcCurrentGid === group.id) {
          gcAppendBubble(msg, cg, true);
        }
        gcNotify(item.roleName, item.content, item.role);
        if (i === parsed.length - 1) gcRenderGroupList();
      }, delay);
      delay += lineDelay + 300;
    });

  } catch (e) { /* 静默失败 */ }
}

/* ---- 消息通知 ---- */
function gcRequestNotifyPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function gcNotify(roleName, content, role) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(roleName, {
      body:     content,
      icon:     (role && role.avatar) ? role.avatar : undefined,
      tag:      'gc_' + (role ? role.id : 'unknown'),
      renotify: true
    });
  } catch (e) { /* 静默失败 */ }
}

/* ---- 自动时间列表辅助 ---- */
function gcGetCurrentAutoTimes() {
  const listEl = document.getElementById('gc-autoreply-timelist');
  if (!listEl) return [];
  return Array.from(listEl.querySelectorAll('[data-time]'))
    .map(el => el.dataset.time);
}

function gcRenderAutoTimeList(times) {
  const listEl = document.getElementById('gc-autoreply-timelist');
  if (!listEl) return;
  listEl.innerHTML = '';
  times.forEach(t => {
    const tag = document.createElement('div');
    tag.dataset.time  = t;
    tag.textContent   = t + ' ×';
    tag.style.cssText =
      'padding:5px 12px;background:#e8faf0;color:#07C160;border-radius:999px;' +
      'font-size:13px;cursor:pointer;border:1px solid #b7e8cc;' +
      'transition:background .12s;user-select:none;-webkit-user-select:none;';
    tag.addEventListener('click', () => {
      const current = gcGetCurrentAutoTimes().filter(x => x !== t);
      gcRenderAutoTimeList(current);
    });
    listEl.appendChild(tag);
  });
}

/* ---- 初始化所有事件绑定 ---- */
function gcInit() {
  gcRequestNotifyPermission();
    /* 无声音频保活，防止网页后台被冻结 */
  const keepAlive = document.getElementById('bg-keepalive');
  if (keepAlive) {
    keepAlive.play().catch(() => {
      /* 需要用户交互才能播放，监听第一次点击后启动 */
      document.addEventListener('click', function startAudio() {
        keepAlive.play().catch(() => {});
        document.removeEventListener('click', startAudio);
      }, { once: true });
    });
  }

  document.getElementById('gc-send-btn').addEventListener('click', function () {
    const input   = document.getElementById('gc-input-field');
    const content = (input.value || '').trim();
    if (!content || !gcCurrentGid) return;
    input.value = '';
    gcSendUserMessage(content, 'text');
  });

  document.getElementById('gc-input-field').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const content = this.value.trim();
      if (!content || !gcCurrentGid) return;
      this.value = '';
      gcSendUserMessage(content, 'text');
    }
  });

  document.getElementById('gc-extra-btn').addEventListener('click', function () {
    gcExtraOpen = !gcExtraOpen;
    const bar = document.getElementById('gc-extra-bar');
    if (bar) {
      bar.style.display = gcExtraOpen ? 'block' : 'none';
      if (gcExtraOpen && typeof lucide !== 'undefined') lucide.createIcons();
    }
  });

  document.getElementById('gc-extra-photo').addEventListener('click', function () {
    gcPendingImg = '';
    const urlEl  = document.getElementById('gc-photo-url');
    const prevEl = document.getElementById('gc-photo-preview');
    if (urlEl)  urlEl.value = '';
    if (prevEl) { prevEl.src = ''; prevEl.style.display = 'none'; }
    const modal = document.getElementById('gc-photo-modal');
    if (modal) {
      modal.style.display = 'flex';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  });

  document.getElementById('gc-photo-local-btn').addEventListener('click', function () {
    document.getElementById('gc-photo-file').click();
  });

  document.getElementById('gc-photo-file').addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      gcPendingImg = e.target.result;
      const prev  = document.getElementById('gc-photo-preview');
      if (prev) { prev.src = gcPendingImg; prev.style.display = 'block'; }
      document.getElementById('gc-photo-url').value = '';
    };
    reader.readAsDataURL(file);
    this.value = '';
  });

  document.getElementById('gc-photo-url').addEventListener('input', function () {
    const url = this.value.trim();
    if (url) {
      gcPendingImg = url;
      const prev  = document.getElementById('gc-photo-preview');
      if (prev) { prev.src = url; prev.style.display = 'block'; }
    }
  });

  document.getElementById('gc-photo-confirm').addEventListener('click', function () {
    if (!gcPendingImg) { alert('请选择或输入图片'); return; }
    document.getElementById('gc-photo-modal').style.display = 'none';
    gcSendUserMessage(gcPendingImg, 'image');
    gcPendingImg = '';
  });

  document.getElementById('gc-photo-cancel').addEventListener('click', function () {
    document.getElementById('gc-photo-modal').style.display = 'none';
    gcPendingImg = '';
  });

  document.getElementById('gc-emoji-btn').addEventListener('click', function () {
    gcToggleEmojiPanel();
  });

  document.getElementById('gc-extra-voice').addEventListener('click', function () {
    document.getElementById('gc-voice-input').value = '';
    const modal = document.getElementById('gc-voice-modal');
    if (modal) modal.style.display = 'flex';
  });

  document.getElementById('gc-voice-confirm').addEventListener('click', function () {
    const text = document.getElementById('gc-voice-input').value.trim();
    if (!text) return;
    document.getElementById('gc-voice-modal').style.display = 'none';
    gcSendUserMessage(text, 'voice');
  });

  document.getElementById('gc-voice-cancel').addEventListener('click', function () {
    document.getElementById('gc-voice-modal').style.display = 'none';
  });

  document.getElementById('gc-extra-ai').addEventListener('click', async function () {
  const group = gcGetCurrentGroup();
  if (!group) return;
  if (!group.memberRoleIds || !group.memberRoleIds.length) {
    alert('群里没有角色成员'); return;
  }
  const activeConfig = loadApiConfig();
  if (!activeConfig || !activeConfig.url) { alert('请先在设置中配置 API 地址'); return; }
  const model = loadApiModel();
  if (!model) { alert('请先选择模型'); return; }

  const userName = lLoad('userName', '用户');

  /* 所有成员信息 */
  const members = group.memberRoleIds
    .map(rid => gcGetRole(rid))
    .filter(Boolean);

  const memberNames = members.map(r => r.nickname || r.realname).join('、');

  /* 每个成员的人设 */
  const memberSettings = members.map(r =>
    '【' + (r.nickname || r.realname) + '】' + (r.setting ? r.setting : '普通群成员')
  ).join('\n');

  /* 最近消息历史 */
  const historyMsgs = (group.messages || [])
    .filter(m => !m.recalled && (m.type === 'text' || !m.type))
    .slice(-20)
    .map(m => gcGetSenderName(group, m.role) + '：' + (m.content || ''))
    .join('\n');

  /* 第一个角色先显示打字 */
  gcShowTyping(true, members[0] ? (members[0].nickname || members[0].realname) : '');

  const systemPrompt =
    '你是一个群聊模拟器。\n' +
    '这个群名叫「' + group.name + '」。\n' +
    '群成员有：' + userName + '（真实用户）、' + memberNames + '。\n\n' +
    '每个成员的人设如下：\n' + memberSettings + '\n\n' +
    '【任务】\n' +
    '根据最近的聊天记录，模拟接下来群里的一段自然对话。\n' +
    '要求：\n' +
    '1. 每个成员都必须发言，发言次数不限，可以多条。\n' +
    '2. 顺序自由，可以穿插，比如 A说两条、B说一条、C说两条、A又说一条，这样。\n' +
    '3. 总共生成8到15条消息。\n' +
    '4. 可以回应用户说的话，也可以群成员之间自己聊，两种都行。\n' +
    '5. 口语化，短句，像真实发微信一样，有情绪有语气。\n' +
    '6. 可以互相@对方，格式：@名字。\n' +
    '7. 禁止任何人说自己是AI。\n\n' +
    '【输出格式】\n' +
    '每行一条消息，格式严格为：\n' +
    '名字：消息内容\n' +
    '名字必须是群成员名字之一：' + memberNames + '\n' +
    '【严禁】以「' + userName + '」的名义发言，禁止替用户说话，用户的发言只能由真实用户自己决定。\n' +
    '不要输出任何其他内容，不要编号，不要说明，只输出对话行。\n\n' +
    '【最近聊天记录】\n' + (historyMsgs || '（暂无）');

  try {
    const endpoint = activeConfig.url.replace(/\/$/, '') + '/chat/completions';
    const headers  = { 'Content-Type': 'application/json' };
    if (activeConfig.key) headers['Authorization'] = 'Bearer ' + activeConfig.key;

    const res = await fetch(endpoint, {
      method: 'POST', headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: systemPrompt }],
        stream: false
      })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const json       = await res.json();
    let   rawContent = (json.choices?.[0]?.message?.content || '').trim();
    if (typeof removeEmoji === 'function') rawContent = removeEmoji(rawContent);

    gcShowTyping(false, '');

    /* 解析每行：名字：内容 */
    const lines = rawContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsed = [];

    lines.forEach(line => {
      /* 找第一个冒号（中文或英文都兼容） */
      const colonIdx = line.search(/：|:/);
      if (colonIdx <= 0) return;
      const speakerName = line.slice(0, colonIdx).trim();
      const content     = line.slice(colonIdx + 1).trim();
      if (!speakerName || !content) return;

      /* 找对应角色 */
      const role = members.find(r =>
        (r.nickname || r.realname) === speakerName ||
        r.nickname === speakerName ||
        r.realname === speakerName
      );
      if (!role) return;

      parsed.push({ roleId: role.id, roleName: speakerName, content });
    });

    if (!parsed.length) {
      alert('AI 没有生成有效对话，请重试');
      return;
    }

    /* 逐条延迟发送 */
    let delay = 300;
    parsed.forEach((item, i) => {
      const lineDelay = typeof calcBubbleDelay === 'function'
        ? calcBubbleDelay(item.content) : 800;

      /* 提前显示打字指示 */
      setTimeout(() => {
        gcShowTyping(true, item.roleName);
      }, delay - 200 < 0 ? 0 : delay - 200);

      setTimeout(() => {
        const cg = gcGetCurrentGroup();
        if (!cg) return;

        gcShowTyping(false, '');

        const msg = {
          id:      'gcmsg_' + Date.now() + '_' + Math.random().toString(36).slice(2),
          role:    item.roleId,
          type:    'text',
          content: item.content,
          ts:      Date.now()
        };
        cg.messages.push(msg);
        gcSave();
        gcAppendBubble(msg, cg, true);

        if (i === parsed.length - 1) gcRenderGroupList();
      }, delay);

      delay += lineDelay + 300;
    });

  } catch (err) {
    gcShowTyping(false, '');
    alert('AI 回复失败：' + err.message);
  }
});

  document.getElementById('gc-extra-members').addEventListener('click', function () {
    if (!gcGetCurrentGroup()) return;
    gcOpenSettingsPanel();
  });

  document.getElementById('gc-chat-back').addEventListener('click', gcCloseChatView);

  document.getElementById('gc-chat-settings-btn').addEventListener('click', gcOpenSettingsPanel);

  document.getElementById('gc-settings-close').addEventListener('click', gcCloseSettingsPanel);

  document.getElementById('gc-settings-panel').addEventListener('click', function (e) {
    if (e.target === this) gcCloseSettingsPanel();
  });

  document.getElementById('gc-settings-rename').addEventListener('click', function () {
    const group = gcGetCurrentGroup();
    if (!group) return;
    const newName = prompt('输入新群名称', group.name);
    if (!newName || !newName.trim()) return;
    group.name = newName.trim();
    gcSave();
    document.getElementById('gc-chat-title').textContent = group.name;
    gcCloseSettingsPanel();
    gcRenderGroupList();
  });

  document.getElementById('gc-settings-notice').addEventListener('click', function () {
    const group = gcGetCurrentGroup();
    if (!group) return;
    const notice = prompt('输入群公告', group.notice || '');
    if (notice === null) return;
    group.notice = notice.trim();
    gcSave();
    if (notice.trim()) {
      const noticeMsg = {
        id:      'gcmsg_' + Date.now() + '_notice',
        role:    'system', type: 'notice',
        content: '群公告：' + notice.trim(),
        ts:      Date.now()
      };
      group.messages.push(noticeMsg);
      gcSave();
      gcRenderMessages();
    }
    gcCloseSettingsPanel();
  });
  document.getElementById('gc-settings-emojis').addEventListener('click', function () {
    gcOpenEmojiManagePanel();
  });

  document.getElementById('gc-emoji-manage-back').addEventListener('click', function () {
    gcCloseEmojiManagePanel();
  });

  document.getElementById('gc-emoji-manage-add-btn').addEventListener('click', function () {
    gcEmojiAddPendingImg = '';
    document.getElementById('gc-emoji-add-name').value    = '';
    document.getElementById('gc-emoji-add-url').value     = '';
    document.getElementById('gc-emoji-add-cat').value     = '';
    const prev = document.getElementById('gc-emoji-add-preview');
    if (prev) { prev.src = ''; prev.style.display = 'none'; }
    const modal = document.getElementById('gc-emoji-add-modal');
    if (modal) modal.style.display = 'flex';
  });

  document.getElementById('gc-emoji-add-local-btn').addEventListener('click', function () {
    document.getElementById('gc-emoji-add-file').click();
  });

  document.getElementById('gc-emoji-add-file').addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      gcEmojiAddPendingImg = e.target.result;
      const prev = document.getElementById('gc-emoji-add-preview');
      if (prev) { prev.src = gcEmojiAddPendingImg; prev.style.display = 'block'; }
      document.getElementById('gc-emoji-add-url').value = '';
    };
    reader.readAsDataURL(file);
    this.value = '';
  });

  document.getElementById('gc-emoji-add-url').addEventListener('input', function () {
    const url = this.value.trim();
    if (url) {
      gcEmojiAddPendingImg = url;
      const prev = document.getElementById('gc-emoji-add-preview');
      if (prev) { prev.src = url; prev.style.display = 'block'; }
    }
  });

  document.getElementById('gc-emoji-add-confirm').addEventListener('click', function () {
    if (!gcCurrentGid) return;
    const name = document.getElementById('gc-emoji-add-name').value.trim();
    const url  = gcEmojiAddPendingImg ||
                 document.getElementById('gc-emoji-add-url').value.trim();
    const cat  = document.getElementById('gc-emoji-add-cat').value.trim() || '默认';
    if (!name) { alert('请填写表情包名称'); return; }
    if (!url)  { alert('请选择或输入图片'); return; }

    const list = gcLoadGroupEmojis(gcCurrentGid);
    list.push({ name, url, cat });
    gcSaveGroupEmojis(gcCurrentGid, list);

    document.getElementById('gc-emoji-add-modal').style.display = 'none';
    gcEmojiAddPendingImg = '';
    gcRenderEmojiManagePanel();
  });

  document.getElementById('gc-emoji-add-cancel').addEventListener('click', function () {
    document.getElementById('gc-emoji-add-modal').style.display = 'none';
    gcEmojiAddPendingImg = '';
  });

  document.getElementById('gc-emoji-add-modal').addEventListener('click', function (e) {
    if (e.target === this) {
      this.style.display = 'none';
      gcEmojiAddPendingImg = '';
    }
  });

  document.getElementById('gc-settings-delete').addEventListener('click', function () {
    const group = gcGetCurrentGroup();
    if (!group) return;
    if (!confirm('确定解散群「' + group.name + '」？此操作不可恢复。')) return;
    gcGroups = gcGroups.filter(g => g.id !== group.id);
    gcSave();
    gcCloseSettingsPanel();
    gcCloseChatView();
  });
  
  document.getElementById('gc-settings-autoreply').addEventListener('click', function () {
    const group = gcGetCurrentGroup();
    if (!group) return;
    document.getElementById('gc-autoreply-interval').value =
      group.autoReplyInterval || '';
    gcRenderAutoTimeList(group.autoReplyTimes || []);
    gcCloseSettingsPanel();
    document.getElementById('gc-autoreply-modal').style.display = 'flex';
  });
    
  document.getElementById('gc-autoreply-time-add').addEventListener('click', function () {
    const val = document.getElementById('gc-autoreply-time-input').value;
    if (!val) return;
    const existing = gcGetCurrentAutoTimes();
    if (existing.includes(val)) { alert('该时间已添加'); return; }
    existing.push(val);
    existing.sort();
    gcRenderAutoTimeList(existing);
    document.getElementById('gc-autoreply-time-input').value = '';
  });

  document.getElementById('gc-autoreply-save').addEventListener('click', function () {
    const group = gcGetCurrentGroup();
    if (!group) return;
    const interval  = parseInt(document.getElementById('gc-autoreply-interval').value) || 0;
    const timesList = gcGetCurrentAutoTimes();
    group.autoReplyInterval = interval;
    group.autoReplyTimes    = timesList;
    gcSave();
    document.getElementById('gc-autoreply-modal').style.display = 'none';
    const hasAuto = interval > 0 || timesList.length > 0;
    if (hasAuto) {
      gcStartAutoReply(group.id);
    } else {
      gcStopAutoReply();
    }
    alert('已保存，自动群聊已' + (hasAuto ? '开启' : '关闭'));
  });

  document.getElementById('gc-autoreply-cancel').addEventListener('click', function () {
    document.getElementById('gc-autoreply-modal').style.display = 'none';
  });

  document.getElementById('gc-autoreply-modal').addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none';
  });

  

  document.getElementById('gc-new-btn').addEventListener('click', function () {
    const picker = document.getElementById('gc-role-picker');
    if (picker) {
      picker.innerHTML = '';
      if (!liaoRoles.length) {
        picker.innerHTML =
          '<div style="font-size:12px;color:#aaa;padding:8px 0;">角色库为空，请先在了了中新建角色</div>';
      } else {
        liaoRoles.forEach(role => {
          const item      = document.createElement('div');
          item.className  = 'gc-role-pick-item';
          item.dataset.id = role.id;
          item.innerHTML  =
            '<img class="gc-role-pick-avatar" src="' +
              escHtml(role.avatar || defaultAvatar()) + '" alt="">' +
            '<div class="gc-role-pick-name">' +
              escHtml(role.nickname || role.realname) + '</div>';
          item.addEventListener('click', function () { this.classList.toggle('selected'); });
          picker.appendChild(item);
        });
      }
    }
    document.getElementById('gc-new-name').value   = '';
    document.getElementById('gc-new-avatar').value = '';
    const modal = document.getElementById('gc-create-modal');
    if (modal) {
      modal.style.display = 'flex';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  });

  document.getElementById('gc-create-confirm').addEventListener('click', function () {
    const name   = (document.getElementById('gc-new-name').value || '').trim();
    const avatar = (document.getElementById('gc-new-avatar').value || '').trim();
    if (!name) { alert('请填写群名称'); return; }
    const picker   = document.getElementById('gc-role-picker');
    const selected = picker
      ? Array.from(picker.querySelectorAll('.gc-role-pick-item.selected')).map(el => el.dataset.id)
      : [];
    const group = {
      id:            'gc_' + Date.now() + '_' + Math.random().toString(36).slice(2),
      name,
      avatar:        avatar || '',
      memberRoleIds: selected,
      messages:      [],
      notice:        '',
      createdAt:     Date.now()
    };
    gcGroups.push(group);
    gcSave();
    document.getElementById('gc-create-modal').style.display = 'none';
    gcRenderGroupList();
    gcOpenGroup(group.id);
  });

  document.getElementById('gc-create-cancel').addEventListener('click', function () {
    document.getElementById('gc-create-modal').style.display = 'none';
  });

  document.getElementById('gc-create-modal').addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none';
  });

  document.getElementById('gc-close-btn').addEventListener('click', closeGroupChatApp);

  document.addEventListener('click', function (e) {
    const appItem = e.target.closest('.app-item[data-app="groupchat"]');
    if (appItem) openGroupChatApp();
  });
}

/* ---- 启动 ---- */
gcInit();
