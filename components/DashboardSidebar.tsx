"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { signOut } from "@/app/auth/actions";
import type { Workspace } from "@/types";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Zap,
  Mail,
  LifeBuoy,
  CreditCard,
  BookOpen,
  Menu,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/users", label: "Users", icon: Users },
  { href: "/dashboard/composer", label: "Email Composer", icon: Mail },
  { href: "/dashboard/guide", label: "Guide", icon: BookOpen },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
];

interface Props {
  workspace: Workspace | null;
  userEmail: string;
}

function Logo({ workspace }: { workspace: Workspace | null }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="bg-sky-500 text-white p-1.5 rounded-lg flex-shrink-0">
        <Zap className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <span className="font-bold text-gray-900 text-sm block leading-tight">
          ConversionCRM
        </span>
        {workspace && (
          <span className="text-[11px] text-gray-400 block truncate leading-tight">
            {workspace.name}
          </span>
        )}
      </div>
    </div>
  );
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 px-2 py-4 space-y-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
              active
                ? "bg-sky-50 text-sky-800"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardSidebar({ workspace, userEmail }: Props) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
    });
  }

  const footer = (
    <div className="px-4 py-4">
      <p className="text-xs text-gray-400 truncate mb-2">{userEmail}</p>
      <button
        onClick={handleSignOut}
        disabled={pending}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
      >
        <LogOut className="h-3.5 w-3.5" />
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-40 bg-white/90 backdrop-blur shadow-soft">
        <div className="flex items-center justify-between px-4 h-14">
          <Logo workspace={workspace} />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ── Mobile drawer ──────────────────────────── */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-card-lg flex flex-col">
            <div className="flex items-center justify-between px-4 h-14">
              <Logo workspace={workspace} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            {footer}
          </div>
        </div>
      )}

      {/* ── Desktop sidebar ────────────────────────── */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 bg-white shadow-soft flex-col h-full">
        <div className="px-4 py-5">
          <Logo workspace={workspace} />
        </div>
        <NavLinks pathname={pathname} />
        {footer}
      </aside>
    </>
  );
}
