"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-purple-50 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl border border-gray-100 shadow-sm">
        <Link href="/" className="text-sky-600 font-semibold text-lg mb-6 block">
          ConversionCRM
        </Link>

        {sent ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-4">📬</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h2>
            <p className="text-gray-500 text-sm">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign in</h1>
            <p className="text-gray-500 text-sm mb-6">
              We'll send you a magic link — no password required.
            </p>

            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourcompany.com"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                {loading ? "Sending…" : "Send magic link"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
