(function () {
  'use strict';

  if (window.__fieldKitAppLibrary) return;
  window.__fieldKitAppLibrary = true;

  const FAVORITES_KEY = 'suite_favorite_apps_v1';
  const COLLAPSED_KEY = 'fieldkit_library_collapsed_v1';
  const CATEGORY_FILTER_KEY = 'fieldkit_library_category_v1';
  const THEME_KEY = 'fieldkit_library_theme_v1';
  const DEFAULT_THEME = {
    accent: '#f59e0b',
    highlight: '#fbbf24',
    surface: '#111318',
    fontScale: '1'
  };

  const keywordTags = [
    ['AI', /\b(ai|assistant|caption|model|recommendation|chatgpt)\b/i],
    ['Audio', /\b(audio|voice|music|midi|ear|sound|piano|drum)\b/i],
    ['Camera', /\b(camera|photo|image|video|capture|record)\b/i],
    ['Code', /\b(code|javascript|linux|terminal|developer|snippet|sql|database)\b/i],
    ['Documents', /\b(document|library|record|docket|receipt|notes?|markdown|slides)\b/i],
    ['Emergency', /\b(emergency|sos|first aid|cpr|safety|authority)\b/i],
    ['Finance', /\b(tax|expense|inventory|money|receipt|price|1099)\b/i],
    ['Games', /\b(game|tic-tac-toe|snake|battleship|reversi|chess|checkers|arcade|puzzle)\b/i],
    ['Legal', /\b(legal|court|docket|authority|consent)\b/i],
    ['Offline', /\b(offline|airplane|local|device-only)\b/i],
    ['Productivity', /\b(kanban|pomodoro|habit|time tracker|wishlist|workflow|profile)\b/i],
    ['Sharing', /\b(qr|share|messenger|poll|export)\b/i],
    ['Training', /\b(train|practice|study|quiz|flashcard|learn|academy|interview|skill)\b/i],
    ['Visual', /\b(whiteboard|diagram|image|slides|presentation|canvas|draw)\b/i]
  ];

  const appTagOverrides = {
    'gigtax': ['1099', 'Taxes', 'Calculator'],
    'receipt-tracker': ['Receipts', 'Bookkeeping', 'OCR'],
    'inventory': ['Inventory', 'Catalog', 'Sales'],
    'docketpro': ['Cases', 'Deadlines', 'Court'],
    'legal-library': ['Research', 'PDF', 'Reference'],
    'authority-assistant': ['Consent', 'Safety', 'Voice'],
    'pomodoro': ['Focus', 'Timer', 'Deep Work'],
    'kanban': ['Tasks', 'Board', 'Planning'],
    'time-tracker': ['Time', 'Invoicing', 'Logs'],
    'habit-tracker': ['Habits', 'Streaks', 'Routine'],
    'snippet-board': ['Snippets', 'Developer', 'Reference'],
    'convict_conditioning': ['Fitness', 'Strength', 'Tracker'],
    'outdoor-kit': ['Compass', 'SOS', 'Field'],
    'field-checkin': ['Location', 'Heartbeat', 'Safety'],
    'cns-tap-test': ['Readiness', 'Fitness', 'Test'],
    'first-aid': ['CPR', 'Emergency', 'Guide'],
    'linux-trainer': ['Linux', 'Terminal', 'Interview'],
    'js-trainer': ['JavaScript', 'REPL', 'Code'],
    'math-trainer': ['Math', 'Practice', 'Drills'],
    'quiz-builder': ['Quiz', 'Authoring', 'Study'],
    'drivers-license': ['Driving', 'Flashcards', 'Multilingual'],
    'music-trainer': ['Music', 'Ear Training', 'Theory'],
    'midi-note-helper': ['MIDI', 'Notes', 'Piano'],
    'vocabulary-expander': ['Vocabulary', 'Words', 'Flashcards'],
    'developer-interview-prep': ['Interview', 'SQL', '.NET'],
    'privacy-camera': ['Photo', 'Private', 'Capture'],
    'privacy-recorder': ['Video', 'Private', 'Capture'],
    'audio-notes': ['Voice Notes', 'Recorder', 'Sync'],
    'music-player': ['Audio', 'Player', 'Local Files'],
    'music-studio': ['Piano', 'Drums', 'Studio'],
    'image-rater': ['Images', 'Preferences', 'Ratings'],
    'accent-speaker': ['Speech', 'Voices', 'Pronunciation'],
    'employee-skills': ['Team', 'Skills', 'Matrix'],
    'acronym-list': ['Glossary', 'Business', 'Reference'],
    'wishlist': ['Requests', 'Ideas', 'Roadmap'],
    'support': ['Tickets', 'Help Desk', 'Customer'],
    'light-messenger': ['Messenger', 'Light', 'Offline'],
    'profile': ['Identity', 'Account', 'Settings'],
    'clock': ['Alarm', 'Timer', 'Stopwatch'],
    'ui-tweaker': ['CSS', 'Themes', 'Customization'],
    'whiteboard': ['Whiteboard', 'Drawing', 'Diagrams'],
    'markdown-slides': ['Markdown', 'Slides', 'Presentations'],
    'qr-generator': ['QR', 'Sharing', 'Generator'],
    'chatgpt-viewer': ['ChatGPT', 'Exports', 'Search'],
    'opb': ['Polls', 'Voting', 'Results'],
    'game-academy': ['Chess', 'Checkers', 'Learning'],
    'reversi': ['Strategy', 'Board Game', 'Reversi'],
    'battleship': ['Strategy', 'Naval', 'Board Game'],
    'positive-iq': ['IQ', 'Cognitive', 'Test'],
    'math-raindrops': ['Math', 'Adaptive', 'Arcade'],
    'tic-tac-toe': ['Strategy', 'Grid', 'Game'],
    'snake': ['Arcade', 'Classic', 'Game'],
    'pattern-mirror': ['Memory', 'Pattern', 'Game'],
    'odd-one-out': ['Logic', 'Puzzle', 'Game']
  };

  const state = {
    query: '',
    selectedTags: new Set(),
    categoryFilter: loadString(CATEGORY_FILTER_KEY, ''),
    favoritesOnly: false,
    themeOpen: false,
    theme: loadTheme(),
    apps: [],
    categories: [],
    collapsed: new Set(loadArray(COLLAPSED_KEY))
  };

  function safeColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;
  }

  function safeFontScale(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0.9 && number <= 1.15 ? number.toFixed(2) : DEFAULT_THEME.fontScale;
  }

  function loadTheme() {
    try {
      const parsed = JSON.parse(localStorage.getItem(THEME_KEY) || '{}');
      return {
        accent: safeColor(parsed.accent, DEFAULT_THEME.accent),
        highlight: safeColor(parsed.highlight, DEFAULT_THEME.highlight),
        surface: safeColor(parsed.surface, DEFAULT_THEME.surface),
        fontScale: safeFontScale(parsed.fontScale)
      };
    } catch (_error) {
      return { ...DEFAULT_THEME };
    }
  }

  function saveTheme() {
    try { localStorage.setItem(THEME_KEY, JSON.stringify(state.theme)); } catch (_error) {}
  }

  function applyTheme(root) {
    if (!root) return;
    root.style.setProperty('--fkl-accent', state.theme.accent);
    root.style.setProperty('--fkl-highlight', state.theme.highlight);
    root.style.setProperty('--fkl-surface', state.theme.surface);
    root.style.setProperty('--fkl-accent-soft', `color-mix(in srgb, ${state.theme.accent} 14%, transparent)`);
    root.style.setProperty('--fkl-font-scale', state.theme.fontScale);
    document.body.style.setProperty('--fk-launcher-accent', state.theme.accent);
    document.body.style.setProperty('--fk-launcher-highlight', state.theme.highlight);
  }

  function loadString(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch (_error) { return fallback; }
  }

  function saveString(key, value) {
    try { localStorage.setItem(key, value); } catch (_error) {}
  }

  function loadArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_error) { return []; }
  }

  function saveArray(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_error) {}
  }

  function loadMap(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (_error) { return {}; }
  }

  function saveMap(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_error) {}
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
    return String(value || 'Other').replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Other';
  }

  function categoryEmoji(value) {
    const match = String(value || '').match(/^([^\p{L}\p{N}]+)/u);
    return match ? match[1].trim() : '📦';
  }

  function appHref(app) {
    try { if (typeof toAppHref === 'function') return toAppHref(app); } catch (_error) {}
    if (app.path) return app.path;
    return `${app.key}/index.html`;
  }

  function isFavorite(key) {
    return Boolean(loadMap(FAVORITES_KEY)[key]);
  }

  function toggleFavorite(key) {
    const favorites = loadMap(FAVORITES_KEY);
    if (favorites[key]) delete favorites[key];
    else favorites[key] = true;
    saveMap(FAVORITES_KEY, favorites);
  }

  function markRecent(key) {
    const recent = loadMap('suite_recent_apps_v1');
    recent[key] = Date.now();
    saveMap('suite_recent_apps_v1', recent);
  }

  function getHelp(app) {
    try {
      if (typeof APP_HELP !== 'undefined' && APP_HELP && APP_HELP[app.key]) return APP_HELP[app.key];
    } catch (_error) {}
    return { feature: app.desc || 'Open the app to use its main workflow.', scenario: '' };
  }

  function connectivityTag(app) {
    const offline = String(app.offline || '').toLowerCase();
    return offline === 'hybrid' || offline === 'wifi' || offline === 'online' || app.offline === false
      ? 'Connected'
      : 'Offline';
  }

  function deriveTags(app, categoryTitle, help) {
    const tags = new Set([categoryTitle, connectivityTag(app), app.demo ? 'Demo' : app.free ? 'Free' : 'Full']);
    (appTagOverrides[app.key] || []).forEach((tag) => tags.add(tag));
    (app.tags || []).forEach((tag) => tags.add(tag));
    const corpus = [app.name, app.desc, categoryTitle, help.feature, help.scenario].join(' ');
    keywordTags.forEach(([tag, expression]) => { if (expression.test(corpus)) tags.add(tag); });
    return Array.from(tags);
  }

  function collectApps() {
    const apps = [];
    const categories = [];
    if (typeof APP_REGISTRY === 'undefined' || !APP_REGISTRY) return { apps, categories };

    Object.entries(APP_REGISTRY).forEach(([categoryKey, category]) => {
      const categoryTitle = cleanCategoryTitle(category.title || categoryKey);
      categories.push({
        key: categoryKey,
        title: categoryTitle,
        emoji: categoryEmoji(category.title),
        icon: category.icon || '',
        order: categories.length
      });
      Object.entries(category.apps || {}).forEach(([key, raw]) => {
        const app = { key, ...raw };
        const help = getHelp(app);
        apps.push({
          ...app,
          categoryKey,
          categoryTitle,
          help,
          href: appHref(app),
          tags: deriveTags(app, categoryTitle, help)
        });
      });
    });
    return { apps, categories };
  }

  function searchableText(app) {
    return [app.name, app.desc, app.categoryTitle, app.help.feature, app.help.scenario, app.tags.join(' ')].join(' ').toLowerCase();
  }

  function visibleApps() {
    const query = state.query.trim().toLowerCase();
    return state.apps.filter((app) => {
      if (state.favoritesOnly && !isFavorite(app.key)) return false;
      if (state.categoryFilter && app.categoryKey !== state.categoryFilter) return false;
      if (query && !searchableText(app).includes(query)) return false;
      for (const tag of state.selectedTags) if (!app.tags.includes(tag)) return false;
      return true;
    });
  }

  function tagCounts(apps) {
    const counts = new Map();
    apps.forEach((app) => app.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  function iconMarkup(icon, name, className) {
    return `<span class="fk-library-icon ${className || ''}" aria-hidden="true"><img src="shared/icons/${escapeHtml(icon || '')}" alt="" onerror="this.remove();this.parentElement.classList.add('is-fallback')"><span class="fk-library-fallback">${escapeHtml((name || '?').slice(0, 1).toUpperCase())}</span></span>`;
  }

  function renderCategoryDock(apps) {
    const counts = new Map();
    apps.forEach((app) => counts.set(app.categoryKey, (counts.get(app.categoryKey) || 0) + 1));
    return `<nav class="fk-category-dock" aria-label="App categories">
      <button type="button" data-action="category" data-category="" class="${state.categoryFilter === '' ? 'is-active' : ''}"><span>◉</span><strong>All</strong><small>${apps.length}</small></button>
      ${state.categories.map((category) => `<button type="button" data-action="category" data-category="${escapeHtml(category.key)}" class="${state.categoryFilter === category.key ? 'is-active' : ''}"><span>${escapeHtml(category.emoji)}</span><strong>${escapeHtml(category.title)}</strong><small>${counts.get(category.key) || 0}</small></button>`).join('')}
    </nav>`;
  }

  function renderTagCloud(apps) {
    const tags = tagCounts(apps);
    const max = Math.max(1, ...tags.map((item) => item.count));
    return `<section class="fk-tag-cloud-panel">
      <div class="fk-library-section-title"><div><span>Discover by tag</span><h2>Tag cloud</h2></div><button type="button" data-action="clear-tags" ${state.selectedTags.size ? '' : 'disabled'}>Clear tags</button></div>
      <div class="fk-tag-cloud" aria-label="Filter apps by tags">
        ${tags.map(({ tag, count }) => {
          const weight = (0.82 + (count / max) * 0.5).toFixed(2);
          return `<button type="button" data-action="tag" data-tag="${escapeHtml(tag)}" class="${state.selectedTags.has(tag) ? 'is-active' : ''}" style="--tag-weight:${weight}"><span>${escapeHtml(tag)}</span><small>${count}</small></button>`;
        }).join('')}
      </div>
    </section>`;
  }

  function renderThemeSettings() {
    return `<section class="fk-theme-settings ${state.themeOpen ? 'is-open' : ''}" aria-label="FieldKit appearance settings">
      <div class="fk-theme-settings-copy">
        <span>Launcher appearance</span>
        <h2>Theme &amp; density</h2>
        <p>Saved on this device. Adjust the main accent, highlight, panel color, and text scale.</p>
      </div>
      <div class="fk-theme-settings-fields">
        <label><span>Accent</span><input type="color" data-theme-field="accent" value="${state.theme.accent}" aria-label="Accent color"></label>
        <label><span>Highlight</span><input type="color" data-theme-field="highlight" value="${state.theme.highlight}" aria-label="Highlight color"></label>
        <label><span>Panels</span><input type="color" data-theme-field="surface" value="${state.theme.surface}" aria-label="Panel color"></label>
        <label><span>Text scale</span><select data-theme-field="fontScale" aria-label="Text scale">
          ${[['0.90', 'Compact'], ['0.95', 'Small'], ['1', 'Default'], ['1.05', 'Large'], ['1.10', 'Larger'], ['1.15', 'Extra large']].map(([value, label]) => `<option value="${value}" ${state.theme.fontScale === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select></label>
        <button type="button" class="fk-theme-reset" data-action="reset-theme">Reset appearance</button>
      </div>
    </section>`;
  }

  function renderAppTile(app) {
    const visibleTags = app.tags.filter((tag) => ![app.categoryTitle, 'Full', 'Free', 'Demo'].includes(tag)).slice(0, 3);
    const favorite = isFavorite(app.key);
    return `<article class="fk-library-app" data-key="${escapeHtml(app.key)}" tabindex="0" aria-label="Open ${escapeHtml(app.name)}">
      <button class="fk-library-favorite ${favorite ? 'is-favorite' : ''}" type="button" data-action="favorite" data-key="${escapeHtml(app.key)}" aria-label="${favorite ? 'Remove from favorites' : 'Add to favorites'}">${favorite ? '★' : '☆'}</button>
      ${iconMarkup(app.icon, app.name, 'is-app')}
      <div class="fk-library-app-copy"><h3>${escapeHtml(app.name)}</h3><p>${escapeHtml(app.desc || app.help.feature)}</p></div>
      <div class="fk-library-app-tags">${visibleTags.map((tag) => `<button type="button" data-action="tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}</div>
      <a class="fk-library-launch" href="${escapeHtml(app.href)}" data-open-key="${escapeHtml(app.key)}"><span>Launch</span><span aria-hidden="true">↗</span></a>
    </article>`;
  }

  function renderFolders(apps) {
    if (!apps.length) return `<div class="fk-library-empty"><span>⌕</span><h2>No matching apps</h2><p>Clear a tag, category, favorite filter, or search term.</p><button type="button" data-action="reset">Reset filters</button></div>`;
    const byCategory = new Map();
    apps.forEach((app) => {
      if (!byCategory.has(app.categoryKey)) byCategory.set(app.categoryKey, []);
      byCategory.get(app.categoryKey).push(app);
    });
    return `<div class="fk-folder-stack">${state.categories
      .filter((category) => byCategory.has(category.key))
      .map((category) => {
        const categoryApps = byCategory.get(category.key);
        const collapsed = state.collapsed.has(category.key);
        return `<section class="fk-folder ${collapsed ? 'is-collapsed' : ''}" id="category-${escapeHtml(category.key)}">
          <button class="fk-folder-header" type="button" data-action="collapse" data-category="${escapeHtml(category.key)}" aria-expanded="${String(!collapsed)}">
            <span class="fk-folder-symbol">${escapeHtml(category.emoji)}</span>
            <span class="fk-folder-title"><small>Category container</small><strong>${escapeHtml(category.title)}</strong></span>
            <span class="fk-folder-count">${categoryApps.length} ${categoryApps.length === 1 ? 'app' : 'apps'}</span>
            <span class="fk-folder-chevron" aria-hidden="true">⌄</span>
          </button>
          <div class="fk-folder-grid">${categoryApps.map(renderAppTile).join('')}</div>
        </section>`;
      }).join('')}</div>`;
  }

  function render() {
    const root = document.getElementById('fkAppLibrary');
    if (!root) return;
    const apps = visibleApps();
    const tagBase = state.apps.filter((app) => {
      const query = state.query.trim().toLowerCase();
      return (!state.favoritesOnly || isFavorite(app.key)) && (!state.categoryFilter || app.categoryKey === state.categoryFilter) && (!query || searchableText(app).includes(query));
    });
    root.innerHTML = `
      <div class="fk-library-toolbar">
        <label class="fk-library-search"><span aria-hidden="true">⌕</span><input id="fkLibrarySearch" type="search" value="${escapeHtml(state.query)}" placeholder="Search apps, tags, or capabilities" autocomplete="off"></label>
        <button type="button" data-action="favorites" class="fk-library-filter ${state.favoritesOnly ? 'is-active' : ''}"><span>★</span><strong>Favorites</strong><small>${state.apps.filter((app) => isFavorite(app.key)).length}</small></button>
        <button type="button" data-action="theme-settings" class="fk-library-filter ${state.themeOpen ? 'is-active' : ''}" aria-expanded="${String(state.themeOpen)}"><span>◌</span><strong>Theme</strong></button>
        <button type="button" data-action="reset" class="fk-library-filter"><span>↺</span><strong>Reset</strong></button>
      </div>
      ${renderThemeSettings()}
      ${renderCategoryDock(state.apps)}
      ${renderTagCloud(tagBase)}
      <div class="fk-library-summary"><strong>App Library</strong><span>${apps.length} of ${state.apps.length} apps</span><span>Categories are folders · tags narrow the library</span></div>
      ${renderFolders(apps)}`;

    const search = document.getElementById('fkLibrarySearch');
    if (search) {
      search.addEventListener('input', () => {
        state.query = search.value;
        render();
        const next = document.getElementById('fkLibrarySearch');
        if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
      });
    }
    root.querySelectorAll('[data-theme-field]').forEach((input) => {
      input.addEventListener('input', () => {
        const field = input.dataset.themeField;
        if (field === 'fontScale') state.theme.fontScale = safeFontScale(input.value);
        else if (field === 'accent') state.theme.accent = safeColor(input.value, DEFAULT_THEME.accent);
        else if (field === 'highlight') state.theme.highlight = safeColor(input.value, DEFAULT_THEME.highlight);
        else if (field === 'surface') state.theme.surface = safeColor(input.value, DEFAULT_THEME.surface);
        saveTheme();
        applyTheme(root);
      });
    });
  }

  function handleAction(node, event) {
    const action = node.dataset.action;
    if (action === 'favorite') {
      event.preventDefault(); event.stopPropagation();
      toggleFavorite(node.dataset.key); render(); return true;
    }
    if (action === 'tag') {
      event.preventDefault(); event.stopPropagation();
      const tag = node.dataset.tag;
      if (state.selectedTags.has(tag)) state.selectedTags.delete(tag); else state.selectedTags.add(tag);
      render(); return true;
    }
    if (action === 'clear-tags') {
      event.preventDefault(); state.selectedTags.clear(); render(); return true;
    }
    if (action === 'favorites') {
      event.preventDefault(); state.favoritesOnly = !state.favoritesOnly; render(); return true;
    }
    if (action === 'category') {
      event.preventDefault();
      state.categoryFilter = node.dataset.category || '';
      saveString(CATEGORY_FILTER_KEY, state.categoryFilter);
      render(); return true;
    }
    if (action === 'theme-settings') {
      event.preventDefault(); state.themeOpen = !state.themeOpen; render(); return true;
    }
    if (action === 'reset-theme') {
      event.preventDefault(); state.theme = { ...DEFAULT_THEME }; saveTheme(); state.themeOpen = true; render(); return true;
    }
    if (action === 'collapse') {
      event.preventDefault();
      const key = node.dataset.category;
      if (state.collapsed.has(key)) state.collapsed.delete(key); else state.collapsed.add(key);
      saveArray(COLLAPSED_KEY, Array.from(state.collapsed));
      render(); return true;
    }
    if (action === 'reset') {
      event.preventDefault();
      state.query = ''; state.selectedTags.clear(); state.categoryFilter = ''; state.favoritesOnly = false;
      saveString(CATEGORY_FILTER_KEY, ''); render(); return true;
    }
    return false;
  }

  function createLibrary() {
    const content = document.getElementById('content');
    if (!content || document.getElementById('fkAppLibrary')) return;
    const collected = collectApps();
    if (!collected.apps.length) return;
    state.apps = collected.apps;
    state.categories = collected.categories;
    document.body.classList.add('fieldkit-app-library');
    const legacyControls = document.querySelector('.launcher-controls');
    if (legacyControls) legacyControls.hidden = true;

    const root = document.createElement('section');
    root.id = 'fkAppLibrary';
    root.className = 'fk-app-library';
    content.replaceChildren(root);
    applyTheme(root);

    root.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const actionNode = target.closest('[data-action]');
      if (actionNode && handleAction(actionNode, event)) return;
      const openLink = target.closest('[data-open-key]');
      if (openLink) { markRecent(openLink.dataset.openKey); return; }
      const tile = target.closest('.fk-library-app');
      if (tile && tile.dataset.key) {
        const app = state.apps.find((candidate) => candidate.key === tile.dataset.key);
        if (app) { markRecent(app.key); window.location.href = app.href; }
      }
    });

    root.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target instanceof Element ? event.target : null;
      const tile = target && target.closest('.fk-library-app');
      if (!tile || target.closest('button,a')) return;
      event.preventDefault();
      const app = state.apps.find((candidate) => candidate.key === tile.dataset.key);
      if (app) { markRecent(app.key); window.location.href = app.href; }
    });

    window.FieldKitLibrary = { refresh() { const next = collectApps(); state.apps = next.apps; state.categories = next.categories; render(); } };
    render();
  }

  function boot(attempt) {
    const ready = typeof APP_REGISTRY !== 'undefined' && APP_REGISTRY && document.getElementById('content');
    if (ready) { createLibrary(); return; }
    if (attempt < 80) window.setTimeout(() => boot(attempt + 1), 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  else boot(0);
})();
