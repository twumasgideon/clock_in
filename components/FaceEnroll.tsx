"use client";

import { useEffect, useRef, useState } from "react";
import { clearMemberFace, enrollMemberFace } from "@/app/actions";
import { detectSingleFace, loadFaceModels } from "@/lib/face";

export function FaceEnroll({
  memberId,
  enrolled,
  memberName,
}: {
  memberId: string;
  enrolled: boolean;
  memberName: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturingRef = useRef(false);
  const stableRef = useRef(0);
  const [status, setStatus] = useState<string>(
    enrolled ? "Face already enrolled." : "Camera off.",
  );
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(enrolled);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!cameraOn || isEnrolled) return;
    let alive = true;

    const loop = async () => {
      while (alive && !capturingRef.current) {
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          try {
            const face = await detectSingleFace(video);
            if (face) {
              stableRef.current += 1;
              setStatus(
                `Face found — hold still (${stableRef.current}/3)…`,
              );
              if (stableRef.current >= 3) {
                await autoCapture(face.descriptor);
                break;
              }
            } else {
              stableRef.current = 0;
              setStatus("Looking for your face… center in the frame");
            }
          } catch {
            setStatus("Detection error — retrying…");
          }
        }
        await new Promise((r) => setTimeout(r, 280));
      }
    };

    void loop();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn, isEnrolled, memberId, memberName]);

  async function autoCapture(descriptor: Float32Array) {
    if (capturingRef.current) return;
    capturingRef.current = true;
    setBusy(true);
    setStatus("Face captured — saving…");
    try {
      const res = await enrollMemberFace(memberId, Array.from(descriptor));
      if (!res.ok) {
        setStatus(res.error || "Failed to save face.");
        capturingRef.current = false;
        stableRef.current = 0;
        return;
      }
      setIsEnrolled(true);
      setStatus(`Enrolled face for ${memberName}.`);
      stopCamera();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Capture failed.");
      capturingRef.current = false;
      stableRef.current = 0;
    } finally {
      setBusy(false);
    }
  }

  async function startCamera() {
    setBusy(true);
    setStatus("Loading face models…");
    capturingRef.current = false;
    stableRef.current = 0;
    try {
      const [, stream] = await Promise.all([
        loadFaceModels(),
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 320 },
            height: { ideal: 240 },
          },
          audio: false,
        }),
      ]);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      setStatus("Looking for your face… it will capture automatically");
    } catch (err) {
      setStatus(
        err instanceof Error
          ? err.message
          : "Could not start camera or load models.",
      );
    } finally {
      setBusy(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    capturingRef.current = false;
    stableRef.current = 0;
    setStatus(isEnrolled ? "Face already enrolled." : "Camera off.");
  }

  async function clearFace() {
    setBusy(true);
    try {
      const res = await clearMemberFace(memberId);
      if (!res.ok) {
        setStatus(res.error || "Failed to clear face.");
        return;
      }
      setIsEnrolled(false);
      setStatus("Face enrollment cleared.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel-card face-enroll" style={{ marginTop: "1rem" }}>
      <h3>Face enrollment</h3>
      <p className="empty-hint" style={{ marginBottom: "0.75rem" }}>
        Start the camera and hold your face in frame — it captures
        automatically when a clear face is found.
      </p>
      <div className="face-video-wrap">
        <video ref={videoRef} className="face-video" muted playsInline />
        {!cameraOn && (
          <div className="face-video-placeholder">
            {isEnrolled ? (
              <span className="badge badge-ok">Face enrolled</span>
            ) : (
              <span className="badge badge-muted">Not enrolled</span>
            )}
          </div>
        )}
      </div>
      <p className="face-status">{status}</p>
      <div className="row-actions">
        {!cameraOn ? (
          <button
            type="button"
            className="btn btn-accent"
            onClick={startCamera}
            disabled={busy}
          >
            {isEnrolled ? "Re-enroll face" : "Start camera"}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-outline"
            onClick={stopCamera}
            disabled={busy}
          >
            Stop camera
          </button>
        )}
        {isEnrolled && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={clearFace}
            disabled={busy}
          >
            Clear face
          </button>
        )}
      </div>
    </div>
  );
}
