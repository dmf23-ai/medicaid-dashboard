"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Shield } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        // Replace so the login page isn't in history.
        router.replace(next);
        router.refresh();
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Unable to sign in.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg-deep)" }}
    >
      <div
        className="w-full max-w-md rounded-xl p-8 shadow-2xl"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              background: "var(--texas-glow)",
              border: "1px solid var(--texas-primary)",
            }}
          >
            <Shield
              className="w-5 h-5"
              style={{ color: "var(--texas-primary)" }}
            />
          </div>
          <div>
            <div
              className="text-xs uppercase tracking-widest font-semibold"
              style={{ color: "var(--text-tertiary)" }}
            >
              Restricted Access
            </div>
            <div
              className="text-lg font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Medicaid Intelligence Dashboard
            </div>
          </div>
        </div>

        <p
          className="text-sm mb-6 leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          This site contains an internal preview. Enter the shared access
          password to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span
              className="block text-xs uppercase tracking-wider mb-2"
              style={{ color: "var(--text-tertiary)" }}
            >
              Password
            </span>
            <div className="relative">
              <Lock
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                required
                className="w-full rounded-md py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2"
                style={{
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                }}
              />
            </div>
          </label>

          {error && (
            <div
              className="rounded-md px-3 py-2 text-sm"
              style={{
                background: "var(--accent-red-dim)",
                color: "#FCA5A5",
                border: "1px solid var(--accent-red)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending || password.length === 0}
            className="w-full rounded-md py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "var(--texas-primary)",
              color: "#0B1120",
            }}
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p
          className="text-xs mt-6 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          Sessions remain active for 7 days.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
