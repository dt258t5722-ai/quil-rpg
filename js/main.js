if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=13', { updateViaCache: 'none' }).catch(() => {}));
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
window.addEventListener('DOMContentLoaded', () => QuilGame.boot());
