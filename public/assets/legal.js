/* Legal pages: apply the saved theme before first paint (same logic as the boot script on the start page).
   Light is the default; the system preference is deliberately ignored for the initial state. */
(function () {
  var t = null;
  try { t = localStorage.getItem('bd-theme'); } catch (e) { /* private mode */ }
  document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
})();
