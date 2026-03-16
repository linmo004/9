/* ============================================================
   couple-blog.js — 博客 + 粉丝评论 + 自动发帖
   ============================================================ */

const CP_MOOD_OPTIONS = ['开心', '平静', '想你', '感慨', '兴奋', '难过', '期待', '慵懒'];

function cpRenderBlog() {
  const panel = document.getElementById('couple-panel-blog');
  if (!panel || !cpCurrentSpace) return;

  const blog     = cpCurrentSpace.blog;
  const posts    = blog.posts || [];
  const roleName = cpGetRoleName(cpCurrentRole);

  panel.innerHTML = `
    <div class="cp-blog-header">
      <div>
        <div class="cp-blog-header-title">我们的博客</div>
        <div class="cp-blog-header-fans">粉丝 ${blog.fanCount || 0} · ${escHtml(roleName)} & 我</div>
      </div>
      <button class="cp-blog-post-btn" id="cp-blog-post-btn">+ 发帖</button>
    </div>
    <div class="cp-blog-list" id="cp-blog-list"></div>
  `;

  const listEl = document.getElementById('cp-blog-list');
  if (!posts.length) {
    listEl.innerHTML = '<div class="cp-empty">还没有帖子<br>发布第一篇吧</div>';
  } else {
    [...posts].reverse().forEach(post => {
      listEl.appendChild(cpBuildPostCard(post));
    });
  }

  document.getElementById('cp-blog-post-btn') &&
  document.getElementById('cp-blog-post-btn').addEventListener('click', cpOpenPostModal);
}

function cpBuildPostCard(post) {
  const isUser     = post.authorType === 'user';
  const userName   = cpGetUserName();
  const userAvatar = cpGetUserAvatar();
  const roleName   = cpGetRoleName(cpCurrentRole);
  const roleAvatar = cpGetRoleAvatar(cpCurrentRole);

  const authorName   = isUser ? userName   : roleName;
  const authorAvatar = isUser ? userAvatar : roleAvatar;

  const card = document.createElement('div');
  card.className    = 'cp-blog-post-card';
  card.dataset.postId = post.id;

  let imgHtml = '';
  if (post.imgUrl) {
    imgHtml = '<img class="cp-blog-post-img" src="' + escHtml(post.imgUrl) +
              '" alt="" loading="lazy">';
  }

  const commentsHtml = (post.comments || []).map(c =>
    '<div class="cp-blog-comment-item">' +
      '<img class="cp-blog-comment-avatar" src="' + escHtml(c.avatar) + '" alt="">' +
      '<div class="cp-blog-comment-body">' +
        '<div class="cp-blog-comment-name">' + escHtml(c.name) + '</div>' +
        '<div class="cp-blog-comment-text">' + escHtml(c.text) + '</div>' +
        (c.reply
          ? '<div class="cp-blog-comment-text" style="margin-top:4px;color:#ff8f00;">' +
            '↳ ' + escHtml(c.replyName || authorName) + '：' + escHtml(c.reply) + '</div>'
          : '<button class="cp-blog-comment-reply-btn" data-cid="' + c.id + '">回复</button>'
        ) +
      '</div>' +
    '</div>'
  ).join('');

  card.innerHTML =
    '<div class="cp-blog-post-top">' +
      '<img class="cp-blog-post-avatar" src="' + escHtml(authorAvatar) + '" alt="">' +
      '<div>' +
        '<div class="cp-blog-post-author">' + escHtml(authorName) + '</div>' +
        '<div class="cp-blog-post-time">' + cpFmtTime(post.ts) + '</div>' +
      '</div>' +
      (post.mood ? '<div class="cp-blog-post-mood">' + escHtml(post.mood) + '</div>' : '') +
    '</div>' +
    imgHtml +
    '<div class="cp-blog-post-content">' + escHtml(post.content || '') + '</div>' +
    '<div class="cp-blog-post-actions">' +
      '<button class="cp-blog-action-btn' + (post.liked ? ' liked' : '') +
        '" data-action="like">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="' +
          (post.liked ? '#e91e63' : 'none') +
          '" stroke="currentColor" stroke-width="2">' +
          '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' +
        '</svg>' +
        ' ' + (post.likes || 0) +
      '</button>' +
      '<button class="cp-blog-action-btn" data-action="comment">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
        '</svg>' +
        ' ' + (post.comments ? post.comments.length : 0) +
      '</button>' +
    '</div>' +
    (post.comments && post.comments.length
      ? '<div class="cp-blog-comments-area">' + commentsHtml + '</div>'
      : '') +
    '<div class="cp-blog-comment-input-row">' +
      '<input class="cp-blog-comment-input" placeholder="说点什么…" data-postid="' + post.id + '">' +
      '<button class="cp-blog-comment-send" data-postid="' + post.id + '">发送</button>' +
    '</div>';

  /* 点赞 */
  card.querySelector('[data-action="like"]').addEventListener('click', () => {
    const p = cpCurrentSpace.blog.posts.find(x => x.id === post.id);
    if (!p) return;
    p.liked  = !p.liked;
    p.likes  = (p.likes || 0) + (p.liked ? 1 : -1);
    if (p.likes < 0) p.likes = 0;
    cpSaveSpace();
    cpRenderBlog();
  });

  /* 发评论 */
  card.querySelector('.cp-blog-comment-send').addEventListener('click', function() {
    const postId = this.dataset.postid;
    const input  = card.querySelector('.cp-blog-comment-input');
    const text   = input ? input.value.trim() : '';
    if (!text) return;
    cpAddUserComment(postId, text);
    if (input) input.value = '';
  });

  card.querySelector('.cp-blog-comment-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const text = this.value.trim();
      if (!text) return;
      cpAddUserComment(post.id, text);
      this.value = '';
    }
  });

  /* 回复粉丝评论 */
  card.querySelectorAll('.cp-blog-comment-reply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cid  = btn.dataset.cid;
      const text = prompt('回复评论…');
      if (!text || !text.trim()) return;
      const p = cpCurrentSpace.blog.posts.find(x => x.id === post.id);
      if (!p) return;
      const c = (p.comments || []).find(x => x.id === cid);
      if (!c) return;
      c.reply     = text.trim();
      c.replyName = cpGetUserName();
      cpSaveSpace();
      cpRenderBlog();
    });
  });

  return card;
}

/* ---- 发帖弹窗 ---- */
function cpOpenPostModal() {
  const existing = document.getElementById('cp-post-modal');
  if (existing) existing.remove();

  const mask = document.createElement('div');
  mask.id    = 'cp-post-modal';
  mask.className = 'cp-modal-mask show';
  mask.innerHTML = `
    <div class="cp-modal-box">
      <div class="cp-modal-title">发布帖子</div>
      <label class="cp-modal-label">内容</label>
      <textarea class="cp-modal-textarea" id="cp-post-content"
        placeholder="写下此刻的心情…" style="min-height:100px;"></textarea>
      <label class="cp-modal-label">图片 URL（可选）</label>
      <input class="cp-modal-input" id="cp-post-img" placeholder="https://…">
      <label class="cp-modal-label">心情标签</label>
      <div class="cp-mood-tags" id="cp-post-moods">
        ${CP_MOOD_OPTIONS.map(m =>
          '<button class="cp-mood-tag" data-mood="' + m + '">' + m + '</button>'
        ).join('')}
      </div>
      <div class="cp-modal-btns">
        <button class="cp-btn-primary" id="cp-post-confirm">发布</button>
        <button class="cp-btn-ghost"   id="cp-post-cancel">取消</button>
      </div>
    </div>
  `;

  document.body.appendChild(mask);

  let selectedMood = '';
  mask.querySelectorAll('.cp-mood-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      mask.querySelectorAll('.cp-mood-tag').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMood = btn.dataset.mood;
    });
  });

  document.getElementById('cp-post-confirm').addEventListener('click', () => {
    const content = (document.getElementById('cp-post-content').value || '').trim();
    const imgUrl  = (document.getElementById('cp-post-img').value   || '').trim();
    if (!content) { alert('请输入内容'); return; }
    cpPublishPost(content, imgUrl, selectedMood, 'user');
    mask.remove();
  });

  document.getElementById('cp-post-cancel').addEventListener('click', () => mask.remove());
  mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
}

/* ---- 发布帖子 ---- */
function cpPublishPost(content, imgUrl, mood, authorType) {
  if (!cpCurrentSpace) return;
  const post = {
    id:         'post_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    authorType,
    content,
    imgUrl:     imgUrl || '',
    mood:       mood   || '',
    ts:         Date.now(),
    likes:      0,
    liked:      false,
    comments:   []
  };
  cpCurrentSpace.blog.posts.push(post);
  cpSaveSpace();

  if (cpCurrentTab === 'blog') cpRenderBlog();

  /* 发帖后触发粉丝评论 */
  setTimeout(() => cpTriggerFanComments(post.id), 2000 + Math.random() * 5000);

  /* 如果是用户发帖，角色也可能来评论 */
  if (authorType === 'user') {
    setTimeout(() => cpRoleCommentOnPost(post.id), 4000 + Math.random() * 8000);
  }
}

/* ---- AI 粉丝评论 ---- */
async function cpTriggerFanComments(postId) {
  const config = loadApiConfig();
  if (!config || !config.url) return;
  const model = loadApiModel();
  if (!model) return;

  const post = cpCurrentSpace && cpCurrentSpace.blog &&
               cpCurrentSpace.blog.posts.find(p => p.id === postId);
  if (!post) return;

  const fanCount = 2 + Math.floor(Math.random() * 3);
  const fans     = Array.from({ length: fanCount }, cpGenFan);

  const prompt =
    '一个博主发布了帖子：「' + post.content + '」。\n' +
    '以下粉丝要评论这篇帖子，请为每个粉丝生成一条评论。\n' +
    fans.map((f, i) => (i + 1) + '. ' + f.name + '（性格：' + f.personality + '）').join('\n') +
    '\n\n格式：每行一条，格式为：序号. 评论内容\n只输出评论，不输出其他内容。';

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

    const json = await res.json();
    const raw  = (json.choices?.[0]?.message?.content || '').trim();
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

    const p = cpCurrentSpace.blog.posts.find(x => x.id === postId);
    if (!p) return;
    if (!p.comments) p.comments = [];

    lines.forEach((line, i) => {
      const text = line.replace(/^\d+\.\s*/, '').trim();
      if (!text || i >= fans.length) return;
      p.comments.push({
        id:     'cmt_' + Date.now() + '_' + i,
        name:   fans[i].name,
        avatar: fans[i].avatar,
        text,
        ts:     Date.now()
      });
    });

    /* 粉丝数涨一点 */
    cpCurrentSpace.blog.fanCount =
      (cpCurrentSpace.blog.fanCount || 0) + Math.floor(Math.random() * 3) + 1;

    cpSaveSpace();
    if (cpCurrentTab === 'blog') cpRenderBlog();

  } catch (e) { /* 静默 */ }
}

/* ---- 角色评论用户帖子 ---- */
async function cpRoleCommentOnPost(postId) {
  const config = loadApiConfig();
  if (!config || !config.url) return;
  const model = loadApiModel();
  if (!model) return;

  const post = cpCurrentSpace && cpCurrentSpace.blog &&
               cpCurrentSpace.blog.posts.find(p => p.id === postId);
  if (!post) return;

  const roleName = cpGetRoleName(cpCurrentRole);
  const userName = cpGetUserName();

  const prompt =
    '你是' + roleName + '，' + (cpCurrentRole.setting || '') + '。\n' +
    userName + '在博客发了一篇帖子：「' + post.content + '」。\n' +
    '请你以' + roleName + '的身份评论这篇帖子，一句话，口语化，符合你的性格。\n' +
    '只输出评论内容本身。';

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

    const p = cpCurrentSpace.blog.posts.find(x => x.id === postId);
    if (!p) return;
    if (!p.comments) p.comments = [];

    p.comments.unshift({
      id:     'cmt_role_' + Date.now(),
      name:   roleName,
      avatar: cpGetRoleAvatar(cpCurrentRole),
      text:   content,
      ts:     Date.now()
    });

    cpSaveSpace();
    if (cpCurrentTab === 'blog') cpRenderBlog();

  } catch (e) { /* 静默 */ }
}

/* ---- 用户发评论 ---- */
function cpAddUserComment(postId, text) {
  if (!cpCurrentSpace) return;
  const p = cpCurrentSpace.blog.posts.find(x => x.id === postId);
  if (!p) return;
  if (!p.comments) p.comments = [];

  const userName   = cpGetUserName();
  const userAvatar = cpGetUserAvatar();

  p.comments.push({
    id:     'cmt_user_' + Date.now(),
    name:   userName,
    avatar: userAvatar,
    text,
    ts:     Date.now()
  });

  cpSaveSpace();
  if (cpCurrentTab === 'blog') cpRenderBlog();

  /* 角色可能回复评论 */
  setTimeout(() => cpRoleReplyComment(postId, text), 3000 + Math.random() * 6000);
}

/* ---- 角色回复用户评论 ---- */
async function cpRoleReplyComment(postId, userComment) {
  if (Math.random() > 0.6) return; /* 60% 概率回复 */
  const config = loadApiConfig();
  if (!config || !config.url) return;
  const model = loadApiModel();
  if (!model) return;

  const roleName = cpGetRoleName(cpCurrentRole);
  const userName = cpGetUserName();

  const prompt =
    '你是' + roleName + '，' + (cpCurrentRole.setting || '') + '。\n' +
    userName + '在博客评论区说：「' + userComment + '」。\n' +
    '请你回复这条评论，一句话，口语化，符合性格。只输出回复内容。';

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

    const p = cpCurrentSpace.blog.posts.find(x => x.id === postId);
    if (!p) return;

    /* 找用户最新那条评论加回复 */
    const userCmts = (p.comments || []).filter(c => c.name === userName);
    if (!userCmts.length) return;
    const lastCmt = userCmts[userCmts.length - 1];
    if (!lastCmt.reply) {
      lastCmt.reply     = content;
      lastCmt.replyName = roleName;
    }

    cpSaveSpace();
    if (cpCurrentTab === 'blog') cpRenderBlog();

  } catch (e) { /* 静默 */ }
}

/* ---- 角色自动发帖 ---- */
async function cpAutoPost() {
  const config = loadApiConfig();
  if (!config || !config.url) return;
  const model = loadApiModel();
  if (!model) return;
  if (!cpCurrentRole || !cpCurrentSpace) return;

  const roleName = cpGetRoleName(cpCurrentRole);
  const userName = cpGetUserName();

  const prompt =
    '你是' + roleName + '，' + (cpCurrentRole.setting || '') + '。\n' +
    '现在在你和' + userName + '共同的博客上发一篇帖子。\n' +
    '内容随意，可以是日常感受、心情、小事、对' + userName + '的想念等。\n' +
    '要求：不超过80字，口语化，自然真实，像随手发的朋友圈。\n' +
    '只输出帖子内容本身，不要加任何前缀或说明。';

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

    cpPublishPost(content, '', '', 'role');

  } catch (e) { /* 静默 */ }
}
