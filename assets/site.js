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
