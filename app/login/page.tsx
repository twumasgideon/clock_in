"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@asokwa.church");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid credentials or inactive account.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="eyebrow" style={{ color: "var(--ink-soft)" }}>
          Asokwa Pentecost Church
        </p>
        <h1>Sign in</h1>
        <p style={{ color: "var(--ink-soft)", marginBottom: "1.25rem" }}>
          Member attendance · face + thumbprint · online &amp; offline
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn btn-accent" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Signing in…" : "Continue"}
          </button>
        </form>
        <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)", marginTop: "1rem" }}>
          Default after seed: admin@asokwa.church / Admin@12345
        </p>
      </div>
    </div>
  );
}
