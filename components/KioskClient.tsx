"use client";

import { useEffect, useState } from "react";
import { kioskClock } from "@/app/actions";

type Member = {
  id: string;
  member_code: string;
  first_name: string;
  last_name: string;
};
type Service = { id: string; title: string; starts_at: string };
type Device = {
  id: string;
  device_code: string;
  name: string;
  location?: string | null;
  mode: string;
} | null;

declare global {
  interface Window {
    APCSync?: {
      uuid: () => string;
      flushQueue: (
        endpoint: string,
        deviceCode: string,
        deviceToken: string,
      ) => Promise<{ ok: boolean; accepted?: number; error?: string }>;
      enqueueEvent: (event: Record<string, unknown>) => Promise<boolean>;
    };
  }
}

export function KioskClient({
  members,
  services,
  device,
}: {
  members: Member[];
  services: Service[];
  device: Device;
}) {
  const [mode, setMode] = useState<"online" | "offline">("online");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const apply = () => setMode(navigator.onLine ? "online" : "offline");
    apply();
    window.addEventListener("online", apply);
    window.addEventListener("offline", apply);

    // load sync helper
    const script = document.createElement("script");
    script.src = "/sync.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      window.removeEventListener("online", apply);
      window.removeEventListener("offline", apply);
    };
  }, []);

  async function flush() {
    if (!window.APCSync || !device) {
      setMessage("Sync helper or device not ready.");
      return;
    }
    try {
      const result = await window.APCSync.flushQueue(
        "/api/sync/push",
        device.device_code,
        "dev-token-change-me",
      );
      setMessage(
        result.ok
          ? `Synced ${result.accepted ?? 0} event(s)`
          : result.error || "Sync failed",
      );
    } catch (e) {
      setMessage(String(e));
    }
  }

  return (
    <div className="grid-2">
      <div>
        <div className="kiosk-stage" style={{ marginBottom: "1rem" }}>
          <div>
            <span className={`mode-badge mode-${mode}`} style={{ marginBottom: 12 }}>
              {mode === "online" ? "Online" : "Offline"}
            </span>
            <h2>Ready for biometric capture</h2>
            <p className="empty-hint" style={{ margin: 0 }}>
              Phase 0–1: use manual select below.
              <br />
              Phase 2 will add webcam face capture + fingerprint scan.
            </p>
          </div>
        </div>

        <div className="panel-card">
          <h3>Manual / test clock</h3>
          {message && <div className="alert alert-info">{message}</div>}
          {services.length === 0 || members.length === 0 ? (
            <p className="empty-hint">
              Add at least one service and one member first.
            </p>
          ) : (
            <form action={kioskClock}>
              <input type="hidden" name="client_event_id" id="client_event_id" />
              <div className="grid-2">
                <div className="field">
                  <label>Service</label>
                  <select name="service_id" required>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} · {new Date(s.starts_at).toLocaleTimeString()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Member</label>
                  <select name="member_id" required>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.last_name}, {m.first_name} ({m.member_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                <input type="checkbox" name="force_offline" value="1" />
                Simulate offline (queue instead of live write)
              </label>
              <div className="row-actions">
                <button
                  className="btn btn-accent"
                  type="submit"
                  name="action"
                  value="clock_in"
                  onClick={() => {
                    const el = document.getElementById(
                      "client_event_id",
                    ) as HTMLInputElement | null;
                    if (el && window.APCSync) el.value = window.APCSync.uuid();
                  }}
                >
                  Clock in
                </button>
                <button
                  className="btn btn-outline"
                  type="submit"
                  name="action"
                  value="clock_out"
                >
                  Clock out
                </button>
                <button className="btn btn-outline" type="button" onClick={flush}>
                  Flush local queue
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div>
        <div className="panel-card" style={{ marginBottom: "1rem" }}>
          <h3>Device</h3>
          {!device ? (
            <p className="empty-hint">No device seeded. Run npm run seed.</p>
          ) : (
            <>
              <p style={{ marginBottom: 4 }}>
                <strong>{device.name}</strong>
              </p>
              <p className="empty-hint">
                {device.device_code} · {device.location || "—"}
              </p>
              <span className={`mode-badge mode-${device.mode}`}>{device.mode}</span>
            </>
          )}
        </div>
        <div className="panel-card">
          <h3>Hybrid mode</h3>
          <ul style={{ fontSize: "0.9rem", margin: 0, paddingLeft: "1.1rem" }}>
            <li>
              <strong>Online</strong> — attendance writes to MongoDB now.
            </li>
            <li>
              <strong>Offline</strong> — event goes to SyncQueue / IndexedDB.
            </li>
            <li>
              <strong>Reconnect</strong> — browser flushes queue to{" "}
              <code>/api/sync/push</code>.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
