"use client";

import { useEffect, useRef, useState } from "react";
import {
  clearMemberThumbprint,
  enrollMemberThumbprint,
} from "@/app/actions";
import { descriptorFromCanvas } from "@/lib/thumbprint";

export function ThumbEnroll({
  memberId,
  enrolled,
  memberName,
}: {
  memberId: string;
  enrolled: boolean;
  memberName: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [status, setStatus] = useState(
    enrolled ? "Thumbprint already enrolled." : "Press and roll thumb on the pad.",
  );
  const [busy, setBusy] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(enrolled);

  useEffect(() => {
    clearPad();
  }, []);

  function clearPad() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#f4f7fc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(11, 61, 145, 0.2)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height / 2, 70, 90, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function pointerPos(
    e: React.PointerEvent<HTMLCanvasElement>,
  ): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawingRef.current = true;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = pointerPos(e);
    ctx.strokeStyle = "#1a2740";
    ctx.lineWidth = Math.max(10, (e.pressure || 0.5) * 22);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineWidth = Math.max(10, (e.pressure || 0.5) * 22);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    setStatus("Reading thumbprint…");
    try {
      const descriptor = descriptorFromCanvas(canvas);
      if (!descriptor) {
        setStatus("Impression too light. Press firmly and roll your thumb.");
        return;
      }
      const res = await enrollMemberThumbprint(memberId, descriptor);
      if (!res.ok) {
        setStatus(res.error || "Failed to save thumbprint.");
        return;
      }
      setIsEnrolled(true);
      setStatus(`Thumbprint enrolled for ${memberName}.`);
      clearPad();
    } finally {
      setBusy(false);
    }
  }

  async function clearEnrollment() {
    setBusy(true);
    try {
      const res = await clearMemberThumbprint(memberId);
      if (!res.ok) {
        setStatus(res.error || "Failed to clear thumbprint.");
        return;
      }
      setIsEnrolled(false);
      setStatus("Thumbprint enrollment cleared.");
      clearPad();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel-card face-enroll" style={{ marginTop: "1rem" }}>
      <h3>Thumbprint enrollment</h3>
      <p className="empty-hint" style={{ marginBottom: "0.75rem" }}>
        Press and roll your thumb on the pad (touch or mouse). Use the same
        thumb each time for best matching.
      </p>
      <div className="thumb-pad-wrap">
        <canvas
          ref={canvasRef}
          className="thumb-pad"
          width={280}
          height={320}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        {isEnrolled && (
          <span className="badge badge-ok thumb-enrolled-badge">Enrolled</span>
        )}
      </div>
      <p className="face-status">{status}</p>
      <div className="row-actions">
        <button
          type="button"
          className="btn btn-accent"
          onClick={save}
          disabled={busy}
        >
          Capture &amp; save
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={clearPad}
          disabled={busy}
        >
          Clear pad
        </button>
        {isEnrolled && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={clearEnrollment}
            disabled={busy}
          >
            Clear thumbprint
          </button>
        )}
      </div>
    </div>
  );
}
