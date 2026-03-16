/* ============================================================
   couple-anniversary.js — 纪念日模块
   ============================================================ */

const CP_ANNIV_ICONS = ['❤️','🎂','✈️','🌸','🎉','🌙','⭐','🎵','🏠','💍'];

function cpRenderAnniversary() {
  const panel = document.getElementById('couple-panel-anniversary');
  if (!panel || !cpCurrentSpace) return;

  const items    = cpCurrentSpace.anniversary.items || [];
  const userName = cpGetUserName();
  const roleName = cpGetRoleName(cpCurrentRole);

  const cardsHtml = items.map((item, idx) => {
    const target = new Date(item.date); target.setHours(0,0,0,0);
    const today  = new Date();          today.setHours(0,0,0,0);
    const diff   = Math.round((target - today) / 86400000);
    const diffAbs = Math.abs(diff);
    const isCountdown = diff >= 0;

    return '<div class="cp-anniv-card">' +
      '<div class="cp-anniv-icon">' + (item.icon || '❤️') + '</div>' +
      '<div class="cp-anniv-info">' +
        '<div class="cp-anniv-name">' + escHtml(item.title) + '</div>' +
        '<div class="cp-anniv-date">' + escHtml(item.date) +
          (item.type === 'anniversary' ? ' · 纪念日' : ' · 倒计时') + '</div>' +
      '</div>' +
      '<div class="cp-anniv-days-block">' +
        '<div class="cp-anniv-days-num">' + diffAbs + '</div>' +
        '<div class="cp-anniv-days-label">' +
          (isCountdown ? '天后' : (item.type === 'anniversary' ? '天纪念' : '天前')) +
        '</div>' +
      '</div>' +
      '<button class="cp-anniv-del-btn" data-idx="' + idx + '">×</button>' +
    '</div>';
  }).join('');

  panel.innerHTML = `
    <div class="cp-anniv-header">
      <div>
        <div class="cp-anniv-header-title">纪念日</div>
        <div class="cp-anniv-header-sub">${escHtml(userName)} & ${escHtml(roleName)}</div>
      </div>
      <button class="cp-anniv-add-btn" id="cp-anniv-add-btn">+ 添加</button>
    </div>
    <div class="cp-anniv-list">
      ${cardsHtml || '<div class="cp-empty">还没有纪念日<br>添加第一个吧</div>'}
    </div>
  `;

  /* 删除 */
  panel.querySelectorAll('.cp-anniv-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      if (!confirm('确定删除？')) return;
      cpCurrentSpace.anniversary.items.splice(idx, 1);
      cpSaveSpace();
      cpRenderAnniversary();
    });
  });

  /* 添加 */
  document.getElementById('cp-anniv-add-btn') &&
  document.getElementById('cp-anniv-add-btn').addEventListener('click', cpOpenAnnivAddModal);
}

function cpOpenAnnivAddModal() {
  const existing = document.getElementById('cp-anniv-add-modal');
  if (existing) existing.remove();

  const iconBtns = CP_ANNIV_ICONS.map(icon =>
    '<button class="cp-pet-select-item" style="padding:8px;border-radius:10px;' +
    'background:#fff8e1;border:1.5px solid #ffe082;" data-icon="' + icon + '">' +
    '<span style="font-size:22px;">' + icon + '</span></button>'
  ).join('');

  const mask = document.createElement('div');
  mask.id    = 'cp-anniv-add-modal';
  mask.className = 'cp-modal-mask show';
  mask.innerHTML = `
    <div class="cp-modal-box">
      <div class="cp-modal-title">添加纪念日</div>
      <label class="cp-modal-label">标题</label>
      <input class="cp-modal-input" id="cp-anniv-title" placeholder="例如：在一起、生日…">
      <label class="cp-modal-label">日期</label>
      <input class="cp-modal-input" id="cp-anniv-date" type="date">
      <label class="cp-modal-label">类型</label>
      <select class="cp-modal-input" id="cp-anniv-type">
        <option value="anniversary">纪念日（计算已过天数）</option>
        <option value="countdown">倒计时（计算剩余天数）</option>
      </select>
      <label class="cp-modal-label">图标</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;" id="cp-anniv-icons">${iconBtns}</div>
      <div class="cp-modal-btns">
        <button class="cp-btn-primary" id="cp-anniv-add-confirm">添加</button>
        <button class="cp-btn-ghost"   id="cp-anniv-add-cancel">取消</button>
      </div>
    </div>
  `;

  document.body.appendChild(mask);

  let selectedIcon = '❤️';
  mask.querySelectorAll('[data-icon]').forEach(btn => {
    btn.addEventListener('click', () => {
      mask.querySelectorAll('[data-icon]').forEach(b =>
        b.style.borderColor = '#ffe082');
      btn.style.borderColor = '#f9a825';
      selectedIcon = btn.dataset.icon;
    });
  });

  document.getElementById('cp-anniv-add-confirm').addEventListener('click', () => {
    const title = (document.getElementById('cp-anniv-title').value || '').trim();
    const date  =  document.getElementById('cp-anniv-date').value;
    const type  =  document.getElementById('cp-anniv-type').value;
    if (!title || !date) { alert('请填写标题和日期'); return; }

    if (!cpCurrentSpace.anniversary)       cpCurrentSpace.anniversary       = { items: [] };
    if (!cpCurrentSpace.anniversary.items) cpCurrentSpace.anniversary.items = [];

    cpCurrentSpace.anniversary.items.push({ title, date, type, icon: selectedIcon });
    cpSaveSpace();
    mask.remove();
    cpRenderAnniversary();
  });

  document.getElementById('cp-anniv-add-cancel').addEventListener('click', () => mask.remove());
  mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
}
