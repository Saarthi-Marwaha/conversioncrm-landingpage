import Link from "next/link";
import { signIn } from "@/app/auth/actions";

interface Props {
  searchParams: { error?: string; next?: string };
}

export default function LoginPage({ searchParams }: Props) {
  const error = searchParams.error;
  const next = searchParams.next ?? "/dashboard";

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-purple-50 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl border border-gray-100 shadow-sm">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mb-8">
          <div className="bg-sky-600 text-white p-1.5 rounded-lg">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-gray-900">ConversionCRM</span>
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in to your account</p>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}

        <form action={signIn} className="space-y-4">
          {/* Pass the intended destination through */}
          <input type="hidden" name="next" value={next} />

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-sky-600 font-medium hover:underline">
            Sign up free
          </Link>
        </p>
      </div>
    </main>
  );
}
