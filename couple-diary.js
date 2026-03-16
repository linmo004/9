/* ============================================================
   couple-diary.js — 日记模块
   ============================================================ */

const CP_DIARY_MOODS = ['开心', '平静', '想你', '感动', '难过', '兴奋', '疲惫', '期待'];
let cpDiaryCalYear  = new Date().getFullYear();
let cpDiaryCalMonth = new Date().getMonth();

function cpRenderDiary() {
  const panel = document.getElementById('couple-panel-diary');
  if (!panel || !cpCurrentSpace) return;

  const entries  = cpCurrentSpace.diary.entries || [];
  const userName = cpGetUserName();
  const roleName = cpGetRoleName(cpCurrentRole);

  /* 找有日记的日期集合 */
  const entryDates = new Set(entries.map(e => e.date));

  panel.innerHTML = `
    <div class="cp-diary-header">
      <div>
        <div class="cp-diary-header-title">我们的日记</div>
        <div class="cp-diary-header-sub">${escHtml(userName)} & ${escHtml(roleName)}</div>
      </div>
      <button class="cp-diary-write-btn" id="cp-diary-write-btn">写日记</button>
    </div>
    <div class="cp-diary-calendar" id="cp-diary-calendar"></div>
    <div class="cp-diary-list" id="cp-diary-list"></div>
  `;

  cpRenderDiaryCalendar(entryDates);
  cpRenderDiaryList(entries);

  document.getElementById('cp-diary-write-btn') &&
  document.getElementById('cp-diary-write-btn').addEventListener('click', () => {
    cpOpenDiaryWriteModal();
  });
}

function cpRenderDiaryCalendar(entryDates) {
  const cal = document.getElementById('cp-diary-calendar');
  if (!cal) return;

  const today    = new Date();
  const year     = cpDiaryCalYear;
  const month    = cpDiaryCalMonth;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames  = ['1月','2月','3月','4月','5月','6月',
                       '7月','8月','9月','10月','11月','12月'];

  let calHtml =
    '<div class="cp-diary-cal-header">' +
      '<button class="cp-diary-cal-nav" id="cp-diary-cal-prev">‹</button>' +
      '<div class="cp-diary-cal-title">' + year + ' · ' + monthNames[month] + '</div>' +
      '<button class="cp-diary-cal-nav" id="cp-diary-cal-next">›</button>' +
    '</div>' +
    '<div class="cp-diary-cal-grid">' +
      ['日','一','二','三','四','五','六'].map(d =>
        '<div class="cp-diary-cal-weekday">' + d + '</div>'
      ).join('');

  /* 空白格 */
  for (let i = 0; i < firstDay; i++) {
    calHtml += '<div class="cp-diary-cal-day empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = year + '-' + String(month + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const isToday  = (today.getFullYear() === year && today.getMonth() === month &&
                      today.getDate() === d);
    const hasEntry = entryDates.has(dateStr);
    let cls = 'cp-diary-cal-day';
    if (isToday)  cls += ' today';
    if (hasEntry) cls += ' has-entry';
    calHtml += '<div class="' + cls + '" data-date="' + dateStr + '">' + d + '</div>';
  }

  calHtml += '</div>';
  cal.innerHTML = calHtml;

  cal.querySelector('#cp-diary-cal-prev') &&
  cal.querySelector('#cp-diary-cal-prev').addEventListener('click', () => {
    cpDiaryCalMonth--;
    if (cpDiaryCalMonth < 0) { cpDiaryCalMonth = 11; cpDiaryCalYear--; }
    cpRenderDiary();
  });

  cal.querySelector('#cp-diary-cal-next') &&
  cal.querySelector('#cp-diary-cal-next').addEventListener('click', () => {
    cpDiaryCalMonth++;
    if (cpDiaryCalMonth > 11) { cpDiaryCalMonth = 0; cpDiaryCalYear++; }
    cpRenderDiary();
  });

  /* 点击日期过滤 */
  cal.querySelectorAll('.cp-diary-cal-day[data-date]').forEach(day => {
    day.addEventListener('click', () => {
      const date    = day.dataset.date;
      const entries = cpCurrentSpace.diary.entries || [];
      const filtered = entries.filter(e => e.date === date);
      cpRenderDiaryList(filtered.length ? filtered : entries);
      cal.querySelectorAll('.cp-diary-cal-day').forEach(d => d.classList.remove('selected'));
      day.classList.add('selected');
    });
  });
}

function cpRenderDiaryList(entries) {
  const list = document.getElementById('cp-diary-list');
  if (!list) return;

  if (!entries || !entries.length) {
    list.innerHTML = '<div class="cp-empty">这天还没有日记</div>';
    return;
  }

  const userName   = cpGetUserName();
  const userAvatar = cpGetUserAvatar();
  const roleName   = cpGetRoleName(cpCurrentRole);
  const roleAvatar = cpGetRoleAvatar(cpCurrentRole);
  const today      = cpFmtDate(Date.now());

  list.innerHTML = [...entries].reverse().map(entry => {
    const isUser   = entry.author === userName;
    const avatar   = isUser ? userAvatar : roleAvatar;
    const isLocked = entry.locked && entry.date !== today;

    return '<div class="cp-diary-entry-card">' +
      '<div class="cp-diary-entry-header">' +
        '<img class="cp-diary-entry-avatar" src="' + escHtml(avatar) + '" alt="">' +
        '<div>' +
          '<div class="cp-diary-entry-author">' + escHtml(entry.author) + '</div>' +
          '<div class="cp-diary-entry-date">' + escHtml(entry.date) + '</div>' +
        '</div>' +
        (entry.mood ? '<div class="cp-diary-entry-mood">' + escHtml(entry.mood) + '</div>' : '') +
      '</div>' +
      (isLocked
        ? '<div class="cp-diary-entry-locked">🔒 已锁定</div>'
        : '<div class="cp-diary-entry-text">' + escHtml(entry.text || '') + '</div>'
      ) +
      (entry.imgUrl && !isLocked
        ? '<img class="cp-diary-entry-img" src="' + escHtml(entry.imgUrl) + '" alt="">'
        : '') +
    '</div>';
  }).join('');
}

function cpOpenDiaryWriteModal() {
  const todayStr = cpFmtDate(Date.now());
  const existing = document.getElementById('cp-diary-write-modal');
  if (existing) existing.remove();

  /* 检查今天是否已写 */
  const todayEntry = cpCurrentSpace.diary.entries &&
    cpCurrentSpace.diary.entries.find(e =>
      e.date === todayStr && e.author === cpGetUserName()
    );

  const mask = document.createElement('div');
  mask.id    = 'cp-diary-write-modal';
  mask.className = 'cp-modal-mask show';
  mask.innerHTML = `
    <div class="cp-modal-box">
      <div class="cp-modal-title">写日记 · ${todayStr}</div>
      ${todayEntry ? '<div style="font-size:12px;color:#f48fb1;text-align:center;">今天已写过，将追加一篇</div>' : ''}
      <label class="cp-modal-label">心情</label>
      <div class="cp-mood-tags" id="cp-diary-moods">
        ${CP_DIARY_MOODS.map(m =>
          '<button class="cp-mood-tag" data-mood="' + m + '">' + m + '</button>'
        ).join('')}
      </div>
      <label class="cp-modal-label">内容</label>
      <textarea class="cp-modal-textarea" id="cp-diary-text"
        placeholder="今天发生了什么…" style="min-height:120px;"></textarea>
      <label class="cp-modal-label">图片 URL（可选）</label>
      <input class="cp-modal-input" id="cp-diary-img" placeholder="https://…">
      <div class="cp-modal-btns">
        <button class="cp-btn-primary" id="cp-diary-save-btn">保存</button>
        <button class="cp-btn-ghost"   id="cp-diary-cancel-btn">取消</button>
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

  document.getElementById('cp-diary-save-btn').addEventListener('click', () => {
    const text   = (document.getElementById('cp-diary-text').value   || '').trim();
    const imgUrl = (document.getElementById('cp-diary-img').value    || '').trim();
    if (!text) { alert('请写点什么'); return; }

    if (!cpCurrentSpace.diary) cpCurrentSpace.diary = { entries: [] };
    if (!cpCurrentSpace.diary.entries) cpCurrentSpace.diary.entries = [];

    cpCurrentSpace.diary.entries.push({
      id:     'diary_' + Date.now(),
      author: cpGetUserName(),
      date:   todayStr,
      text,
      imgUrl: imgUrl || '',
      mood:   selectedMood,
      locked: false,
      ts:     Date.now()
    });

    cpSaveSpace();
    mask.remove();
    cpRenderDiary();

    /* 24小时后自动锁定 */
    setTimeout(() => {
      const entry = cpCurrentSpace && cpCurrentSpace.diary &&
        cpCurrentSpace.diary.entries &&
        cpCurrentSpace.diary.entries.find(e =>
          e.date === todayStr && e.author === cpGetUserName() && !e.locked
        );
      if (entry) {
        entry.locked = true;
        cpSaveSpace();
      }
    }, 24 * 60 * 60 * 1000);
  });

  document.getElementById('cp-diary-cancel-btn').addEventListener('click', () => mask.remove());
  mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
}

/* ---- 角色自动写日记 ---- */
async function cpAutoDiary() {
  const config = loadApiConfig();
  if (!config || !config.url) return;
  const model = loadApiModel();
  if (!model) return;
  if (!cpCurrentRole || !cpCurrentSpace) return;

  const todayStr = cpFmtDate(Date.now());
  const roleName = cpGetRoleName(cpCurrentRole);
  const userName = cpGetUserName();

  /* 检查今天角色是否已写 */
  const alreadyWrote = cpCurrentSpace.diary.entries &&
    cpCurrentSpace.diary.entries.some(e =>
      e.date === todayStr && e.author === roleName
    );
  if (alreadyWrote) return;

  /* 取最近用户日记作为上下文 */
  const recentUserDiary = (cpCurrentSpace.diary.entries || [])
    .filter(e => e.author === userName)
    .slice(-3)
    .map(e => e.date + '：' + e.text)
    .join('\n');

  const prompt =
    '你是' + roleName + '，' + (cpCurrentRole.setting || '') + '。\n' +
    '今天是' + todayStr + '，请以日记的形式写下你今天的所思所想。\n' +
    '你知道' + userName + '可以看到这篇日记。\n' +
    (recentUserDiary
      ? '\n' + userName + '最近的日记：\n' + recentUserDiary + '\n\n'
      : '') +
    '要求：100-200字，用第一人称，口语化，真实自然，可以提到' + userName + '。\n' +
    '只输出日记正文，不要加标题或日期。';

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

    if (!cpCurrentSpace.diary)         cpCurrentSpace.diary         = { entries: [] };
    if (!cpCurrentSpace.diary.entries) cpCurrentSpace.diary.entries = [];

    const moodOptions = CP_DIARY_MOODS;
    const randomMood  = moodOptions[Math.floor(Math.random() * moodOptions.length)];

    cpCurrentSpace.diary.entries.push({
      id:     'diary_role_' + Date.now(),
      author: roleName,
      date:   todayStr,
      text:   content,
      imgUrl: '',
      mood:   randomMood,
      locked: false,
      ts:     Date.now()
    });

    cpSaveSpace();
    if (cpCurrentTab === 'diary') cpRenderDiary();

  } catch (e) { /* 静默 */ }
}
