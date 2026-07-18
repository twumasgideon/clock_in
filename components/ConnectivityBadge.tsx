"use client";

import { useEffect, useState } from "react";

export function ConnectivityBadge() {
  const [mode, setMode] = useState<"online" | "offline" | "unknown">("unknown");

  useEffect(() => {
    const apply = () => setMode(navigator.onLine ? "online" : "offline");
    apply();
    window.addEventListener("online", apply);
    window.addEventListener("offline", apply);
    return () => {
      window.removeEventListener("online", apply);
      window.removeEventListener("offline", apply);
    };
  }, []);

  const label =
    mode === "online" ? "Online" : mode === "offline" ? "Offline" : "Checking…";

  return <span className={`mode-badge mode-${mode}`}>{label}</span>;
}
