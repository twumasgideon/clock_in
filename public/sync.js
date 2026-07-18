(function () {
  const DB_NAME = "apc_kiosk";
  const DB_VERSION = 1;
  const STORE = "sync_queue";

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var store = db.createObjectStore(STORE, { keyPath: "client_event_id" });
          store.createIndex("status", "status", { unique: false });
        }
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  async function enqueueEvent(event) {
    var db = await openDb();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(
        Object.assign({}, event, {
          status: "pending",
          queued_at: new Date().toISOString(),
        }),
      );
      tx.oncomplete = function () {
        resolve(true);
      };
      tx.onerror = function () {
        reject(tx.error);
      };
    });
  }

  async function pendingEvents() {
    var db = await openDb();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, "readonly");
      var req = tx.objectStore(STORE).index("status").getAll("pending");
      req.onsuccess = function () {
        resolve(req.result || []);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  async function markSynced(ids) {
    var db = await openDb();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, "readwrite");
      var store = tx.objectStore(STORE);
      ids.forEach(function (id) {
        var getReq = store.get(id);
        getReq.onsuccess = function () {
          var row = getReq.result;
          if (row) {
            row.status = "synced";
            store.put(row);
          }
        };
      });
      tx.oncomplete = function () {
        resolve(true);
      };
      tx.onerror = function () {
        reject(tx.error);
      };
    });
  }

  async function flushQueue(endpoint, deviceCode, deviceToken) {
    var events = await pendingEvents();
    if (!events.length) return { ok: true, accepted: 0 };

    var res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        device_code: deviceCode,
        device_token: deviceToken,
        events: events.map(function (e) {
          return {
            client_event_id: e.client_event_id,
            event_type: e.event_type,
            device_timestamp: e.device_timestamp,
            payload: e.payload,
          };
        }),
      }),
    });
    var data = await res.json();
    if (data.ok) {
      await markSynced(
        events.map(function (e) {
          return e.client_event_id;
        }),
      );
    }
    return data;
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  window.APCSync = { enqueueEvent: enqueueEvent, pendingEvents: pendingEvents, flushQueue: flushQueue, uuid: uuid };

  window.addEventListener("online", function () {
    var cfg = window.APC_DEVICE;
    if (!cfg || !cfg.pushUrl) return;
    flushQueue(cfg.pushUrl, cfg.deviceCode, cfg.deviceToken).catch(function () {});
  });
})();
