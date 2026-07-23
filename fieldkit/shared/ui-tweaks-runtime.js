(() => {
  const STORAGE_KEY = "suite.ui.tweaks.v1";
  const SCRIPT_MARKER = "/shared/ui-tweaks-runtime.js";
  const SHELL_STYLE_ID = "suite-global-shell-style";
  const BACK_BUTTON_ID = "suite-global-back";
  let debounceTimer = null;

  function getSuiteRootPathname() {
    const path = String(location.pathname || "/");
    const marker = "/shared/";
    const idx = path.indexOf(marker);
    if (idx >= 0) return path.slice(0, idx + 1) || "/";
    if (path.endsWith("/index.html")) return path.slice(0, -"index.html".length) || "/";
    if (path.endsWith("/")) return path;
    const lastSlash = path.lastIndexOf("/");
    return lastSlash >= 0 ? (path.slice(0, lastSlash + 1) || "/") : "/";
  }

  function wildcardToRegExp(pattern) {
    const escaped = String(pattern || "")
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`);
  }

  function matchesPath(pattern, pathname) {
    const p = String(pattern || "*").trim() || "*";
    if (p === "*") return true;
    try {
      return wildcardToRegExp(p).test(pathname);
    } catch {
      return false;
    }
  }

  function loadRules() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const rules = Array.isArray(parsed) ? parsed : [];
      return rules.filter((r) => r && typeof r === "object");
    } catch {
      return [];
    }
  }

  function applyRule(rule) {
    if (!rule || rule.enabled === false) return;
    const selector = String(rule.selector || "").trim();
    const property = String(rule.property || "").trim();
    if (!selector || !property) return;
    const value = rule.value == null ? "" : String(rule.value);

    let nodes = [];
    try {
      nodes = document.querySelectorAll(selector);
    } catch {
      return;
    }

    nodes.forEach((node) => {
      try {
        node.style.setProperty(property, value, rule.important ? "important" : "");
      } catch {
        // ignore invalid property/value
      }
    });
  }

  function applyAll() {
    const rules = loadRules();
    const path = location.pathname || "/";
    rules.forEach((rule) => {
      if (matchesPath(rule.pathPattern, path)) applyRule(rule);
    });
    applyGlobalUX();
  }

  function ensureShellStyles() {
    if (document.getElementById(SHELL_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = SHELL_STYLE_ID;
    style.textContent = `
      :root{
        --suite-shell-bg: radial-gradient(140% 120% at 0% 0%, #e7efff 0%, #f6f8fc 52%, #eef2f8 100%);
        --suite-shell-ink: #152238;
      }
      html, body { max-width: 100%; }
      body.suite-shell {
        -webkit-text-size-adjust: 100%;
        text-size-adjust: 100%;
      }
      body.suite-shell-light {
        background: var(--suite-shell-bg);
        color: var(--suite-shell-ink);
      }
      body.suite-overflow-safe { overflow-x: hidden; }
      body.suite-overflow-safe :where(main,.app,.wrap,.container,.layout,.panel,section,article,form,header,footer) {
        max-width: 100% !important;
      }
      body.suite-overflow-safe :where(img,video,canvas,svg,iframe,table,input,select,textarea,button) {
        max-width: 100% !important;
      }
      @media (max-width: 900px) {
        body.suite-overflow-safe [style*="min-width"] { min-width: 0 !important; }
        body.suite-overflow-safe table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
      }
      #${BACK_BUTTON_ID}{
        position: fixed;
        left: max(10px, env(safe-area-inset-left));
        top: max(10px, env(safe-area-inset-top));
        z-index: 2147483646;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,.45);
        background: rgba(15,23,42,.82);
        color: #e2e8f0;
        font: 600 12px/1.1 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
        text-decoration: none;
        cursor: pointer;
        backdrop-filter: blur(8px);
        box-shadow: 0 10px 24px rgba(2,6,23,.35);
      }
      #${BACK_BUTTON_ID}:hover{
        background: rgba(30,41,59,.9);
        border-color: rgba(148,163,184,.65);
      }
      #${BACK_BUTTON_ID}:active{ transform: translateY(1px); }
      @media (max-width: 680px) {
        #${BACK_BUTTON_ID}{ padding: 7px 10px; font-size: 11px; }
      }
    `;
    document.head.appendChild(style);
  }

  function isRootPath(pathname) {
    const p = String(pathname || "/");
    const root = getSuiteRootPathname();
    return p === root || p === root + "index.html";
  }

  function hasExistingBackControl() {
    const direct = document.querySelector(
      '[data-suite-back], .suite-nav a, a[href="/"], a[href="/index.html"], a[href="../"], a[href=".."], a[href="../index.html"], a[href="./index.html"]'
    );
    if (direct) return true;
    const nodes = Array.from(document.querySelectorAll("a,button")).slice(0, 120);
    return nodes.some((node) => {
      const text = String(node.textContent || "").trim().toLowerCase();
      return text === "back" || text.includes("back to suite") || text.includes("back to home");
    });
  }

  function handleBackClick(ev) {
    ev.preventDefault();
    const ref = String(document.referrer || "");
    const current = String(location.pathname || "");
    if (window.history.length > 1 && ref.startsWith(location.origin)) {
      try {
        const refPath = new URL(ref).pathname;
        if (refPath && refPath !== current) {
          window.history.back();
          return;
        }
      } catch {
        // fallback to root
      }
    }
    window.location.href = getSuiteRootPathname();
  }

  function ensureGlobalBackButton() {
    if (!document.body || isRootPath(location.pathname)) return;
    if (document.getElementById(BACK_BUTTON_ID)) return;
    if (hasExistingBackControl()) return;

    const btn = document.createElement("button");
    btn.id = BACK_BUTTON_ID;
    btn.type = "button";
    btn.setAttribute("data-suite-back", "1");
    btn.textContent = "← Suite";
    btn.title = "Back";
    btn.addEventListener("click", handleBackClick);
    document.body.appendChild(btn);
  }

  function parseRGB(colorValue) {
    const match = String(colorValue || "")
      .replace(/\s+/g, "")
      .match(/^rgba?\((\d+),(\d+),(\d+)/i);
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  }

  function isBrightBackground(colorValue) {
    const rgb = parseRGB(colorValue);
    if (!rgb) return false;
    const [r, g, b] = rgb.map((v) => v / 255);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance >= 0.92;
  }

  function updateThemeShell() {
    if (!document.body) return;
    document.body.classList.add("suite-shell");
    const style = getComputedStyle(document.body);
    const bgImage = String(style.backgroundImage || "").toLowerCase();
    const bgColor = String(style.backgroundColor || "");
    const hasDarkClass =
      document.body.classList.contains("dark") ||
      document.documentElement.classList.contains("dark");
    const shouldUseLightShell = !hasDarkClass && (bgImage === "none" || bgImage === "") && isBrightBackground(bgColor);
    document.body.classList.toggle("suite-shell-light", shouldUseLightShell);
  }

  function updateOverflowSafety() {
    if (!document.body) return;
    const root = document.documentElement;
    const narrowScreen = window.matchMedia("(max-width: 980px)").matches;
    const overflowing = root.scrollWidth > root.clientWidth + 4;
    if (narrowScreen || overflowing || document.body.classList.contains("suite-overflow-safe")) {
      document.body.classList.add("suite-overflow-safe");
      return;
    }
    document.body.classList.remove("suite-overflow-safe");
  }

  function applyGlobalUX() {
    ensureShellStyles();
    ensureGlobalBackButton();
    updateThemeShell();
    updateOverflowSafety();
  }

  function scheduleApply() {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      applyAll();
    }, 70);
  }

  function boot() {
    ensureShellStyles();
    applyAll();

    const observer = new MutationObserver(() => {
      scheduleApply();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });

    window.addEventListener("storage", (ev) => {
      if (ev.key === STORAGE_KEY) scheduleApply();
    });
    window.addEventListener("resize", scheduleApply, { passive: true });
    window.addEventListener("pageshow", scheduleApply);

    window.FieldKitUITweaks = {
      storageKey: STORAGE_KEY,
      script: SCRIPT_MARKER,
      applyNow: applyAll,
      backButtonId: BACK_BUTTON_ID
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
