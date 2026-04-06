"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function HubSetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const nextUrl = searchParams.get("next") || "/hub";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/hub/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Token already used (e.g. browser back after success) — just go to login
        if (res.status === 400) {
          window.location.href = "/hub/login";
          return;
        }
        setError(data.error || "Failed to set password. The link may have expired.");
        return;
      }

      // Auto-login: the API sets the cookie, go straight to destination
      window.location.href = nextUrl;
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-brand-verde">
        <div className="bg-brand-creme rounded-2xl shadow-sm p-8 text-center max-w-sm">
          <p className="text-brand-verde mb-4">Invalid or missing token.</p>
          <Link href="/hub/login" className="text-sm hover:underline text-brand-verde hover:text-brand-verde/80">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-brand-verde">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <Logo className="w-16 h-16 mx-auto mb-5" />
          <h1 className="font-display text-3xl font-bold text-white">Set Your Password</h1>
          <p className="text-white/60 text-sm mt-2">Choose a secure password for your account</p>
        </div>

        <div className="bg-brand-creme rounded-2xl shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-verde mb-1.5">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-brand-verde focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-verde mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-brand-verde focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
              />
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-center text-white font-semibold transition disabled:opacity-60 bg-brand-tangerina hover:bg-brand-tangerina/90"
            >
              {loading ? "Saving..." : "Set Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
