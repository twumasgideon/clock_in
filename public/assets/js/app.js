/**
 * Shared UI helpers + offline SyncQueue (IndexedDB) for kiosk.
 */
(function () {
  const DB_NAME = "apc_kiosk";
  const DB_VERSION = 1;
  const STORE = "sync_queue";

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "client_event_id" });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("device_timestamp", "device_timestamp", { unique: false });
        }
        if (!db.objectStoreNames.contains("roster")) {
          db.createObjectStore("roster", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function enqueueEvent(event) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({
        ...event,
        status: "pending",
        queued_at: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function pendingEvents() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).index("status").getAll("pending");
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function markSynced(ids) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      ids.forEach((id) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const row = getReq.result;
          if (row) {
            row.status = "synced";
            store.put(row);
          }
        };
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Push pending offline events when connectivity returns.
   */
  async function flushQueue(endpoint, deviceCode, deviceToken) {
    const events = await pendingEvents();
    if (!events.length) {
      return { ok: true, accepted: 0 };
    }

    if (window.APCConnectivity) {
      window.APCConnectivity.setSyncing();
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        device_code: deviceCode,
        device_token: deviceToken,
        events: events.map((e) => ({
          client_event_id: e.client_event_id,
          event_type: e.event_type,
          device_timestamp: e.device_timestamp,
          payload: e.payload,
        })),
      }),
    });

    const data = await res.json();
    if (data.ok) {
      await markSynced(events.map((e) => e.client_event_id));
    }

    if (window.APCConnectivity) {
      if (navigator.onLine) {
        document.body.dataset.connectivity = "online";
        const badge = document.getElementById("connectivityBadge");
        if (badge) {
          badge.className = "mode-badge mode-online";
          badge.textContent = "Online";
        }
      }
    }

    return data;
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  window.APCSync = {
    enqueueEvent,
    pendingEvents,
    flushQueue,
    uuid,
  };

  // Auto-flush when coming back online (kiosk pages set device credentials).
  window.addEventListener("online", () => {
    const cfg = window.APC_DEVICE;
    if (!cfg || !cfg.pushUrl) return;
    flushQueue(cfg.pushUrl, cfg.deviceCode, cfg.deviceToken).catch(() => {});
  });
})();
