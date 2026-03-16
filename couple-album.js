/* ============================================================
   couple-album.js — 相册模块
   ============================================================ */

let cpAlbumCurrentCat = '全部';
let cpAlbumPreviewIdx = -1;

function cpRenderAlbum() {
  const panel = document.getElementById('couple-panel-album');
  if (!panel || !cpCurrentSpace) return;

  const photos = cpCurrentSpace.album.photos || [];
  const cats   = ['全部', ...new Set(photos.map(p => p.cat || '日常').filter(Boolean))];

  const catBtns = cats.map(c =>
    '<button class="cp-album-cat-btn' + (c === cpAlbumCurrentCat ? ' active' : '') +
    '" data-cat="' + escHtml(c) + '">' + escHtml(c) + '</button>'
  ).join('');

  const filtered = cpAlbumCurrentCat === '全部'
    ? photos
    : photos.filter(p => (p.cat || '日常') === cpAlbumCurrentCat);

  const gridItems = filtered.map((photo, idx) =>
    '<div class="cp-album-grid-item" data-idx="' + photos.indexOf(photo) + '">' +
      '<img class="cp-album-grid-img" src="' + escHtml(photo.url) +
        '" alt="" loading="lazy">' +
      '<div class="cp-album-grid-overlay">' +
        '<div class="cp-album-grid-note">' + escHtml(photo.note || '') + '</div>' +
      '</div>' +
    '</div>'
  ).join('');

  panel.innerHTML = `
    <div class="cp-album-header">
      <div>
        <div class="cp-album-header-title">ALBUM</div>
        <div class="cp-album-header-count">${photos.length} 张</div>
      </div>
      <button class="cp-album-add-btn" id="cp-album-add-btn">+ 添加</button>
    </div>
    <div class="cp-album-cats" id="cp-album-cats">${catBtns}</div>
    <div class="cp-album-grid" id="cp-album-grid">
      ${gridItems || '<div style="grid-column:1/-1;" class="cp-empty">还没有照片<br>添加第一张吧</div>'}
    </div>

    <!-- 大图预览 -->
    <div class="cp-album-preview-mask" id="cp-album-preview">
      <button class="cp-album-preview-close" id="cp-album-preview-close">×</button>
      <img class="cp-album-preview-img" id="cp-album-preview-img" src="" alt="">
      <div class="cp-album-preview-note" id="cp-album-preview-note"></div>
      <button class="cp-album-preview-del" id="cp-album-preview-del">删除</button>
    </div>
  `;

  /* 分类切换 */
  panel.querySelectorAll('.cp-album-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      cpAlbumCurrentCat = btn.dataset.cat;
      cpRenderAlbum();
    });
  });

  /* 点击图片预览 */
  panel.querySelectorAll('.cp-album-grid-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx   = parseInt(item.dataset.idx);
      const photo = photos[idx];
      if (!photo) return;
      cpAlbumPreviewIdx = idx;
      const mask = document.getElementById('cp-album-preview');
      document.getElementById('cp-album-preview-img').src  = photo.url;
      document.getElementById('cp-album-preview-note').textContent =
        (photo.note || '') + (photo.date ? '  ' + photo.date : '');
      mask.classList.add('show');
    });
  });

  /* 关闭预览 */
  document.getElementById('cp-album-preview-close') &&
  document.getElementById('cp-album-preview-close').addEventListener('click', () => {
    document.getElementById('cp-album-preview').classList.remove('show');
  });

  /* 删除图片 */
  document.getElementById('cp-album-preview-del') &&
  document.getElementById('cp-album-preview-del').addEventListener('click', () => {
    if (cpAlbumPreviewIdx < 0) return;
    if (!confirm('确定删除这张照片？')) return;
    cpCurrentSpace.album.photos.splice(cpAlbumPreviewIdx, 1);
    cpSaveSpace();
    document.getElementById('cp-album-preview').classList.remove('show');
    cpAlbumPreviewIdx = -1;
    cpRenderAlbum();
  });

  /* 添加图片 */
  document.getElementById('cp-album-add-btn') &&
  document.getElementById('cp-album-add-btn').addEventListener('click', cpOpenAlbumAddModal);
}

function cpOpenAlbumAddModal() {
  const existing = document.getElementById('cp-album-add-modal');
  if (existing) existing.remove();

  const mask = document.createElement('div');
  mask.id    = 'cp-album-add-modal';
  mask.className = 'cp-modal-mask show';
  mask.innerHTML = `
    <div class="cp-modal-box">
      <div class="cp-modal-title">添加照片</div>
      <label class="cp-modal-label">图片 URL</label>
      <input class="cp-modal-input" id="cp-album-url-input" placeholder="https://…">
      <div style="text-align:center;margin:4px 0;font-size:11px;color:#aaa;">或</div>
      <button class="cp-btn-ghost" id="cp-album-local-btn" style="width:100%;">本地选择</button>
      <input type="file" id="cp-album-file" accept="image/*" style="display:none;">
      <img id="cp-album-preview-thumb" style="display:none;width:100%;max-height:140px;
        object-fit:contain;border-radius:8px;margin:6px 0;" alt="">
      <label class="cp-modal-label">备注（可选）</label>
      <input class="cp-modal-input" id="cp-album-note" placeholder="写点什么…">
      <label class="cp-modal-label">分类</label>
      <input class="cp-modal-input" id="cp-album-cat" placeholder="日常、出行、纪念日…">
      <div class="cp-modal-btns">
        <button class="cp-btn-primary" id="cp-album-add-confirm">添加</button>
        <button class="cp-btn-ghost"   id="cp-album-add-cancel">取消</button>
      </div>
    </div>
  `;

  document.body.appendChild(mask);

  let pendingUrl = '';

  document.getElementById('cp-album-local-btn').addEventListener('click', () => {
    document.getElementById('cp-album-file').click();
  });

  document.getElementById('cp-album-file').addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      pendingUrl = e.target.result;
      const thumb = document.getElementById('cp-album-preview-thumb');
      thumb.src = pendingUrl; thumb.style.display = 'block';
      document.getElementById('cp-album-url-input').value = '';
    };
    reader.readAsDataURL(file);
    this.value = '';
  });

  document.getElementById('cp-album-url-input').addEventListener('input', function() {
    if (this.value.trim()) {
      pendingUrl = this.value.trim();
      const thumb = document.getElementById('cp-album-preview-thumb');
      thumb.src = pendingUrl; thumb.style.display = 'block';
    }
  });

  document.getElementById('cp-album-add-confirm').addEventListener('click', () => {
    const url  = pendingUrl || document.getElementById('cp-album-url-input').value.trim();
    const note = document.getElementById('cp-album-note').value.trim();
    const cat  = document.getElementById('cp-album-cat').value.trim() || '日常';
    if (!url) { alert('请输入或选择图片'); return; }

    if (!cpCurrentSpace.album) cpCurrentSpace.album = { photos: [] };
    cpCurrentSpace.album.photos.push({
      url,
      note,
      cat,
      date: cpFmtDate(Date.now()),
      ts:   Date.now()
    });
    cpSaveSpace();
    mask.remove();
    cpRenderAlbum();
  });

  document.getElementById('cp-album-add-cancel').addEventListener('click', () => mask.remove());
  mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
}
