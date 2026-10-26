// Per-frame recorder for the live Firefox (test/live): scroll position, page height and every tracked element whose place in the
// document changes in a frame (fixed and sticky things are judged by their place on screen). Read back with window.__rec.
(() => {
  if (window.__rec) { window.__rec.frames.length = 0; window.__rec.events.length = 0; window.__rec.moves.length = 0; return 'reset'; }
  const desc = (n) => {
    if (!n || n.nodeType !== 1) return n ? n.nodeName : '?';
    const c = typeof n.className === 'string' ? n.className.trim().split(/\s+/).filter((x) => x.startsWith('kex-')).slice(0, 2).join('.') : '';
    const t = n.dataset && (n.dataset.kexTest || n.dataset.kexTopic || n.dataset.kexBartopic || n.dataset.kexRow || n.dataset.kexGroup);
    return n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (c ? '.' + c : '') + (t ? '[' + t + ']' : '');
  };
  const rec = (window.__rec = { frames: [], events: [], moves: [] });
  const log = (type, extra) => rec.events.push({ t: Math.round(performance.now()), type, ...extra });
  for (const ev of ['wheel', 'pointerdown', 'click', 'keydown', 'hashchange', 'popstate']) {
    window.addEventListener(ev, (e) => log(ev, { target: desc(e.target) }), { capture: true, passive: true });
  }
  const pinned = new WeakMap();
  const isPinned = (el) => {
    if (pinned.has(el)) return pinned.get(el);
    let p = false;
    for (let n = el; n && n !== document.body; n = n.parentElement) { const pos = getComputedStyle(n).position; if (pos === 'fixed' || pos === 'sticky') { p = true; break; } }
    pinned.set(el, p);
    return p;
  };
  // Something moving while it is invisible (a list faded out through a change of shape) is not seen moving.
  const seen = (el) => {
    let o = 1;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
    return o > 0.05;
  };
  const SEL = '#kex-main > *, .kex-content > *, .kex-book__pages > *, .kex-tsec__head, .kex-outline, .kex-detail > *, .kex-rows > li, .kex-groupcard, .kex-labs > *, .kex-mc, .kex-mc-grid > *, .kex-notice, .kex-band, .kex-hero, .kex-header, .kex-sidebar, .kex-sb__course, h1, h2, h3, .kex-topic, .kex-cbar, .kex-tabs, .kex-crumbs';
  let prev = new Map();
  const f = () => {
    const now = Math.round(performance.now());
    const y = scrollY;
    const h = document.documentElement.scrollHeight;
    const ghost = document.querySelectorAll('.kex-transition-ghost').length;
    rec.frames.push({ t: now, y: Math.round(y), h, ghost });
    const next = new Map();
    const vh = innerHeight;
    for (const el of document.querySelectorAll(SEL)) {
      if (el.closest('.kex-transition-ghost, [aria-hidden="true"][inert]')) continue;
      const r = el.getBoundingClientRect();
      if (r.height === 0 && r.width === 0) continue;
      const fixed = isPinned(el);
      const pos = fixed ? r.top : r.top + y;
      next.set(el, [pos, r.left, r.height, r.width]);
      const p = prev.get(el);
      if (!p) continue;
      const onScreen = r.bottom > 0 && r.top < vh;
      // A move in the page (a layout shift): what moved by itself. Scrolling moves everything alike and is judged on its own (frames).
      const dy = pos - p[0];
      const dx = r.left - p[1];
      if (onScreen && (Math.abs(dy) > 2 || Math.abs(dx) > 2) && seen(el)) rec.moves.push({ t: now, el: desc(el), dy: Math.round(dy), dx: Math.round(dx), top: Math.round(r.top), anim: el.getAnimations ? el.getAnimations().length : 0 });
    }
    prev = next;
    if (rec.frames.length < 20000) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
  return 'ok';
})();
