"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import logoImage from "@/assets/logo_CRM-removebg-preview.png";
import { useEffect, useState, useTransition } from "react";
import { signOut } from "@/app/auth/actions";
import type { Workspace } from "@/types";
import { cn } from "@/lib/utils";
import { planAllows } from "@/lib/entitlements";
import type { Entitlement, PlanId } from "@/lib/plans";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Mail,
  LifeBuoy,
  CreditCard,
  BookOpen,
  MessageSquarePlus,
  Send,
  Lock,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Renders as a plain <a> (e.g. mailto) instead of a router link. */
  external?: boolean;
  /** Entitlement required to use this item; otherwise it renders locked. */
  requires?: Entitlement;
  /** Badge shown on a locked item (the lowest plan that unlocks it). */
  lockLabel?: string;
};

const CONTACT_EMAIL = "ceo.conversioncrm@gmail.com";

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/users", label: "Users", icon: Users },
  {
    href: "/dashboard/composer",
    label: "Email Composer",
    icon: Mail,
    requires: "custom_composer",
    lockLabel: "Basic",
  },
  { href: "/dashboard/guide", label: "Guide", icon: BookOpen },
  { href: "/dashboard/feedback", label: "Feedback", icon: MessageSquarePlus },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
  {
    href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      "ConversionCRM — Contact"
    )}`,
    label: "Contact",
    icon: Send,
    external: true,
    requires: "priority_access",
    lockLabel: "Scale",
  },
];

interface Props {
  workspace: Workspace | null;
  userEmail: string;
}

function Logo({ workspace }: { workspace: Workspace | null }) {
  return (
    <div className="min-w-0 flex items-center gap-2">
      <Image
        src={logoImage}
        alt="ConversionCRM logo"
        className="h-6 w-auto flex-shrink-0"
        priority
      />
      <div className="min-w-0">
        <span className="font-bold text-gray-900 text-sm block leading-tight">
          Conversion CRM
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
  plan,
  onNavigate,
}: {
  pathname: string;
  plan: PlanId | null;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 px-2 py-4 space-y-1">
      {NAV_ITEMS.map((item) => {
        const { href, label, icon: Icon, external, requires, lockLabel } = item;
        const locked = !!requires && !planAllows(plan, requires);

        const base =
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors";

        // Locked: greyed out, a lock + plan badge, click goes to /pricing.
        if (locked) {
          return (
            <Link
              key={href}
              href="/pricing"
              onClick={onNavigate}
              title={`Available on ${lockLabel} and above`}
              className={cn(base, "text-gray-300 hover:bg-gray-50 hover:text-gray-400")}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">
                <Lock className="h-2.5 w-2.5" />
                {lockLabel}
              </span>
            </Link>
          );
        }

        const className = cn(
          base,
          !external &&
            (href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href))
            ? "bg-sky-50 text-sky-800"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        );

        // mailto / external opens the user's mail client directly.
        if (external) {
          return (
            <a key={href} href={href} onClick={onNavigate} className={className}>
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </a>
          );
        }

        return (
          <Link key={href} href={href} onClick={onNavigate} className={className}>
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
  const plan = (workspace?.plan as PlanId | null) ?? null;

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
            className="p-2 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
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
                className="p-2 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks
              pathname={pathname}
              plan={plan}
              onNavigate={() => setOpen(false)}
            />
            {footer}
          </div>
        </div>
      )}

      {/* ── Desktop sidebar ────────────────────────── */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 bg-white shadow-soft flex-col h-full">
        <div className="px-4 py-5">
          <Logo workspace={workspace} />
        </div>
        <NavLinks pathname={pathname} plan={plan} />
        {footer}
      </aside>
    </>
  );
}
