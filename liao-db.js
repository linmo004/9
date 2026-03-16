/* ============================================================
   liao-db.js — 将大体积 liao 数据迁移到 IndexedDB
   在 liao-core.js 之后加载此文件
   ============================================================ */

(function () {
  'use strict';

  /* 需要迁移到 IndexedDB 的大 key */
  const BIG_KEYS = ['liao_suiyan', 'liao_roles', 'liao_chats', 'halo9_msgData', 'halo9_customIcons'];

  /* ── 专用 IndexedDB（复用 db-images.js 的 _imgDB） ── */
  /* 用同一个 Dexie 实例，新增一张表 liaoData */
  (async function migrate() {
    try {
      /* 升级数据库版本，增加 liaoData 表 */
      if (typeof _imgDB === 'undefined') return;

      /* 检查是否已有 liaoData 表，没有则升级 */
      if (!_imgDB.liaoData) {
        /* 关闭当前连接，重新以新版本打开 */
        _imgDB.close();
        const db = new Dexie('Halo9Images');
        db.version(1).stores({ images: '&key' });
        db.version(2).stores({ images: '&key', liaoData: '&key' });
        await db.open();

        /* 把新实例的方法挂到 window */
        window._liaoDb = db;
      } else {
        window._liaoDb = _imgDB;
      }

      /* ── 迁移：把 localStorage 里的大 key 搬到 IndexedDB ── */
      for (const key of BIG_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          /* 写入 IndexedDB */
          await window._liaoDb.liaoData.put({ key, val: raw });
          /* 从 localStorage 删除 */
          localStorage.removeItem(key);
          console.log('[liao-db] 迁移完成:', key, (raw.length / 1024).toFixed(1) + 'KB');
        } catch (e) {
          console.warn('[liao-db] 迁移失败:', key, e);
        }
      }

    } catch (e) {
      console.warn('[liao-db] 初始化失败，降级使用 localStorage', e);
    }
  })();

  /* ── 异步读取 ── */
  async function liaoDbLoad(key, def) {
    try {
      if (window._liaoDb && window._liaoDb.liaoData) {
        const row = await window._liaoDb.liaoData.get(key);
        if (row) return JSON.parse(row.val);
      }
    } catch (e) {}
    /* 降级到 localStorage */
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : def;
    } catch (e) { return def; }
  }

  /* ── 异步保存 ── */
  async function liaoDbSave(key, val) {
    const raw = JSON.stringify(val);
    try {
      if (window._liaoDb && window._liaoDb.liaoData) {
        await window._liaoDb.liaoData.put({ key, val: raw });
        return;
      }
    } catch (e) {}
    /* 降级到 localStorage */
    try { localStorage.setItem(key, raw); } catch (e) {}
  }

  window.liaoDbLoad = liaoDbLoad;
  window.liaoDbSave = liaoDbSave;
  window.LIAO_BIG_KEYS = BIG_KEYS;

})();
