(function () {
  'use strict';

  if (window.__fieldKitUnifiedShell) return;
  window.__fieldKitUnifiedShell = true;

  const currentScript = document.currentScript;
  const scriptURL = currentScript && currentScript.src
    ? new URL(currentScript.src, window.location.href)
    : new URL('shared/fieldkit-shell.js', document.baseURI);
  const rootURL = new URL('../', scriptURL);

  function installResponsiveStyles() {
    if (document.getElementById('fieldkitShellResponsiveStyle')) return;
    const style = document.createElement('style');
    style.id = 'fieldkitShellResponsiveStyle';
    style.textContent = `
      @media (max-width: 700px) {
        .fk-shell-link span:first-child { display: inline !important; }
        .fk-shell-link span:last-child,
        .fk-shell-action-label { display: none !important; }
        .fk-shell-icon-action { width: 36px; min-width: 36px; padding: 0 !important; }
        .fk-shell-right { justify-content: flex-end !important; }
        .fk-shell-status { margin-right: auto; font-size: .68rem !important; }
      }
      @media (max-width: 430px) {
        .fk-shell-header { padding: 8px 10px !important; gap: 7px !important; }
        .fk-shell-left { gap: 8px !important; }
        .fk-shell-logo { width: 30px !important; height: 30px !important; }
        .fk-shell-product { display: none; }
        .fk-shell-app { margin-top: 0 !important; font-size: .88rem !important; max-width: 48vw; }
        .fk-shell-status-label { display: none; }
        .fk-shell-status { width: 34px; min-width: 34px; padding: 0 !important; justify-content: center; }
      }
    `;
    document.head.appendChild(style);
  }

  function titleFromSlug(slug) {
    return String(slug || 'FieldKit App')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, function (char) { return char.toUpperCase(); });
  }

  function getAppName() {
    const explicit = document.querySelector('meta[name="fieldkit-app-name"]');
    if (explicit && explicit.content) return explicit.content.trim();

    const heading = document.querySelector('h1');
    if (heading && heading.textContent.trim() && heading.textContent.trim().length < 70) {
      return heading.textContent.trim();
    }

    const cleanTitle = String(document.title || '')
      .replace(/\s*[|·—-]\s*FieldKit\s*$/i, '')
      .replace(/^FieldKit\s*[|·—-]\s*/i, '')
      .trim();
    if (cleanTitle && cleanTitle.toLowerCase() !== 'fieldkit') return cleanTitle;

    const parts = window.location.pathname.split('/').filter(Boolean);
    const slug = parts[parts.length - 1] === 'index.html' ? parts[parts.length - 2] : parts[parts.length - 1];
    return titleFromSlug(slug);
  }

  function launcherURL() {
    return new URL('index.html', rootURL).toString();
  }

  function showToast(message) {
    let toast = document.querySelector('.fk-shell-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'fk-shell-toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2400);
  }

  function createShell() {
    if (!document.body || document.querySelector('.fk-shell-header')) return;

    installResponsiveStyles();
    document.body.classList.add('fieldkit-app-shell');

    // The canonical shell replaces all legacy app-level navigation. Removing
    // rather than hiding it also prevents old headers from consuming viewport.
    document.querySelectorAll('.suite-nav, .s-header').forEach(function (nav) {
      nav.remove();
    });

    const header = document.createElement('header');
    header.className = 'fk-shell-header';
    header.innerHTML = `
      <div class="fk-shell-left">
        <a class="fk-shell-link" href="${launcherURL()}" aria-label="Back to FieldKit lobby">
          <span aria-hidden="true">←</span><span>Lobby</span>
        </a>
        <div class="fk-shell-brand">
          <div class="fk-shell-logo" aria-hidden="true">FK</div>
          <div class="fk-shell-titles">
            <div class="fk-shell-product">FieldKit</div>
            <div class="fk-shell-app"></div>
          </div>
        </div>
      </div>
      <div class="fk-shell-right">
        <div class="fk-shell-status" id="fkConnectivity" aria-live="polite">
          <span class="fk-shell-status-dot" aria-hidden="true"></span>
          <span class="fk-shell-status-label"></span>
        </div>
        <button class="fk-shell-button fk-shell-icon-action" id="fkShellPrivacy" type="button" data-open-privacy="1" title="Privacy settings" aria-label="Privacy settings"><span aria-hidden="true">◉</span><span class="fk-shell-action-label">Privacy</span></button>
        <button class="fk-shell-button fk-shell-icon-action" id="fkShellHelp" type="button" title="Help (F1)" aria-label="Help"><span aria-hidden="true">?</span><span class="fk-shell-action-label">Help</span></button>
      </div>`;

    header.querySelector('.fk-shell-app').textContent = getAppName();
    document.body.prepend(header);

    const status = header.querySelector('#fkConnectivity');
    const label = status.querySelector('.fk-shell-status-label');

    function updateConnectivity() {
      const online = navigator.onLine;
      status.classList.toggle('is-offline', !online);
      label.textContent = online ? 'ONLINE · OFFLINE READY' : 'AIRPLANE MODE';
      status.title = online
        ? 'Connected. This FieldKit app can continue using its offline features.'
        : 'No network connection. Local FieldKit features remain available.';
    }

    updateConnectivity();
    window.addEventListener('online', function () {
      updateConnectivity();
      showToast('Connection restored. FieldKit is online.');
    });
    window.addEventListener('offline', function () {
      updateConnectivity();
      showToast('Airplane mode: local tools remain available.');
    });

    function openHelp() {
      if (typeof window.openHelp === 'function') {
        window.openHelp();
        return;
      }
      const localHelp = document.querySelector('[data-help], #helpButton, #helpBtn, .help-button, .suite-help-link');
      if (localHelp) {
        localHelp.click();
        return;
      }
      window.location.href = new URL('help/index.html', rootURL).toString();
    }

    header.querySelector('#fkShellHelp').addEventListener('click', openHelp);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'F1') {
        event.preventDefault();
        openHelp();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createShell, { once: true });
  } else {
    createShell();
  }
})();
