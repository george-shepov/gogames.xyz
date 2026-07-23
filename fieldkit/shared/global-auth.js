(function () {
  "use strict";

  const PROFILE_KEY = "suite_global_profile_v1";
  const SESSION_KEY = "suite_global_session_v1";

  function nowISO() {
    return new Date().toISOString();
  }

  function readJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeUsername(value) {
    return String(value || "").trim().toLowerCase();
  }

  function validateUsername(value) {
    if (!value) return "Username is required.";
    if (value.length < 3) return "Username must be at least 3 characters.";
    if (value.length > 64) return "Username is too long.";
    if (!/^[a-z0-9._-]+$/.test(value)) {
      return "Username can use: a-z, 0-9, dot, underscore, dash.";
    }
    return "";
  }

  function validatePassword(value) {
    const v = String(value || "");
    if (!v) return "Password is required.";
    if (v.length < 8) return "Password must be at least 8 characters.";
    if (v.length > 256) return "Password is too long.";
    return "";
  }

  function bytesToBase64(bytes) {
    let text = "";
    for (let i = 0; i < bytes.length; i += 1) text += String.fromCharCode(bytes[i]);
    return btoa(text);
  }

  function randomSaltBase64(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytesToBase64(bytes);
  }

  async function hashPassword(password, salt) {
    if (!crypto || !crypto.subtle) {
      throw new Error("Crypto API unavailable in this browser.");
    }
    const encoder = new TextEncoder();
    const input = encoder.encode(`${salt}:${password}`);
    const digest = await crypto.subtle.digest("SHA-256", input);
    return bytesToBase64(new Uint8Array(digest));
  }

  function getProfile() {
    const raw = readJSON(PROFILE_KEY);
    if (!raw) return null;
    if (!raw.username || !raw.salt || !raw.passwordHash) return null;
    return raw;
  }

  function getSession() {
    const raw = readJSON(SESSION_KEY);
    if (!raw || !raw.username) return null;
    return raw;
  }

  function hasProfile() {
    return !!getProfile();
  }

  function isSignedIn() {
    const profile = getProfile();
    const session = getSession();
    return !!(profile && session && session.username === profile.username);
  }

  async function setProfile(username, password) {
    const normalized = normalizeUsername(username);
    const usernameError = validateUsername(normalized);
    if (usernameError) throw new Error(usernameError);
    const passwordError = validatePassword(password);
    if (passwordError) throw new Error(passwordError);

    const salt = randomSaltBase64(16);
    const passwordHash = await hashPassword(password, salt);
    const profile = {
      username: normalized,
      salt,
      passwordHash,
      updatedAt: nowISO()
    };
    writeJSON(PROFILE_KEY, profile);
    writeJSON(SESSION_KEY, { username: normalized, signedAt: nowISO() });
    return profile;
  }

  async function verifyCredentials(username, password) {
    const profile = getProfile();
    if (!profile) return false;
    const normalized = normalizeUsername(username);
    if (normalized !== profile.username) return false;
    const attemptedHash = await hashPassword(password, profile.salt);
    return attemptedHash === profile.passwordHash;
  }

  async function signInWithPassword(username, password) {
    const ok = await verifyCredentials(username, password);
    if (!ok) return false;
    const normalized = normalizeUsername(username);
    writeJSON(SESSION_KEY, { username: normalized, signedAt: nowISO() });
    return true;
  }

  function signOut() {
    localStorage.removeItem(SESSION_KEY);
  }

  function clearProfile() {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  window.SuiteAuth = {
    PROFILE_KEY,
    SESSION_KEY,
    normalizeUsername,
    validateUsername,
    validatePassword,
    getProfile,
    getSession,
    hasProfile,
    isSignedIn,
    setProfile,
    verifyCredentials,
    signInWithPassword,
    signOut,
    clearProfile
  };
})();
