/* ============================================================
   couple-home.js — 主页模块
   ============================================================ */

function cpRenderHome() {
  const panel = document.getElementById('couple-panel-home');
  if (!panel || !cpCurrentSpace) return;

  const userName   = cpGetUserName();
  const userAvatar = cpGetUserAvatar();
  const roleName   = cpGetRoleName(cpCurrentRole);
  const roleAvatar = cpGetRoleAvatar(cpCurrentRole);
  const days       = cpCalcTogetherDays();
  const home       = cpCurrentSpace.home;
  const radio      = cpCurrentSpace.radio;
  const annivItems = (cpCurrentSpace.anniversary && cpCurrentSpace.anniversary.items) || [];

  /* 最近3条纪念日 */
  const annivHtml = annivItems.slice(0, 3).map(item => {
    const target = new Date(item.date); target.setHours(0,0,0,0);
    const today  = new Date();          today.setHours(0,0,0,0);
    const diff   = Math.round((target - today) / 86400000);
    const label  = diff >= 0 ? diff + ' 天后' : Math.abs(diff) + ' 天前';
    return '<div class="cp-home-anniv-item">' +
      '<span class="cp-home-anniv-name">' + escHtml(item.title) + '</span>' +
      '<span class="cp-home-anniv-days">' + escHtml(label) + '</span>' +
      '</div>';
  }).join('');

  panel.innerHTML = `
    <div class="cp-home-banner">
      ${home.bannerUrl
        ? '<img class="cp-home-banner-bg" src="' + escHtml(home.bannerUrl) + '" alt="">'
        : '<div class="cp-home-banner-placeholder">🏠</div>'
      }
      <button class="cp-home-banner-edit" id="cp-home-banner-edit">更换背景</button>
    </div>

    <div class="cp-home-couple-row">
      <div class="cp-home-person">
        <div class="cp-home-avatar-wrap">
          <img class="cp-home-avatar" src="${escHtml(userAvatar)}" alt="">
        </div>
        <div class="cp-home-avatar-name">${escHtml(userName)}</div>
      </div>
      <div class="cp-home-heart">♥</div>
      <div class="cp-home-person">
        <div class="cp-home-avatar-wrap">
          <img class="cp-home-avatar" src="${escHtml(roleAvatar)}" alt="">
        </div>
        <div class="cp-home-avatar-name">${escHtml(roleName)}</div>
      </div>
    </div>

    <div class="cp-home-days-card">
      <div class="cp-home-days-label">IN LOVE</div>
      <div class="cp-home-days-number">${days}</div>
      <div class="cp-home-days-unit">天 · 在一起</div>
    </div>

    <div class="cp-home-quote-card" id="cp-home-quote-card">
      <div class="cp-home-quote-label">TODAY · 今日一句话</div>
      ${home.quote
        ? '<div class="cp-home-quote-text">' + escHtml(home.quote) + '</div>'
        : '<div class="cp-home-quote-placeholder">点击写下今天想说的话…</div>'
      }
    </div>

    <div class="cp-home-status-row">
      <div class="cp-home-status-card" id="cp-home-status-user">
        <div class="cp-home-status-who">${escHtml(userName)} 此刻</div>
        ${radio.userStatus
          ? '<div class="cp-home-status-text">' + escHtml(radio.userStatus) + '</div>'
          : '<div class="cp-home-status-empty">暂无状态</div>'
        }
      </div>
      <div class="cp-home-status-card" id="cp-home-status-role">
        <div class="cp-home-status-who">${escHtml(roleName)} 此刻</div>
        ${radio.roleStatus
          ? '<div class="cp-home-status-text">' + escHtml(radio.roleStatus) + '</div>'
          : '<div class="cp-home-status-empty">暂无状态</div>'
        }
      </div>
    </div>

    ${annivItems.length ? `
    <div class="cp-home-anniv-card">
      <div class="cp-home-anniv-title">近期纪念日</div>
      ${annivHtml}
    </div>` : ''}
  `;

  /* 事件绑定 */
  document.getElementById('cp-home-banner-edit') &&
  document.getElementById('cp-home-banner-edit').addEventListener('click', () => {
    const url = prompt('输入背景图片 URL', home.bannerUrl || '');
    if (url === null) return;
    cpCurrentSpace.home.bannerUrl = url.trim();
    cpSaveSpace();
    cpRenderHome();
  });

  document.getElementById('cp-home-quote-card') &&
  document.getElementById('cp-home-quote-card').addEventListener('click', () => {
    const val = prompt('写下今天想说的话', home.quote || '');
    if (val === null) return;
    cpCurrentSpace.home.quote = val.trim();
    cpSaveSpace();
    cpRenderHome();
  });

  /* 点击状态卡片跳转到电台 */
  document.getElementById('cp-home-status-user') &&
  document.getElementById('cp-home-status-user').addEventListener('click', () => {
    cpSwitchTab('radio');
  });

  document.getElementById('cp-home-status-role') &&
  document.getElementById('cp-home-status-role').addEventListener('click', () => {
    cpSwitchTab('radio');
  });
}
