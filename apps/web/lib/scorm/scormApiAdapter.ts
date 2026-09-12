/**
 * Generates scorm-api.js: the SCORM 1.2 runtime adapter bundled into every
 * package. Implements the standard findAPI window-tree-walk (the
 * documented way a SCO locates the LMS's API object, since it's exposed on
 * some ancestor/opener window rather than passed in directly) and wraps
 * LMSInitialize/GetValue/SetValue/Commit/Finish/GetLastError. Falls back to
 * a harmless in-memory stand-in when no LMS API is present at all, so the
 * same package also just works when opened directly in a browser.
 */
export function generateScormApiJs(): string {
  return `
"use strict";

function etvetFindAPI(win) {
  var attempts = 0;
  while (win.API == null && win.parent != null && win.parent !== win && attempts < 500) {
    attempts++;
    win = win.parent;
  }
  return win.API || null;
}

function etvetGetAPI() {
  var api = etvetFindAPI(window);
  if (!api && window.opener) {
    api = etvetFindAPI(window.opener);
  }
  return api;
}

var ScormAPI = (function () {
  var api = etvetGetAPI();
  var initialized = false;
  var fallbackStore = {};

  function usingFallback() {
    return !api;
  }

  function initialize() {
    if (initialized) return true;
    if (!api) {
      initialized = true;
      return true;
    }
    var result = api.LMSInitialize("");
    initialized = result === "true" || result === true;
    return initialized;
  }

  function get(key) {
    if (!api) return fallbackStore[key] || "";
    var value = api.LMSGetValue(key);
    return value == null ? "" : value;
  }

  function set(key, value) {
    if (!api) {
      fallbackStore[key] = value;
      return true;
    }
    var result = api.LMSSetValue(key, value);
    return result === "true" || result === true;
  }

  function commit() {
    if (!api) return true;
    var result = api.LMSCommit("");
    return result === "true" || result === true;
  }

  function finish() {
    if (!api) return true;
    var result = api.LMSFinish("");
    return result === "true" || result === true;
  }

  function getLastError() {
    if (!api) return "0";
    return api.LMSGetLastError();
  }

  return {
    usingFallback: usingFallback,
    initialize: initialize,
    get: get,
    set: set,
    commit: commit,
    finish: finish,
    getLastError: getLastError,
  };
})();
`.trim();
}
