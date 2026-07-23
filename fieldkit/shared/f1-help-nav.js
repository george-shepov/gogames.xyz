(function () {
  'use strict';

  function resolveSharedAsset(path) {
    const currentScript = document.currentScript;
    const scriptURL = currentScript && currentScript.src
      ? new URL(currentScript.src, window.location.href)
      : new URL('shared/f1-help-nav.js', document.baseURI);
    const sharedRootURL = new URL('./', scriptURL);
    const normalized = String(path || '').replace(/^\/+/, '');
    return new URL(normalized, sharedRootURL).toString();
  }

  (function ensureDriverLicenseDataFix() {
    const path = window.location.pathname.replace(/\\/g, '/').toLowerCase();
    if (!path.includes('/drivers-license/')) return;
    if (document.getElementById('driverLicenseDataFixScript')) return;
    const script = document.createElement('script');
    script.id = 'driverLicenseDataFixScript';
    script.src = resolveSharedAsset('../drivers-license/driver-license-data-fix.js');
    script.async = false;
    document.head.appendChild(script);
  })();

  (function ensurePrivacyMode() {
    if (window.__suitePrivacyInit) return;
    if (document.getElementById('suitePrivacyModeScript')) return;
    const script = document.createElement('script');
    script.id = 'suitePrivacyModeScript';
    script.src = resolveSharedAsset('privacy-mode.js');
    script.defer = true;
    document.head.appendChild(script);
  })();

  (function ensurePWAInit() {
    if (window.__suitePWAInit) return;
    if (document.getElementById('suitePwaInitScript')) return;
    const script = document.createElement('script');
    script.id = 'suitePwaInitScript';
    script.src = resolveSharedAsset('pwa-init.js');
    script.defer = true;
    document.head.appendChild(script);
  })();

  (function ensureUITweaksInit() {
    if (window.FieldKitUITweaks) return;
    if (document.getElementById('suiteUiTweaksScript')) return;
    const script = document.createElement('script');
    script.id = 'suiteUiTweaksScript';
    script.src = resolveSharedAsset('ui-tweaks-runtime.js');
    script.defer = true;
    document.head.appendChild(script);
  })();

  if (window.__suiteF1Bound) return;
  window.__suiteF1Bound = true;

  const fallback = {
    title: document.title || 'App',
    about: 'Main workflow is available in this app.',
    operations: ['Use the app controls to perform the core workflow.'],
    keys: ['No dedicated keyboard shortcuts documented.'],
    commands: ['No command palette documented.'],
    scenarios: ["Complete the app's primary task flow."]
  };

  function detectAppKey() {
    if (typeof window.SUITE_APP_KEY === 'string' && window.SUITE_APP_KEY.trim()) {
      return window.SUITE_APP_KEY.trim().toLowerCase();
    }
    const bodyKey = document.body && document.body.dataset && document.body.dataset.appKey;
    if (typeof bodyKey === 'string' && bodyKey.trim()) {
      return bodyKey.trim().toLowerCase();
    }
    const path = window.location.pathname.replace(/\\/g, '/');
    const parts = path.split('/').filter(Boolean);
    if (!parts.length) return '';
    const tail = parts[parts.length - 1].toLowerCase();
    if (tail.endsWith('.html')) return parts[parts.length - 2] || '';
    return parts[parts.length - 1] || '';
  }

  function getHelp(appKey) {
    const db = window.SUITE_HELP_CONTENT && window.SUITE_HELP_CONTENT.apps;
    if (db && db[appKey]) return db[appKey];
    return fallback;
  }

  function installStyles() {
    if (document.getElementById('suiteAppHelpStyle')) return;
    const style = document.createElement('style');
    style.id = 'suiteAppHelpStyle';
    style.textContent = [
      '.suite-help-link{position:fixed;right:16px;bottom:16px;z-index:2147483600;border:1px solid #35506a;background:#0f2334;color:#e6f0fa;padding:8px 12px;border-radius:999px;font:600 13px/1.2 system-ui,-apple-system,sans-serif;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.35)}',
      '.suite-help-link:hover{background:#143149}',
      '.suite-help-mask{position:fixed;inset:0;z-index:2147483601;background:rgba(3,9,16,.78);display:none;align-items:flex-start;justify-content:center;padding:16px;overflow:auto}',
      '.suite-help-mask.open{display:flex}',
      '.suite-help-panel{width:min(760px,100%);border:1px solid #35506a;border-radius:14px;background:#0d1a27;color:#e6f0fa;box-shadow:0 20px 56px rgba(0,0,0,.45)}',
      '.suite-help-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 14px 10px;border-bottom:1px solid #25384b}',
      '.suite-help-head h2{margin:0;font:700 18px/1.25 system-ui,-apple-system,sans-serif}',
      '.suite-help-close{border:1px solid #35506a;background:#132739;color:#dce9f6;border-radius:8px;padding:6px 10px;font:600 12px/1.2 system-ui,-apple-system,sans-serif;cursor:pointer}',
      '.suite-help-close:hover{background:#1c354d}',
      '.suite-help-body{padding:12px 14px 14px;font:14px/1.5 system-ui,-apple-system,sans-serif}',
      '.suite-help-about{margin:0 0 10px;color:#d8e8f7}',
      '.suite-help-sec{border:1px solid #274259;border-radius:10px;background:#102232;margin-top:9px;overflow:hidden}',
      '.suite-help-sec h3{margin:0;padding:8px 10px;background:#123248;border-bottom:1px solid #274259;color:#dcefff;font:700 12px/1.1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.2px}',
      '.suite-help-sec ul{margin:0;padding:10px 14px}',
      '.suite-help-sec li{margin-left:14px;margin-bottom:6px;color:#d2e5f7;line-height:1.45}',
      '.suite-help-sec li:last-child{margin-bottom:0}',
      '.suite-help-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}',
      '.suite-help-btn{display:inline-block;border:1px solid #35506a;background:#10283b;color:#deedf9;border-radius:8px;padding:7px 10px;text-decoration:none;font:600 12px/1.2 system-ui,-apple-system,sans-serif}',
      '.suite-help-btn:hover{background:#17344c}'
    ].join('');
    document.head.appendChild(style);
  }

  function toList(items) {
    const rows = (items && items.length ? items : ['No details yet.'])
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join('');
    return `<ul>${rows}</ul>`;
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function buildHelp() {
    const appKey = detectAppKey();
    const meta = getHelp(appKey);
    const useFloatingTrigger = !document.querySelector('[data-fieldkit-unified-shell], .fk-shell-header');

    const trigger = document.createElement('a');
    trigger.href = '#';
    trigger.className = 'suite-help-link';
    trigger.id = 'suiteHelpLink';
    trigger.textContent = '? Help';

    const mask = document.createElement('div');
    mask.className = 'suite-help-mask';
    mask.id = 'suiteHelpMask';
    mask.setAttribute('aria-hidden', 'true');
    mask.innerHTML = [
      '<div class="suite-help-panel" role="dialog" aria-modal="true" aria-label="App help">',
      '  <div class="suite-help-head">',
      `    <h2>${escapeHtml(meta.title || appKey || 'App')} Help</h2>`,
      '    <button class="suite-help-close" id="suiteHelpClose" type="button">Close</button>',
      '  </div>',
      '  <div class="suite-help-body">',
      `    <p class="suite-help-about">${escapeHtml(meta.about || fallback.about)}</p>`,
      `    <section class="suite-help-sec"><h3>Basic Operations</h3>${toList(meta.operations)}</section>`,
      `    <section class="suite-help-sec"><h3>Keys</h3>${toList(meta.keys)}</section>`,
      `    <section class="suite-help-sec"><h3>Commands</h3>${toList(meta.commands)}</section>`,
      `    <section class="suite-help-sec"><h3>Scenarios</h3>${toList(meta.scenarios)}</section>`,
      '    <div class="suite-help-actions">',
      `      <a class="suite-help-btn" href="../help/index.html?app=${encodeURIComponent(appKey)}">Open Full Help Page</a>`,
      '      <a class="suite-help-btn" href="../index.html?help=1">Suite Help</a>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');

    function openHelp() {
      mask.classList.add('open');
      mask.setAttribute('aria-hidden', 'false');
    }

    function closeHelp() {
      mask.classList.remove('open');
      mask.setAttribute('aria-hidden', 'true');
    }

    window.openHelp = openHelp;

    if (useFloatingTrigger) {
      trigger.addEventListener('click', function (event) {
        event.preventDefault();
        openHelp();
      });
      document.body.appendChild(trigger);
    }

    mask.addEventListener('click', function (event) {
      if (event.target === mask) closeHelp();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'F1') {
        event.preventDefault();
        openHelp();
      }
      if (event.key === 'Escape') closeHelp();
    });

    document.body.appendChild(mask);
    const closeBtn = document.getElementById('suiteHelpClose');
    if (closeBtn) closeBtn.addEventListener('click', closeHelp);
  }

  installStyles();
  buildHelp();
})();
