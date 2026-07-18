"use client";

import { useEffect, useRef, useState } from "react";
import {
  detectAllFaces,
  loadFaceModels,
  matchFace,
  type EnrolledFace,
  type FaceMatch,
} from "@/lib/face";
import {
  descriptorFromCanvas,
  matchThumbprint,
  type EnrolledThumb,
  type ThumbMatch,
} from "@/lib/thumbprint";
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
  enrolledFaces,
  enrolledThumbs,
}: {
  members: Member[];
  services: Service[];
  device: Device;
  enrolledFaces: EnrolledFace[];
  enrolledThumbs: EnrolledThumb[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thumbCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const drawingRef = useRef(false);

  const [session, setSession] = useState<"face" | "thumb">("face");
  const [mode, setMode] = useState<"online" | "offline">("online");
  const [message, setMessage] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState("Camera off");
  const [cameraOn, setCameraOn] = useState(false);
  const [match, setMatch] = useState<FaceMatch | null>(null);
  const [thumbMatch, setThumbMatch] = useState<ThumbMatch | null>(null);
  const [thumbStatus, setThumbStatus] = useState(
    "Press and roll thumb on the pad, then Scan.",
  );
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [manualMemberId, setManualMemberId] = useState(members[0]?.id ?? "");

  useEffect(() => {
    const apply = () => setMode(navigator.onLine ? "online" : "offline");
    apply();
    window.addEventListener("online", apply);
    window.addEventListener("offline", apply);

    const script = document.createElement("script");
    script.src = "/sync.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      window.removeEventListener("online", apply);
      window.removeEventListener("offline", apply);
      scanningRef.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (session === "thumb") {
      stopCamera();
      clearThumbPad();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!cameraOn || session !== "face") return;
    let alive = true;
    scanningRef.current = true;

    const loop = async () => {
      while (alive && scanningRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState >= 2) {
          try {
            const faces = await detectAllFaces(video);
            const ctx = canvas.getContext("2d");
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              for (const face of faces) {
                ctx.strokeStyle = "#f5c518";
                ctx.lineWidth = 3;
                ctx.strokeRect(
                  face.box.x,
                  face.box.y,
                  face.box.width,
                  face.box.height,
                );
              }
            }

            if (faces.length === 0) {
              setMatch(null);
              setCameraStatus("Looking for a face…");
            } else if (faces.length > 1) {
              setMatch(null);
              setCameraStatus("Multiple faces detected — one person at a time");
            } else if (!enrolledFaces.length) {
              setMatch(null);
              setCameraStatus("No enrolled faces yet. Enroll members first.");
            } else {
              const found = matchFace(faces[0].descriptor, enrolledFaces);
              if (found) {
                setMatch(found);
                setCameraStatus(
                  `Matched: ${found.label} (${(1 - found.distance).toFixed(2)} confidence)`,
                );
              } else {
                setMatch(null);
                setCameraStatus("Face seen — no enrolled match");
              }
            }
          } catch {
            setCameraStatus("Detection error — retrying…");
          }
        }
        await new Promise((r) => setTimeout(r, 450));
      }
    };

    void loop();
    return () => {
      alive = false;
      scanningRef.current = false;
    };
  }, [cameraOn, enrolledFaces, session]);

  async function startCamera() {
    setCameraStatus("Loading face models…");
    try {
      await loadFaceModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      setCameraStatus("Camera ready");
    } catch (err) {
      setCameraStatus(
        err instanceof Error ? err.message : "Could not start camera",
      );
    }
  }

  function stopCamera() {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setMatch(null);
    setCameraStatus("Camera off");
  }

  function clearThumbPad() {
    const canvas = thumbCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#f4f7fc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(11, 61, 145, 0.25)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height / 2, 70, 90, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    setThumbMatch(null);
    setThumbStatus("Press and roll thumb on the pad, then Scan.");
  }

  function thumbPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = thumbCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onThumbDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = thumbCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawingRef.current = true;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = thumbPos(e);
    ctx.strokeStyle = "#1a2740";
    ctx.lineWidth = Math.max(10, (e.pressure || 0.5) * 22);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function onThumbMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = thumbCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = thumbPos(e);
    ctx.lineWidth = Math.max(10, (e.pressure || 0.5) * 22);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function onThumbUp(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    try {
      thumbCanvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function scanThumb() {
    const canvas = thumbCanvasRef.current;
    if (!canvas) return;
    if (!enrolledThumbs.length) {
      setThumbStatus("No enrolled thumbprints yet. Enroll members first.");
      setThumbMatch(null);
      return;
    }
    const descriptor = descriptorFromCanvas(canvas);
    if (!descriptor) {
      setThumbStatus("Impression too light. Press firmly and try again.");
      setThumbMatch(null);
      return;
    }
    const found = matchThumbprint(descriptor, enrolledThumbs);
    if (found) {
      setThumbMatch(found);
      setThumbStatus(
        `Matched: ${found.label} (distance ${found.distance.toFixed(3)})`,
      );
    } else {
      setThumbMatch(null);
      setThumbStatus("No enrolled thumbprint match. Clear pad and retry.");
    }
  }

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

  function fillEventId(form: HTMLFormElement) {
    const el = form.querySelector(
      'input[name="client_event_id"]',
    ) as HTMLInputElement | null;
    if (el && window.APCSync) el.value = window.APCSync.uuid();
  }

  return (
    <div className="grid-2">
      <div>
        <div className="panel-card" style={{ marginBottom: "1rem" }}>
          <div className="kiosk-tabs">
            <button
              type="button"
              className={`kiosk-tab ${session === "face" ? "is-active" : ""}`}
              onClick={() => setSession("face")}
            >
              Face session
            </button>
            <button
              type="button"
              className={`kiosk-tab ${session === "thumb" ? "is-active" : ""}`}
              onClick={() => setSession("thumb")}
            >
              Thumbprint session
            </button>
          </div>

          <div className="row-actions" style={{ marginBottom: "0.75rem" }}>
            <span className={`mode-badge mode-${mode}`}>
              {mode === "online" ? "Online" : "Offline"}
            </span>
            <span className="badge badge-ok">
              {enrolledFaces.length} face(s)
            </span>
            <span className="badge badge-ok">
              {enrolledThumbs.length} thumb(s)
            </span>
          </div>

          {session === "face" ? (
            <>
              <div className="face-video-wrap kiosk-face-wrap">
                <video ref={videoRef} className="face-video" muted playsInline />
                <canvas ref={canvasRef} className="face-overlay" />
                {!cameraOn && (
                  <div className="face-video-placeholder">
                    <h2
                      style={{ margin: "0 0 0.35rem", color: "var(--blue-deep)" }}
                    >
                      Facial clock-in
                    </h2>
                    <p className="empty-hint" style={{ margin: 0 }}>
                      Start the camera, stand in frame, then clock in when
                      matched.
                    </p>
                  </div>
                )}
              </div>

              <p className="face-status">{cameraStatus}</p>
              {match && (
                <div className="alert alert-success face-match-banner">
                  Recognized <strong>{match.label}</strong>
                </div>
              )}

              <div className="row-actions" style={{ marginBottom: "1rem" }}>
                {!cameraOn ? (
                  <button
                    type="button"
                    className="btn btn-accent"
                    onClick={startCamera}
                  >
                    Start camera
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={stopCamera}
                  >
                    Stop camera
                  </button>
                )}
              </div>

              <form
                action={kioskClock}
                onSubmit={(e) => fillEventId(e.currentTarget)}
              >
                <input type="hidden" name="client_event_id" />
                <input type="hidden" name="verify_method" value="face" />
                <input type="hidden" name="member_id" value={match?.id ?? ""} />
                <div className="field">
                  <label>Service</label>
                  <select
                    name="service_id"
                    required
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} · {new Date(s.starts_at).toLocaleTimeString()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="row-actions">
                  <button
                    className="btn btn-accent"
                    type="submit"
                    name="action"
                    value="clock_in"
                    disabled={!match || !serviceId}
                  >
                    Face clock in
                  </button>
                  <button
                    className="btn btn-outline"
                    type="submit"
                    name="action"
                    value="clock_out"
                    disabled={!match || !serviceId}
                  >
                    Face clock out
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="thumb-pad-wrap kiosk-thumb-wrap">
                <canvas
                  ref={thumbCanvasRef}
                  className="thumb-pad"
                  width={280}
                  height={320}
                  onPointerDown={onThumbDown}
                  onPointerMove={onThumbMove}
                  onPointerUp={onThumbUp}
                  onPointerLeave={onThumbUp}
                />
              </div>
              <p className="face-status">{thumbStatus}</p>
              {thumbMatch && (
                <div className="alert alert-success face-match-banner">
                  Recognized <strong>{thumbMatch.label}</strong>
                </div>
              )}
              <div className="row-actions" style={{ marginBottom: "1rem" }}>
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={scanThumb}
                >
                  Scan thumbprint
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={clearThumbPad}
                >
                  Clear pad
                </button>
              </div>

              <form
                action={kioskClock}
                onSubmit={(e) => fillEventId(e.currentTarget)}
              >
                <input type="hidden" name="client_event_id" />
                <input type="hidden" name="verify_method" value="thumbprint" />
                <input
                  type="hidden"
                  name="member_id"
                  value={thumbMatch?.id ?? ""}
                />
                <div className="field">
                  <label>Service</label>
                  <select
                    name="service_id"
                    required
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} · {new Date(s.starts_at).toLocaleTimeString()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="row-actions">
                  <button
                    className="btn btn-accent"
                    type="submit"
                    name="action"
                    value="clock_in"
                    disabled={!thumbMatch || !serviceId}
                  >
                    Thumb clock in
                  </button>
                  <button
                    className="btn btn-outline"
                    type="submit"
                    name="action"
                    value="clock_out"
                    disabled={!thumbMatch || !serviceId}
                  >
                    Thumb clock out
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        <div className="panel-card">
          <h3>Manual / test clock</h3>
          {message && <div className="alert alert-info">{message}</div>}
          {services.length === 0 || members.length === 0 ? (
            <p className="empty-hint">
              Add at least one service and one member first.
            </p>
          ) : (
            <form
              action={kioskClock}
              onSubmit={(e) => fillEventId(e.currentTarget)}
            >
              <input type="hidden" name="client_event_id" />
              <input type="hidden" name="verify_method" value="manual" />
              <div className="grid-2">
                <div className="field">
                  <label>Service</label>
                  <select
                    name="service_id"
                    required
                    defaultValue={services[0]?.id}
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} · {new Date(s.starts_at).toLocaleTimeString()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Member</label>
                  <select
                    name="member_id"
                    required
                    value={manualMemberId}
                    onChange={(e) => setManualMemberId(e.target.value)}
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.last_name}, {m.first_name} ({m.member_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <input type="checkbox" name="force_offline" value="1" />
                Simulate offline (queue instead of live write)
              </label>
              <div className="row-actions">
                <button
                  className="btn btn-accent"
                  type="submit"
                  name="action"
                  value="clock_in"
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
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={flush}
                >
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
              <span className={`mode-badge mode-${device.mode}`}>
                {device.mode}
              </span>
            </>
          )}
        </div>
        <div className="panel-card">
          <h3>Biometric sessions</h3>
          <ul style={{ fontSize: "0.9rem", margin: 0, paddingLeft: "1.1rem" }}>
            <li>
              Enroll face and thumb under{" "}
              <strong>Members → Edit</strong>.
            </li>
            <li>
              <strong>Face session</strong> — camera match, then clock in/out.
            </li>
            <li>
              <strong>Thumbprint session</strong> — press pad, Scan, then clock
              in/out.
            </li>
            <li>Manual select remains available as a fallback.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
