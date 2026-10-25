/* Legal pages + /automatisierung: apply the saved theme before first paint (same logic as the boot script on
   the start page). Light is the default; the system preference is deliberately ignored for the initial state.
   Also marks <html class="js"> synchronously, so the CSS start states of reveal animations apply from the
   first paint (without JS the class is missing and everything is visible). */
(function () {
  document.documentElement.classList.add('js');
  var t = null;
  try { t = localStorage.getItem('bd-theme'); } catch (e) { /* private mode */ }
  document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
})();
