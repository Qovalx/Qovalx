/* QOVALX site behaviour. No dependencies. */
(function () {
 'use strict';
 var burger = document.querySelector('.burger');
 var drawer = document.querySelector('.drawer');
 var overlay = document.querySelector('.overlay');
 var closeBtn = document.querySelector('.drawer .close');
 if (!burger || !drawer || !overlay) return;
 function focusable() {
   return drawer.querySelectorAll('a[href], button:not([disabled])');
 }
 function open() {
   drawer.setAttribute('data-open', '');
   overlay.setAttribute('data-open', '');
   burger.setAttribute('aria-expanded', 'true');
   document.body.style.overflow = 'hidden';
   var f = focusable();
   if (f.length) f[0].focus();
   document.addEventListener('keydown', onKey);
 }
 function close() {
   drawer.removeAttribute('data-open');
   overlay.removeAttribute('data-open');
   burger.setAttribute('aria-expanded', 'false');
   document.body.style.overflow = '';
   document.removeEventListener('keydown', onKey);
   burger.focus();
 }
 function onKey(e) {
   if (e.key === 'Escape') { close(); return; }
   if (e.key !== 'Tab') return;
   var f = focusable();
   if (!f.length) return;
   var first = f[0], last = f[f.length - 1];
   if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
   else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
 }
 burger.addEventListener('click', function () {
   drawer.hasAttribute('data-open') ? close() : open();
 });
 overlay.addEventListener('click', close);
 if (closeBtn) closeBtn.addEventListener('click', close);
 drawer.addEventListener('click', function (e) {
   if (e.target.tagName === 'A') close();
 });
 /* Language selector: swaps the locale segment, keeps the rest of the path. */
 var sel = document.querySelector('select.lang');
 if (sel) {
   sel.addEventListener('change', function () {
     var parts = window.location.pathname.split('/').filter(Boolean);
     var codes = ['ar','en','ru','zh-Hans','fr','es','hi'];
     if (parts.length && codes.indexOf(parts[0]) !== -1) parts[0] = sel.value;
     else parts.unshift(sel.value);
     try { localStorage.setItem('qovalx-lang', sel.value); } catch (err) {}
     window.location.pathname = '/' + parts.join('/') + '/';
   });
 }
})();

/* Launch countdown. Its own scope, so it cannot be skipped by the block above.
   The target is a fixed instant with an explicit offset, so the remaining time
   is identical for every visitor whatever timezone their device is set to.
   The block ships hidden and is only revealed once a real value is in it, so
   there is no flash of zeros, and if this never runs nothing appears at all. */
(function () {
 'use strict';
 var cd = document.querySelector('[data-countdown]');
 if (!cd) return;
 var target = Date.parse(cd.getAttribute('data-target'));
 if (!target) return;

 var units = {};
 ['days', 'hours', 'minutes', 'seconds'].forEach(function (u) {
   units[u] = cd.querySelector('[data-cd="' + u + '"]');
 });
 if (!units.days || !units.hours || !units.minutes || !units.seconds) return;
 var head = cd.querySelector('.cd-hd');
 var list = cd.querySelector('.cd-units');
 var done = cd.querySelector('.cd-done');
 var timer;

 function pad(n) { return n < 10 ? '0' + n : String(n); }

 function render() {
   var left = target - Date.now();
   if (left <= 0) {
     /* Past the target: a written line rather than zeros or negatives. */
     if (head) head.hidden = true;
     if (list) list.hidden = true;
     if (done) done.hidden = false;
     cd.hidden = false;
     if (timer) { clearInterval(timer); timer = null; }
     return;
   }
   var s = Math.floor(left / 1000);
   units.days.textContent = pad(Math.floor(s / 86400));
   units.hours.textContent = pad(Math.floor(s / 3600) % 24);
   units.minutes.textContent = pad(Math.floor(s / 60) % 60);
   units.seconds.textContent = pad(s % 60);
   cd.hidden = false;
 }

 render();
 timer = setInterval(render, 1000);
})();
