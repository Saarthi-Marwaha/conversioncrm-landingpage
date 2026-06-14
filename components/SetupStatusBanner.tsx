import Link from "next/link";

/**
 * Non-dismissible setup status bar shown at the very top of the dashboard when
 * the workspace hasn't set its key-feature (aha-moment) link yet. Without it,
 * onboarding nudges, the aha-moment score and lifecycle emails can't target the
 * right action — so we surface it persistently until it's filled in.
 */
export function SetupStatusBanner() {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex items-center gap-2.5">
        {/* Pulsing status symbol */}
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
        <span className="text-sm font-semibold text-amber-800">
          Setup incomplete
        </span>
        <span className="text-sm text-amber-700">
          Add your key-feature (aha-moment) link so onboarding nudges, scoring
          and lifecycle emails know what to point users at.
        </span>
      </div>
      <Link
        href="/dashboard/settings#aha"
        className="shrink-0 rounded-md bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
      >
        Complete setup →
      </Link>
    </div>
  );
}
