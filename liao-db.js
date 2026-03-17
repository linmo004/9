/* ============================================================
   liao-db.js — 将大体积 liao 数据迁移到 IndexedDB
   ============================================================ */

(function () {
  'use strict';

  const BIG_KEYS = ['liao_suiyan', 'liao_roles', 'liao_chats', 'halo9_msgData', 'halo9_customIcons'];

  /* 直接用同一个 Dexie 实例，升级到 version 2 加 liaoData 表 */
  (async function migrate() {
    try {
      /* 重新声明带 liaoData 表的数据库，Dexie 会自动升级 */
      const db = new Dexie('Halo9Images');
      db.version(1).stores({ images: '&key' });
      db.version(2).stores({ images: '&key', liaoData: '&key' });
      await db.open();

      window._liaoDb = db;

      /* 把原来 _imgDB 的 images 表也指向新实例（兼容旧代码） */
      if (typeof window._imgDB === 'undefined') {
        window._imgDB = db;
      }

      /* 迁移大 key */
      for (const key of BIG_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          await db.liaoData.put({ key, val: raw });
          localStorage.removeItem(key);
          console.log('[liao-db] 迁移完成:', key, (raw.length / 1024).toFixed(1) + 'KB');
        } catch (e) {
          console.warn('[liao-db] 迁移失败:', key, e);
        }
      }

    } catch (e) {
      console.warn('[liao-db] 初始化失败，降级使用 localStorage', e);
    }
    window._liaoDataReady = true;
  })();

  async function liaoDbLoad(key, def) {
    try {
      if (window._liaoDb && window._liaoDb.liaoData) {
        const row = await window._liaoDb.liaoData.get(key);
        if (row) return JSON.parse(row.val);
      }
    } catch (e) {}
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : def;
    } catch (e) { return def; }
  }

  async function liaoDbSave(key, val) {
    const raw = JSON.stringify(val);
    try {
      if (window._liaoDb && window._liaoDb.liaoData) {
        await window._liaoDb.liaoData.put({ key, val: raw });
        return;
      }
    } catch (e) {}
    try { localStorage.setItem(key, raw); } catch (e) {}
  }

  window.liaoDbLoad = liaoDbLoad;
  window.liaoDbSave = liaoDbSave;
  window.LIAO_BIG_KEYS = BIG_KEYS;

})();
