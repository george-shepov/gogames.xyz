(function () {
  'use strict';

  if (window.__fieldKitLauncherExplorer) return;
  window.__fieldKitLauncherExplorer = true;

  const FAVORITES_KEY = 'suite_favorite_apps_v1';
  const RECENT_KEY = 'suite_recent_apps_v1';
  const VIEW_KEY = 'fieldkit_launcher_view_v2';
  const SELECTED_KEY = 'fieldkit_launcher_selected_v1';
  const VALID_VIEWS = ['list', 'cards', 'atlas'];

  const state = {
    view: loadString(VIEW_KEY, 'list'),
    query: '',
    selectedTags: new Set(),
    favoritesOnly: false,
    selectedKey: loadString(SELECTED_KEY, ''),
    apps: []
  };

  if (!VALID_VIEWS.includes(state.view)) state.view = 'list';

  function loadString(key, fallback) {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function saveString(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_error) {}
  }

  function loadMap(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (_error) {
      return {};
    }
  }

  function saveMap(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {}
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function cleanCategoryTitle(value) {
    return String(value || 'Other')
      .replace(/^[^\p{L}\p{N}]+/u, '')
      .trim() || 'Other';
  }

  function appHref(app) {
    try {
      if (typeof toAppHref === 'function') return toAppHref(app);
    } catch (_error) {}
    if (app.path) return app.path;
    return `${app.key}/index.html`;
  }

  function getConnectivity(app) {
    const offline = String(app.offline || '').toLowerCase();
    const connected = offline === 'hybrid' || offline === 'wifi' || offline === 'online' || offline === 'network' || app.offline === false;
    return connected
      ? { key: 'connected', label: 'Wi-Fi / Cell', short: '⌁', title: 'Uses network features and can include local features' }
      : { key: 'offline', label: 'Airplane Mode', short: '✈', title: 'Designed to work without a network connection' };
  }

  function getAccess(app) {
    if (app.demo) return { key: 'demo', label: 'Demo', short: 'D' };
    if (app.free) return { key: 'free', label: 'Free', short: '$0' };
    return { key: 'full', label: 'Full', short: '✓' };
  }

  function getHelp(app) {
    try {
      if (typeof APP_HELP !== 'undefined' && APP_HELP && APP_HELP[app.key]) return APP_HELP[app.key];
    } catch (_error) {}
    return {
      feature: app.desc || 'Open the app to use its main workflow.',
      scenario: 'Select the app to view its available workflow.'
    };
  }

  const keywordTags = [
    ['AI', /\b(ai|assistant|caption|recommendation|model)\b/i],
    ['Audio', /\b(audio|voice|music|midi|ear|speak|sound)\b/i],
    ['Camera', /\b(camera|photo|image|video|capture|record)\b/i],
    ['Code', /\b(code|javascript|linux|terminal|developer|snippet|sql|database)\b/i],
    ['Documents', /\b(document|library|record|docket|receipt|notes?)\b/i],
    ['Emergency', /\b(emergency|sos|first aid|cpr|safety|authority)\b/i],
    ['Finance', /\b(tax|expense|inventory|money|receipt|price)\b/i],
    ['Games', /\b(game|tic-tac-toe|snake|battleship|reversi|chess|checkers|arcade)\b/i],
    ['Legal', /\b(legal|court|docket|authority|consent)\b/i],
    ['Offline', /\b(offline|airplane|device-only|local)\b/i],
    ['Productivity', /\b(productivity|kanban|pomodoro|habit|time tracker|wishlist|workflow)\b/i],
    ['Training', /\b(train|practice|study|quiz|flashcard|learn|academy|interview|skill)\b/i]
  ];

  function deriveTags(app, category, help, connectivity, access) {
    const tags = new Set([category, connectivity.label, access.label]);
    const corpus = [app.name, app.desc, help.feature, help.scenario, category].join(' ');
    keywordTags.forEach(([tag, expression]) => {
      if (expression.test(corpus)) tags.add(tag);
    });
    return Array.from(tags);
  }

  function collectApps() {
    const output = [];
    if (typeof APP_REGISTRY === 'undefined' || !APP_REGISTRY) return output;

    Object.entries(APP_REGISTRY).forEach(([categoryKey, category]) => {
      const categoryTitle = cleanCategoryTitle(category.title || categoryKey);
      Object.entries(category.apps || {}).forEach(([key, raw]) => {
        const app = { key, ...raw };
        const help = getHelp(app);
        const connectivity = getConnectivity(app);
        const access = getAccess(app);
        output.push({
          ...app,
          categoryKey,
          categoryTitle,
          help,
          connectivity,
          access,
          tags: deriveTags(app, categoryTitle, help, connectivity, access),
          href: appHref(app)
        });
      });
    });

    return output.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  function isFavorite(key) {
    return Boolean(loadMap(FAVORITES_KEY)[key]);
  }

  function toggleFavorite(key) {
    const favorites = loadMap(FAVORITES_KEY);
    if (favorites[key]) delete favorites[key];
    else favorites[key] = true;
    saveMap(FAVORITES_KEY, favorites);
    window.dispatchEvent(new CustomEvent('fieldkit-favorites-changed', {
      detail: { key, favorite: Boolean(favorites[key]) }
    }));
  }

  function markRecent(key) {
    const recent = loadMap(RECENT_KEY);
    recent[key] = Date.now();
    saveMap(RECENT_KEY, recent);
  }

  function searchableText(app) {
    return [
      app.name,
      app.desc,
      app.categoryTitle,
      app.connectivity.label,
      app.access.label,
      app.help.feature,
      app.help.scenario,
      app.tags.join(' ')
    ].join(' ').toLowerCase();
  }

  function visibleApps() {
    const query = state.query.trim().toLowerCase();
    return state.apps.filter((app) => {
      if (state.favoritesOnly && !isFavorite(app.key)) return false;
      if (query && !searchableText(app).includes(query)) return false;
      for (const tag of state.selectedTags) {
        if (!app.tags.includes(tag)) return false;
      }
      return true;
    });
  }

  function tagCounts(apps) {
    const counts = new Map();
    apps.forEach((app) => {
      app.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  function iconMarkup(app, sizeClass) {
    return `<span class="fk-app-icon ${sizeClass || ''}"><img src="shared/icons/${escapeHtml(app.icon || 'box.svg')}" alt="" aria-hidden="true" onerror="this.style.display='none'"></span>`;
  }

  function metaBadge(kind, label, short, title) {
    return `<span class="fk-meta-badge fk-meta-${escapeHtml(kind)}" title="${escapeHtml(title || label)}" aria-label="${escapeHtml(label)}"><span class="fk-meta-short" aria-hidden="true">${escapeHtml(short)}</span><span class="fk-meta-label">${escapeHtml(label)}</span></span>`;
  }

  function favoriteButton(app) {
    const favorite = isFavorite(app.key);
    return `<button class="fk-icon-button fk-favorite-button ${favorite ? 'is-favorite' : ''}" type="button" data-action="favorite" data-key="${escapeHtml(app.key)}" aria-label="${favorite ? 'Remove from favorites' : 'Add to favorites'}" title="${favorite ? 'Remove from favorites' : 'Add to favorites'}"><span aria-hidden="true">${favorite ? '★' : '☆'}</span></button>`;
  }

  function openButton(app, compact) {
    return `<a class="fk-open-button ${compact ? 'is-compact' : ''}" href="${escapeHtml(app.href)}" data-open-key="${escapeHtml(app.key)}" title="Open ${escapeHtml(app.name)}"><span aria-hidden="true">↗</span><span class="fk-open-label">Open</span></a>`;
  }

  function renderEmpty() {
    return `<div class="fk-empty-state"><span aria-hidden="true">⌕</span><h3>No matching apps</h3><p>Clear a tag or try a broader search.</p><button type="button" data-action="reset-filters">Reset filters</button></div>`;
  }

  function renderList(apps) {
    if (!apps.length) return renderEmpty();
    return `
      <div class="fk-file-view" role="listbox" aria-label="FieldKit apps">
        <div class="fk-file-head" aria-hidden="true">
          <span>App</span><span>Category</span><span>Connection</span><span>Access</span><span></span>
        </div>
        ${apps.map((app) => `
          <div class="fk-file-row fk-select-app ${state.selectedKey === app.key ? 'is-selected' : ''}" role="option" aria-selected="${state.selectedKey === app.key}" tabindex="0" data-key="${escapeHtml(app.key)}">
            <div class="fk-file-name">
              ${iconMarkup(app, 'is-small')}
              <span class="fk-file-copy"><strong>${escapeHtml(app.name)}</strong><small>${escapeHtml(app.desc || app.help.feature)}</small></span>
            </div>
            <span class="fk-file-category">${escapeHtml(app.categoryTitle)}</span>
            <span>${metaBadge(app.connectivity.key, app.connectivity.label, app.connectivity.short, app.connectivity.title)}</span>
            <span>${metaBadge(app.access.key, app.access.label, app.access.short)}</span>
            <span class="fk-row-actions">${favoriteButton(app)}${openButton(app, true)}</span>
          </div>
        `).join('')}
      </div>`;
  }

  function renderCards(apps) {
    if (!apps.length) return renderEmpty();
    return `<div class="fk-card-grid">
      ${apps.map((app) => `
        <article class="fk-app-card fk-select-app ${state.selectedKey === app.key ? 'is-selected' : ''}" data-key="${escapeHtml(app.key)}" tabindex="0">
          <div class="fk-card-head">
            ${iconMarkup(app, 'is-medium')}
            <div class="fk-card-title"><strong>${escapeHtml(app.name)}</strong><span>${escapeHtml(app.categoryTitle)}</span></div>
            ${favoriteButton(app)}
          </div>
          <p>${escapeHtml(app.desc || app.help.feature)}</p>
          <div class="fk-card-tags">${app.tags.slice(0, 4).map((tag) => `<button type="button" data-action="tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}</div>
          <div class="fk-card-foot">
            <span>${metaBadge(app.connectivity.key, app.connectivity.label, app.connectivity.short, app.connectivity.title)}${metaBadge(app.access.key, app.access.label, app.access.short)}</span>
            ${openButton(app, false)}
          </div>
        </article>
      `).join('')}
    </div>`;
  }

  function polarPoint(index, total, radius, offset) {
    const angle = ((Math.PI * 2 * index) / Math.max(1, total)) + offset;
    return {
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius
    };
  }

  function renderAtlas(apps) {
    if (!apps.length) return renderEmpty();
    const tags = tagCounts(apps).slice(0, 10);
    const displayedApps = apps.slice(0, 18);
    const tagPoints = tags.map((item, index) => ({ ...item, ...polarPoint(index, tags.length, 25, -Math.PI / 2) }));
    const appPoints = displayedApps.map((app, index) => ({ app, ...polarPoint(index, displayedApps.length, 43, -Math.PI / 2 + 0.12) }));

    const lines = [
      ...tagPoints.map((point) => `<line x1="50" y1="50" x2="${point.x.toFixed(2)}" y2="${point.y.toFixed(2)}"></line>`),
      ...appPoints.map((point) => {
        const related = tagPoints.find((tagPoint) => point.app.tags.includes(tagPoint.tag)) || tagPoints[0];
        return related
          ? `<line class="is-app-line" x1="${related.x.toFixed(2)}" y1="${related.y.toFixed(2)}" x2="${point.x.toFixed(2)}" y2="${point.y.toFixed(2)}"></line>`
          : '';
      })
    ].join('');

    return `
      <div class="fk-atlas" aria-label="Capability atlas">
        <svg class="fk-atlas-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
        <button class="fk-atlas-core" type="button" data-action="clear-tags"><strong>FieldKit</strong><span>${apps.length} apps</span></button>
        ${tagPoints.map((point) => `<button class="fk-atlas-tag ${state.selectedTags.has(point.tag) ? 'is-active' : ''}" type="button" data-action="tag" data-tag="${escapeHtml(point.tag)}" style="--x:${point.x.toFixed(2)}%;--y:${point.y.toFixed(2)}%;--weight:${Math.min(1.35, 0.82 + point.count / Math.max(8, apps.length))}"><span>${escapeHtml(point.tag)}</span><small>${point.count}</small></button>`).join('')}
        ${appPoints.map((point) => `<button class="fk-atlas-app fk-select-app ${state.selectedKey === point.app.key ? 'is-selected' : ''}" type="button" data-key="${escapeHtml(point.app.key)}" style="--x:${point.x.toFixed(2)}%;--y:${point.y.toFixed(2)}%" title="${escapeHtml(point.app.name)}">${iconMarkup(point.app, 'is-tiny')}<span>${escapeHtml(point.app.name)}</span></button>`).join('')}
        ${apps.length > displayedApps.length ? `<div class="fk-atlas-more">+${apps.length - displayedApps.length} more in List or Cards</div>` : ''}
      </div>`;
  }

  function selectedVisibleApp(apps) {
    return apps.find((app) => app.key === state.selectedKey) || apps[0] || null;
  }

  function renderDetails(app) {
    const details = document.getElementById('fkExplorerDetails');
    if (!details) return;
    if (!app) {
      details.innerHTML = '<div class="fk-details-empty"><span aria-hidden="true">↖</span><p>Select a visible app to see what it does.</p></div>';
      return;
    }

    details.innerHTML = `
      <div class="fk-details-head">
        ${iconMarkup(app, 'is-large')}
        <div><span>${escapeHtml(app.categoryTitle)}</span><h2>${escapeHtml(app.name)}</h2></div>
        <button class="fk-details-close" type="button" data-action="close-details" aria-label="Close details">×</button>
      </div>
      <p class="fk-details-description">${escapeHtml(app.desc || app.help.feature)}</p>
      <div class="fk-details-actions">${favoriteButton(app)}${openButton(app, false)}</div>
      <div class="fk-details-meta">
        ${metaBadge(app.connectivity.key, app.connectivity.label, app.connectivity.short, app.connectivity.title)}
        ${metaBadge(app.access.key, app.access.label, app.access.short)}
      </div>
      <section><h3>Capability</h3><p>${escapeHtml(app.help.feature)}</p></section>
      <section><h3>Best used for</h3><p>${escapeHtml(app.help.scenario)}</p></section>
      <section><h3>Tags</h3><div class="fk-details-tags">${app.tags.map((tag) => `<button type="button" data-action="tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}</div></section>`;
  }

  function renderTags(baseApps) {
    const target = document.getElementById('fkExplorerTags');
    if (!target) return;
    const tags = tagCounts(baseApps).slice(0, 18);
    target.innerHTML = `
      <button class="fk-tag-chip ${state.selectedTags.size === 0 ? 'is-active' : ''}" type="button" data-action="clear-tags"><span>All capabilities</span><small>${baseApps.length}</small></button>
      ${tags.map(({ tag, count }) => `<button class="fk-tag-chip ${state.selectedTags.has(tag) ? 'is-active' : ''}" type="button" data-action="tag" data-tag="${escapeHtml(tag)}"><span>${escapeHtml(tag)}</span><small>${count}</small></button>`).join('')}`;
  }

  function safeCreateIcons() {
    try {
      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    } catch (_error) {}
  }

  function render() {
    const browser = document.getElementById('fkExplorerBrowser');
    if (!browser) return;

    const apps = visibleApps();
    const baseForTags = state.apps.filter((app) => {
      const query = state.query.trim().toLowerCase();
      return (!state.favoritesOnly || isFavorite(app.key)) && (!query || searchableText(app).includes(query));
    });
    const selected = selectedVisibleApp(apps);

    if (selected && state.selectedKey !== selected.key) {
      state.selectedKey = selected.key;
      saveString(SELECTED_KEY, selected.key);
    }

    renderTags(baseForTags);
    browser.dataset.view = state.view;
    browser.innerHTML = state.view === 'cards'
      ? renderCards(apps)
      : state.view === 'atlas'
        ? renderAtlas(apps)
        : renderList(apps);

    document.querySelectorAll('[data-view]').forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    const favoritesButton = document.getElementById('fkFavoritesOnly');
    if (favoritesButton) {
      const count = state.apps.filter((app) => isFavorite(app.key)).length;
      favoritesButton.classList.toggle('is-active', state.favoritesOnly);
      favoritesButton.setAttribute('aria-pressed', String(state.favoritesOnly));
      const countNode = favoritesButton.querySelector('[data-favorite-count]');
      if (countNode) countNode.textContent = String(count);
    }

    const resultCount = document.getElementById('fkResultCount');
    if (resultCount) resultCount.textContent = `${apps.length} of ${state.apps.length} apps`;

    renderDetails(selected);
    safeCreateIcons();
  }

  function selectApp(key) {
    if (!key) return;
    state.selectedKey = key;
    saveString(SELECTED_KEY, key);
    render();
    const details = document.getElementById('fkExplorerDetails');
    if (details && window.matchMedia('(max-width: 860px)').matches) {
      details.classList.add('is-open');
    }
  }

  function openApp(key) {
    const app = state.apps.find((candidate) => candidate.key === key);
    if (!app) return;
    markRecent(key);
    window.location.href = app.href;
  }

  function elementTarget(event) {
    return event.target instanceof Element ? event.target : null;
  }

  function handleAction(target, event) {
    const actionNode = target && target.closest('[data-action]');
    if (!actionNode) return false;
    const action = actionNode.dataset.action;

    if (action === 'favorite') {
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite(actionNode.dataset.key);
      return true;
    }
    if (action === 'tag') {
      event.preventDefault();
      const tag = actionNode.dataset.tag;
      if (state.selectedTags.has(tag)) state.selectedTags.delete(tag);
      else state.selectedTags.add(tag);
      render();
      return true;
    }
    if (action === 'clear-tags') {
      event.preventDefault();
      state.selectedTags.clear();
      render();
      return true;
    }
    if (action === 'reset-filters') {
      event.preventDefault();
      state.query = '';
      state.selectedTags.clear();
      state.favoritesOnly = false;
      const search = document.getElementById('fkExplorerSearch');
      if (search) search.value = '';
      render();
      return true;
    }
    if (action === 'close-details') {
      event.preventDefault();
      const details = document.getElementById('fkExplorerDetails');
      if (details) details.classList.remove('is-open');
      return true;
    }
    return false;
  }

  function addPrivacyButton() {
    const tools = document.querySelector('.header-tools');
    if (!tools || document.getElementById('launcherPrivacyBtn')) return;
    const button = document.createElement('button');
    button.id = 'launcherPrivacyBtn';
    button.className = 's-btn s-btn-outline fk-header-icon-button';
    button.type = 'button';
    button.dataset.openPrivacy = '1';
    button.title = 'Privacy settings';
    button.setAttribute('aria-label', 'Privacy settings');
    button.innerHTML = '<i data-lucide="shield-check" size="18" aria-hidden="true"></i><span>Privacy</span>';
    tools.insertBefore(button, document.getElementById('signOutBtn') || null);
  }

  function createExplorer() {
    const content = document.getElementById('content');
    if (!content || document.getElementById('fkExplorer')) return;

    state.apps = collectApps();
    if (!state.apps.length) return;
    if (!state.apps.some((app) => app.key === state.selectedKey)) state.selectedKey = state.apps[0].key;

    document.body.classList.add('fieldkit-launcher-explorer');
    const legacyControls = document.querySelector('.launcher-controls');
    if (legacyControls) legacyControls.hidden = true;
    addPrivacyButton();

    const explorer = document.createElement('section');
    explorer.id = 'fkExplorer';
    explorer.className = 'fk-explorer';
    explorer.innerHTML = `
      <div class="fk-explorer-toolbar">
        <label class="fk-search-box" for="fkExplorerSearch">
          <span aria-hidden="true">⌕</span>
          <input id="fkExplorerSearch" type="search" autocomplete="off" placeholder="Search apps, capabilities, or tags" aria-label="Search FieldKit apps">
        </label>
        <div class="fk-view-switcher" role="group" aria-label="App view">
          <button type="button" data-view="list" title="File list" aria-label="File list"><span aria-hidden="true">☷</span><span>List</span></button>
          <button type="button" data-view="cards" title="Detailed cards" aria-label="Detailed cards"><span aria-hidden="true">▦</span><span>Cards</span></button>
          <button type="button" data-view="atlas" title="Capability atlas" aria-label="Capability atlas"><span aria-hidden="true">✣</span><span>Atlas</span></button>
        </div>
        <button id="fkFavoritesOnly" class="fk-toolbar-button" type="button" aria-pressed="false" title="Show favorites only"><span aria-hidden="true">★</span><span>Favorites</span><small data-favorite-count>0</small></button>
        <button class="fk-toolbar-button fk-privacy-tool" type="button" data-open-privacy="1" title="Privacy settings"><span aria-hidden="true">◉</span><span>Privacy</span></button>
      </div>
      <div class="fk-explorer-summary"><strong>App Explorer</strong><span id="fkResultCount"></span><span>Single-click for details · Open launches the app</span></div>
      <div id="fkExplorerTags" class="fk-tag-strip" aria-label="Capability tags"></div>
      <div class="fk-explorer-workspace">
        <main id="fkExplorerBrowser" class="fk-explorer-browser" aria-live="polite"></main>
        <aside id="fkExplorerDetails" class="fk-explorer-details" aria-label="Selected app details"></aside>
      </div>`;

    content.replaceChildren(explorer);

    explorer.addEventListener('click', (event) => {
      const target = elementTarget(event);
      if (!target || handleAction(target, event)) return;

      const viewButton = target.closest('[data-view]');
      if (viewButton) {
        state.view = VALID_VIEWS.includes(viewButton.dataset.view) ? viewButton.dataset.view : 'list';
        saveString(VIEW_KEY, state.view);
        render();
        return;
      }

      if (target.closest('#fkFavoritesOnly')) {
        state.favoritesOnly = !state.favoritesOnly;
        render();
        return;
      }

      const appNode = target.closest('.fk-select-app');
      if (appNode && appNode.dataset.key) selectApp(appNode.dataset.key);
    });

    explorer.addEventListener('dblclick', (event) => {
      const target = elementTarget(event);
      const appNode = target && target.closest('.fk-select-app');
      if (appNode && appNode.dataset.key) openApp(appNode.dataset.key);
    });

    explorer.addEventListener('keydown', (event) => {
      const target = elementTarget(event);
      const appNode = target && target.closest('.fk-select-app');
      if (!appNode || !appNode.dataset.key || event.key !== 'Enter') return;
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) openApp(appNode.dataset.key);
      else selectApp(appNode.dataset.key);
    });

    explorer.addEventListener('click', (event) => {
      const target = elementTarget(event);
      const link = target && target.closest('[data-open-key]');
      if (link) markRecent(link.dataset.openKey);
    });

    const search = document.getElementById('fkExplorerSearch');
    search.addEventListener('input', () => {
      state.query = search.value;
      render();
    });

    window.addEventListener('fieldkit-favorites-changed', render);
    window.FieldKitExplorer = {
      refresh() {
        state.apps = collectApps();
        render();
      },
      select: selectApp,
      setView(view) {
        if (!VALID_VIEWS.includes(view)) return;
        state.view = view;
        saveString(VIEW_KEY, view);
        render();
      }
    };

    render();
  }

  function boot(attempt) {
    const ready = typeof APP_REGISTRY !== 'undefined' && APP_REGISTRY && document.getElementById('content');
    if (ready) {
      createExplorer();
      return;
    }
    if (attempt < 60) window.setTimeout(() => boot(attempt + 1), 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  } else {
    boot(0);
  }
})();
