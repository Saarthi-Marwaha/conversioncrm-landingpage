import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-purple-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 bg-sky-100 text-sky-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
          MVP Foundation
        </div>

        <h1 className="text-5xl font-bold text-gray-900 mb-4 leading-tight">
          ConversionCRM
        </h1>
        <p className="text-xl text-gray-600 mb-8 leading-relaxed">
          Turn free-trial users into paying customers — automatically. One embed,
          zero manual work, full conversion visibility.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Open Dashboard
          </Link>
          <Link
            href="/auth/login"
            className="bg-white hover:bg-gray-50 text-gray-700 font-semibold px-6 py-3 rounded-lg border border-gray-200 transition-colors"
          >
            Sign In
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          {[
            {
              title: "One-line embed",
              desc: 'Add <script src="widget.js?api_key=xyz"> and tracking starts instantly.',
            },
            {
              title: "Engagement score 0–100",
              desc: "Every user gets a real-time score based on logins, features used, and page visits.",
            },
            {
              title: "Automated nudges",
              desc: "Welcome, feature nudge, upgrade offer, churn prevention — sent at the perfect moment.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
