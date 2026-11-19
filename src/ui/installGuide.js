// "Install app" help sheet, used when the browser gives no install prompt (iOS Safari, in-app
// browsers, Samsung Internet, Chrome before it decides the app is installable, http on the LAN).
import { h, ICONS } from './dom.js';
import { S } from './strings.js';

/** platform: 'ios' | 'android' | 'desktop'. secure: false when opened over plain http (LAN dev URL). */
export function openInstallGuide({ platform, secure }) {
  const dlg = h('dialog', { class: 'sheet', 'aria-labelledby': 'install-t' });
  const close = () => dlg.close();
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  const steps = S.installSteps[platform] || S.installSteps.desktop;
  dlg.append(
    h('div', { class: 'sheet-head' }, h('h2', { id: 'install-t' }, S.install),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': S.close, onclick: close, html: ICONS.close })),
    h('div', { class: 'scale-body' },
      secure ? null : h('p', { class: 'notice-box' }, S.installNeedsHttps),
      h('ol', { class: 'steps' }, steps.map((s) => h('li', null, s))),
      h('p', { class: 'help' }, S.installAfter)));
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}
