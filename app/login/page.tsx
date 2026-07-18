"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandBanner } from "@/components/BrandBanner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@kasse.church");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        if (res.error === "CredentialsSignin") {
          setError("Invalid credentials or inactive account.");
        } else {
          setError(
            `Sign-in failed (${res.error}). Check AUTH_SECRET, AUTH_URL, and MongoDB on Vercel.`,
          );
        }
        return;
      }
      if (!res?.ok) {
        setError("Sign-in failed. Please try again.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error during sign-in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <BrandBanner />
      <div className="auth-card">
        <h2 className="auth-heading">Sign in</h2>
        <p className="auth-lead">
          Clock in &amp; out · online &amp; offline · face + thumbprint ready
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
        <p className="auth-hint">
          Default after seed: admin@kasse.church / Admin@12345
        </p>
      </div>
    </div>
  );
}
