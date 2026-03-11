/* ============================================================
   liao-cardbook.js — 角色卡册
   ============================================================ */

(function () {

  let lcbCurrentPage   = 0;
  let lcbTotalPages    = 0;
  let lcbSelectedRole  = null;
  let lcbSelectedChatIdx = -1;

  const CARDS_PER_PAGE = 9;

  /* ── 入口：从角色库面板进入卡册 ── */
  function openCardBook() {
    const view = document.getElementById('liao-cardbook-view');
    if (!view) return;
    view.style.display = 'flex';
    showCover();
  }

  function closeCardBook() {
  const view = document.getElementById('liao-cardbook-view');
  if (view) view.style.display = 'none';
  hidePreview();
  /* 关闭卡册后不自动切换标签，由调用方决定 */
}


  /* ── 封面 ── */
  function showCover() {
    document.getElementById('liao-cardbook-cover').style.display = 'flex';
    document.getElementById('liao-cardbook-inner').style.display = 'none';
    const count = typeof liaoRoles !== 'undefined' ? liaoRoles.length : 0;
    const el    = document.getElementById('lcb-cover-count');
    if (el) el.textContent = count + ' 位角色';
  }

  function showInner() {
    document.getElementById('liao-cardbook-cover').style.display = 'none';
    const inner = document.getElementById('liao-cardbook-inner');
    inner.style.display = 'flex';
    lcbCurrentPage = 0;
    buildPages();
    renderPage(0, 'none');
  }

  /* ── 构建所有页 ── */
  function buildPages() {
    const wrap = document.getElementById('lcb-pages-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';

    const roles     = typeof liaoRoles !== 'undefined' ? liaoRoles : [];
    lcbTotalPages   = Math.max(1, Math.ceil(roles.length / CARDS_PER_PAGE));

    for (let p = 0; p < lcbTotalPages; p++) {
      const page = document.createElement('div');
      page.className    = 'lcb-page';
      page.dataset.page = p;

      const start = p * CARDS_PER_PAGE;
      const slice = roles.slice(start, start + CARDS_PER_PAGE);

      for (let i = 0; i < CARDS_PER_PAGE; i++) {
        const slot = document.createElement('div');
        const role = slice[i];

        if (role) {
          slot.className = 'lcb-slot';
          const imgSrc = role.cardImage || role.avatar ||
            'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=' +
            encodeURIComponent(role.nickname || role.id || i);

          const img       = document.createElement('img');
          img.className   = 'lcb-card-img';
          img.src         = imgSrc;
          img.alt         = '';
          img.draggable   = false;
          slot.appendChild(img);

          /* 点击抽卡 */
          const roleSnap = role;
          slot.addEventListener('click', () => openPreview(roleSnap));
        } else {
          slot.className = 'lcb-slot empty';
        }
        page.appendChild(slot);
      }
      wrap.appendChild(page);
    }

    updatePageIndicator();
    updatePageBtns();
  }

  /* ── 渲染指定页（带方向动画） ── */
  function renderPage(idx, direction) {
    const pages = document.querySelectorAll('#lcb-pages-wrap .lcb-page');
    pages.forEach(p => {
      p.classList.remove('active','slide-in-right','slide-in-left','slide-out-left','slide-out-right');
    });

    const target = document.querySelector('#lcb-pages-wrap .lcb-page[data-page="' + idx + '"]');
    if (!target) return;

    if (direction === 'next') {
      target.classList.add('active', 'slide-in-right');
    } else if (direction === 'prev') {
      target.classList.add('active', 'slide-in-left');
    } else {
      target.classList.add('active');
    }

    lcbCurrentPage = idx;
    updatePageIndicator();
    updatePageBtns();
  }

  function updatePageIndicator() {
    const el = document.getElementById('lcb-page-indicator');
    if (el) el.textContent = (lcbCurrentPage + 1) + ' / ' + lcbTotalPages;
  }

  function updatePageBtns() {
    const prev = document.getElementById('lcb-prev-page');
    const next = document.getElementById('lcb-next-page');
    if (prev) prev.disabled = lcbCurrentPage <= 0;
    if (next) next.disabled = lcbCurrentPage >= lcbTotalPages - 1;
  }

  /* ── 抽卡预览 ── */
  function openPreview(role) {
    lcbSelectedRole = role;
    const chats = typeof liaoChats !== 'undefined' ? liaoChats : [];
    lcbSelectedChatIdx = chats.findIndex(c => c.roleId === role.id);

    const imgSrc = role.cardImage || role.avatar ||
      'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=' +
      encodeURIComponent(role.nickname || role.id || '');

    const previewImg = document.getElementById('lcb-preview-img');
    if (previewImg) previewImg.src = imgSrc;

    /* 重启动画 */
    const card = document.getElementById('lcb-preview-card');
    if (card) {
      card.style.animation = 'none';
      card.offsetHeight;
      card.style.animation = '';
    }

    const preview = document.getElementById('lcb-card-preview');
    if (preview) preview.style.display = 'flex';
  }

  function hidePreview() {
    const preview = document.getElementById('lcb-card-preview');
    if (preview) preview.style.display = 'none';
    lcbSelectedRole     = null;
    lcbSelectedChatIdx  = -1;
  }

  /* ── 事件绑定 ── */
  function bindEvents() {
    /* 封面返回 */
    const coverBack = document.getElementById('lcb-cover-back');
    if (coverBack) coverBack.addEventListener('click', closeCardBook);

    /* 封面翻开 */
    const flipBtn = document.getElementById('lcb-cover-flip-btn');
    if (flipBtn) flipBtn.addEventListener('click', showInner);

    /* 内页返回封面 */
    const innerBack = document.getElementById('lcb-inner-back');
    if (innerBack) innerBack.addEventListener('click', showCover);

    /* 翻页 */
    const prevBtn = document.getElementById('lcb-prev-page');
    if (prevBtn) prevBtn.addEventListener('click', () => {
      if (lcbCurrentPage > 0) renderPage(lcbCurrentPage - 1, 'prev');
    });

    const nextBtn = document.getElementById('lcb-next-page');
    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (lcbCurrentPage < lcbTotalPages - 1) renderPage(lcbCurrentPage + 1, 'next');
    });

    /* 预览关闭（放回） */
    const closeBtn = document.getElementById('lcb-preview-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', hidePreview);

    /* 预览背景点击关闭 */
    const backdrop = document.getElementById('lcb-preview-backdrop');
    if (backdrop) backdrop.addEventListener('click', hidePreview);

    /* 进入聊天设置 */
    const chatBtn = document.getElementById('lcb-preview-chat-btn');
    if (chatBtn) chatBtn.addEventListener('click', () => {
      if (!lcbSelectedRole) return;
      hidePreview();
      closeCardBook();

      /* 跳转到聊天设置 */
      if (lcbSelectedChatIdx >= 0) {
        if (typeof currentChatIdx !== 'undefined') {
          currentChatIdx = lcbSelectedChatIdx;
        }
        const csCloseBtn = document.getElementById('cs-close-btn');
        if (csCloseBtn) csCloseBtn.dataset.returnTo = 'rolelib';
        if (typeof openChatSettings === 'function') openChatSettings();
      } else {
        alert('该角色暂无聊天记录，请先在聊天列表中与其建立对话');
      }
    });
  }

  /* ── 暴露入口 ── */
  window.LiaoCardBook = { open: openCardBook, close: closeCardBook };

  /* DOM 就绪后绑定 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

})();
