/**
 * Connectivity detector for hybrid online/offline operation.
 * Updates body[data-connectivity] and #connectivityBadge.
 */
(function () {
  const badge = () => document.getElementById("connectivityBadge");
  const body = document.body;

  function setMode(mode, label) {
    body.dataset.connectivity = mode;
    const el = badge();
    if (!el) return;
    el.className = "mode-badge mode-" + mode;
    el.textContent = label;
  }

  function applyOnline() {
    setMode("online", "Online");
    window.dispatchEvent(new CustomEvent("apc:connectivity", { detail: { mode: "online" } }));
  }

  function applyOffline() {
    setMode("offline", "Offline");
    window.dispatchEvent(new CustomEvent("apc:connectivity", { detail: { mode: "offline" } }));
  }

  window.APCConnectivity = {
    isOnline() {
      return navigator.onLine;
    },
    currentMode() {
      return body.dataset.connectivity || (navigator.onLine ? "online" : "offline");
    },
    setSyncing() {
      setMode("syncing", "Syncing…");
    },
  };

  window.addEventListener("online", applyOnline);
  window.addEventListener("offline", applyOffline);

  if (navigator.onLine) {
    applyOnline();
  } else {
    applyOffline();
  }
})();
