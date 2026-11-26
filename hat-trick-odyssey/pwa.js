// Registers the service worker (offline play + home-screen install) and
// handles updates. Loaded from the <head> of index.html; independent of the
// game code. Does nothing on file:// or where service workers are missing.
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  if (!/^https?:$/.test(location.protocol)) return;
  if (/[?&]nosw=1\b/.test(location.search)) return;
  // While developing on localhost the cache would keep serving old files, so
  // the service worker is opt-in there: add ?sw=1 to test offline behaviour.
  var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (local && !/[?&]sw=1\b/.test(location.search)) return;

  var loadedAt = Date.now();
  var touched = false;
  var hadController = !!navigator.serviceWorker.controller;
  var refreshing = false;
  function markTouched() { touched = true; }
  addEventListener('pointerdown', markTouched, { capture: true, passive: true });
  addEventListener('touchstart', markTouched, { capture: true, passive: true });
  addEventListener('keydown', markTouched, { capture: true, passive: true });

  function reload() {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  }

  function showChip() {
    if (document.getElementById('pwa-update')) return;
    var b = document.createElement('button');
    b.id = 'pwa-update';
    b.type = 'button';
    b.textContent = 'New version ready — tap to refresh';
    b.style.cssText = 'position:fixed;z-index:50;left:50%;transform:translateX(-50%);' +
      'top:calc(env(safe-area-inset-top, 0px) + 8px);padding:8px 16px;border-radius:999px;' +
      'border:3px solid #241a3a;background:#ffe27a;color:#241a3a;font:700 14px ui-rounded,' +
      '"Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif;box-shadow:0 3px 0 #241a3a;' +
      'touch-action:manipulation;-webkit-tap-highlight-color:transparent;cursor:pointer;';
    function go(e) { e.preventDefault(); e.stopPropagation(); reload(); }
    b.addEventListener('click', go);
    b.addEventListener('touchend', go);
    (document.body || document.documentElement).appendChild(b);
  }

  // A new service worker has taken over this page (an update, not the very
  // first install). Fresh launch that nobody has touched yet: just refresh.
  // Mid-game: never yank the level away, offer a chip instead. Either way the
  // next launch runs the new version.
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!hadController) { hadController = true; return; }
    if (!touched && Date.now() - loadedAt < 8000) reload();
    else if (document.body) showChip();
    else addEventListener('DOMContentLoaded', showChip);
  });

  function register() {
    navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (reg) {
      // Home-screen apps can stay alive for days: look for updates whenever
      // the app comes back to the foreground.
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') reg.update().catch(function () {});
      });
    }).catch(function () { /* offline play is a bonus; the game still runs */ });
  }
  if (document.readyState === 'complete') register();
  else addEventListener('load', register);
})();
