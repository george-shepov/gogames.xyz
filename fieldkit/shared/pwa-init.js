(function () {
  if (window.__suitePWAInit) return;
  window.__suitePWAInit = true;
  const params = new URLSearchParams(window.location.search);
  const currentScript = document.currentScript;
  const scriptURL = currentScript && currentScript.src
    ? new URL(currentScript.src, window.location.href)
    : new URL("shared/pwa-init.js", document.baseURI);
  const appRootURL = new URL("../", scriptURL);

  function resolveAssetURL(path) {
    const normalized = String(path || "").replace(/^\/+/, "");
    return new URL(normalized, appRootURL).toString();
  }

  function ensureMeta(name, content) {
    if (document.querySelector(`meta[name="${name}"]`)) return;
    const meta = document.createElement("meta");
    meta.setAttribute("name", name);
    meta.setAttribute("content", content);
    document.head.appendChild(meta);
  }

  function ensureLink(rel, href) {
    const existing = document.querySelector(`link[rel="${rel}"]`);
    if (existing) {
      existing.setAttribute("href", href);
      return;
    }
    const link = document.createElement("link");
    link.setAttribute("rel", rel);
    link.setAttribute("href", href);
    document.head.appendChild(link);
  }

  function loadLauncherExtensions() {
    if (!document.getElementById("content")) return;
    if (document.querySelector('script[data-fieldkit-app-extensions="1"]')) return;
    const script = document.createElement("script");
    script.src = resolveAssetURL("shared/app-extensions.js");
    script.dataset.fieldkitAppExtensions = "1";
    script.defer = true;
    document.body.appendChild(script);
  }

  if (document.head) {
    ensureLink("manifest", resolveAssetURL("manifest.webmanifest"));
    ensureLink("apple-touch-icon", resolveAssetURL("shared/icons/tictak-icon-512.png"));
    ensureMeta("theme-color", "#0f172a");
    ensureMeta("mobile-web-app-capable", "yes");
    ensureMeta("apple-mobile-web-app-capable", "yes");
    ensureMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadLauncherExtensions, { once: true });
  } else {
    loadLauncherExtensions();
  }

  if (!("serviceWorker" in navigator)) return;

  async function resetOfflineState() {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function (r) { return r.unregister(); }));
    } catch (_e) {}
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }
    } catch (_e) {}
  }

  if (params.get("sw-reset") === "1") {
    window.addEventListener("load", function () {
      resetOfflineState().finally(function () {
        const next = new URL(window.location.href);
        next.searchParams.delete("sw-reset");
        next.searchParams.set("v", String(Date.now()));
        window.location.replace(next.toString());
      });
    });
    return;
  }

  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "::1";

  if (!window.isSecureContext && !isLocalhost) {
    console.info(
      "[PWA] Service worker skipped: HTTPS is required for installable offline mode on phone."
    );
    return;
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker.register(resolveAssetURL("sw.js")).catch(function (err) {
      console.warn("[PWA] Service worker registration failed:", err);
    });
  });
})();
