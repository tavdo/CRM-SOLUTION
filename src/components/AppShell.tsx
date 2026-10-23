"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  LayoutDashboard,
  Users,
  Kanban,
  CheckSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
} from "lucide-react";
import { signOutAction, switchWorkspaceAction } from "@/app/actions/auth";
import { LanguageSwitcher } from "./LanguageSwitcher";

type Workspace = { id: string; name: string };
type NavLabels = {
  dashboard: string;
  customers: string;
  deals: string;
  tasks: string;
  settings: string;
  signOut: string;
  workspace: string;
  switchWorkspace: string;
  menu: string;
};

export function AppShell({
  locale,
  brand,
  labels,
  userName,
  workspaces,
  activeCompanyId,
  children,
}: {
  locale: string;
  brand: string;
  labels: NavLabels;
  userName: string;
  workspaces: Workspace[];
  activeCompanyId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const items = [
    { href: `/${locale}/dashboard`, label: labels.dashboard, icon: LayoutDashboard },
    { href: `/${locale}/customers`, label: labels.customers, icon: Users },
    { href: `/${locale}/deals`, label: labels.deals, icon: Kanban },
    { href: `/${locale}/tasks`, label: labels.tasks, icon: CheckSquare },
    { href: `/${locale}/settings`, label: labels.settings, icon: Settings },
  ];

  const activeWorkspace = workspaces.find((w) => w.id === activeCompanyId) ?? workspaces[0];

  return (
    <div className="app-frame">
      {/* Desktop Command Sidebar */}
      <aside className="app-sidebar">
        <Link href={`/${locale}/dashboard`} className="app-brand-row">
          <span className="app-brand-mark">CS</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff", lineHeight: 1.15 }}>
              {brand}
            </div>
            <div className="muted" style={{ fontSize: "0.72rem" }}>
              {activeWorkspace?.name}
            </div>
          </div>
        </Link>

        {workspaces.length > 1 ? (
          <div style={{ padding: "0 0.25rem" }}>
            <label className="sr-only" htmlFor="sidebar-workspace">
              {labels.switchWorkspace}
            </label>
            <select
              id="sidebar-workspace"
              className="select"
              style={{ fontSize: "0.8rem", padding: "0.45rem 0.65rem" }}
              defaultValue={activeCompanyId}
              disabled={pending}
              onChange={(e) => {
                const companyId = e.target.value;
                startTransition(() => {
                  void switchWorkspaceAction(companyId, locale);
                });
              }}
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <nav className="app-nav" aria-label="Main">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`app-nav-link ${active ? "active" : ""}`}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div
          style={{
            marginTop: "auto",
            paddingTop: "0.85rem",
            borderTop: "1px solid var(--line)",
            display: "grid",
            gap: "0.6rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
              padding: "0 0.35rem",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "#fff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {userName}
              </div>
              <div className="muted" style={{ fontSize: "0.72rem" }}>
                {activeWorkspace?.name}
              </div>
            </div>
            <LanguageSwitcher locale={locale} />
          </div>

          <form action={signOutAction}>
            <button
              type="submit"
              className="btn btn-secondary"
              style={{ width: "100%", justifyContent: "flex-start", padding: "0.5rem 0.7rem" }}
            >
              <LogOut size={15} />
              <span>{labels.signOut}</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Column */}
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header className="app-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-secondary mobile-only"
              style={{ padding: "0.45rem 0.65rem" }}
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-nav"
            >
              {open ? <X size={16} /> : <Menu size={16} />}
              <span>{labels.menu}</span>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Building2 size={15} className="muted" />
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink-secondary)" }}>
                {activeWorkspace?.name}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div className="mobile-only">
              <LanguageSwitcher locale={locale} />
            </div>
            <Link
              href={`/${locale}/customers/new`}
              className="btn btn-secondary hide-mobile"
              style={{ padding: "0.42rem 0.75rem", fontSize: "0.8rem" }}
            >
              + {labels.customers}
            </Link>
            <Link
              href={`/${locale}/deals/new`}
              className="btn btn-primary"
              style={{ padding: "0.42rem 0.85rem", fontSize: "0.8rem" }}
            >
              + {labels.deals}
            </Link>
          </div>
        </header>

        {open ? (
          <nav
            id="mobile-nav"
            className="mobile-only"
            style={{
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--line)",
              padding: "0.75rem 1rem",
              gap: "0.3rem",
            }}
          >
            {items.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`app-nav-link ${active ? "active" : ""}`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <form action={signOutAction} style={{ marginTop: "0.4rem" }}>
              <button type="submit" className="btn btn-secondary" style={{ width: "100%" }}>
                <LogOut size={15} />
                <span>{labels.signOut}</span>
              </button>
            </form>
          </nav>
        ) : null}

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
