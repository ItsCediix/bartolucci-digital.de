/* Legal pages: apply the saved / system theme before first paint (same logic as the boot script on the start page). */
(function () {
  var t = null;
  try { t = localStorage.getItem('bd-theme'); } catch (e) { /* private mode */ }
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
})();
