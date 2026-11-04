"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { LayoutDashboard, Inbox, Users, Kanban, FileSpreadsheet, Package, CheckSquare,
  CalendarDays, Headset, Bot, Settings, LogOut, Menu, X, Building2, ChevronDown,
  Search, Plus, PanelsTopLeft, type LucideIcon } from "lucide-react";
import { signOutAction, switchWorkspaceAction } from "@/app/actions/auth";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { BrandLogo } from "./BrandLogo";
import brandStyles from "./BrandLogo.module.css";

type Workspace = { id: string; name: string };
type NavLabels = Record<"projects" | "tools" | "dashboard" | "leads" | "customers" |
  "deals" | "invoices" | "products" | "tasks" | "calendar" | "contactCenter" |
  "automations" | "settings" | "signOut" | "workspace" | "switchWorkspace" | "menu" | "inbox", string>;
type NavItem = { path: string; label: string; icon: LucideIcon; badge?: number };

export function AppShell({ locale, brand, labels, userName, workspaces, activeCompanyId,
  newLeadsCount = 0, canManageAutomations = false, canManageConstruction = false,
  canManageMembers = false, canUseInbox = false, children,
}: {
  locale: string; brand: string; labels: NavLabels; userName: string;
  workspaces: Workspace[]; activeCompanyId: string; newLeadsCount?: number;
  canManageAutomations?: boolean; canManageConstruction?: boolean;
  canManageMembers?: boolean; canUseInbox?: boolean; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("workspaceUi");
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const drawer = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const activeWorkspace = workspaces.find((w) => w.id === activeCompanyId) ?? workspaces[0];
  const href = (path: string) => `/${locale}/${path}`;
  const active = (path: string) => pathname === href(path) || pathname.startsWith(`${href(path)}/`);
  const crmItems: NavItem[] = [
    ...(canUseInbox ? [{ path: "inbox", label: labels.inbox, icon: Headset }] : []),
    { path: "deals", label: labels.deals, icon: Kanban },
    { path: "leads", label: labels.leads, icon: Inbox, badge: newLeadsCount },
    { path: "customers", label: labels.customers, icon: Users },
    { path: "invoices", label: labels.invoices, icon: FileSpreadsheet },
  ];
  const workItems: NavItem[] = [
    { path: "tasks", label: labels.tasks, icon: CheckSquare },
    { path: "calendar", label: labels.calendar, icon: CalendarDays },
    { path: "projects", label: labels.projects, icon: Building2 },
  ];
  const toolItems: NavItem[] = [
    { path: "products", label: labels.products, icon: Package },
    { path: "contact-center", label: labels.contactCenter, icon: Headset },
    ...(canManageAutomations ? [{ path: "automations", label: labels.automations, icon: Bot }] : []),
  ];
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const opener = menuButton.current;
    document.body.style.overflow = "hidden";
    drawer.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const nodes = drawer.current?.querySelectorAll<HTMLElement>("a[href],button,select,summary");
      const focusable = Array.from(nodes ?? []).filter((node) => node.getClientRects().length && !node.hasAttribute("disabled"));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const resize = () => { if (window.innerWidth > 920) setOpen(false); };
    document.addEventListener("keydown", keydown);
    window.addEventListener("resize", resize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
      window.removeEventListener("resize", resize);
      opener?.focus();
    };
  }, [open]);
  useEffect(() => { if (searchOpen) searchInput.current?.focus(); }, [searchOpen]);

  function closeSettingsMenu(event: React.MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.closest("details")?.removeAttribute("open");
    setOpen(false);
  }

  const navLink = (item: NavItem) => <Link key={item.path} href={href(item.path)}
    aria-current={active(item.path) ? "page" : undefined} title={item.label}
    className={`app-nav-link ${active(item.path) ? "active" : ""}`} onClick={() => setOpen(false)}>
    <item.icon size={21} aria-hidden="true" /><span className="nav-text">{item.label}</span>
    {!!item.badge && <span className="nav-counter">{item.badge}</span>}
  </Link>;

  function navigation(mobile: boolean) {
    return <>
      <div className="workspace-brand">
        <button type="button" className="chrome-icon" aria-label={mobile ? t("closeMenu") : t("toggleMenu")}
          aria-expanded={mobile ? open : !collapsed} onClick={() => mobile ? setOpen(false) : setCollapsed(!collapsed)}>
          {mobile ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link href={href("dashboard")} className="workspace-brand-name" title={brand}><BrandLogo name={brand} /></Link>
      </div>
      <div className="workspace-selector">
        {workspaces.length > 1 ? <>
          <label htmlFor={mobile ? "mobile-workspace" : "sidebar-workspace"} className="sr-only">{labels.switchWorkspace}</label>
          <select id={mobile ? "mobile-workspace" : "sidebar-workspace"} value={activeCompanyId} disabled={pending}
            onChange={(event) => { const id = event.target.value; startTransition(() => { void switchWorkspaceAction(id, locale); }); }}>
            {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
        </> : <span title={activeWorkspace?.name}>{activeWorkspace?.name}</span>}
      </div>
      <nav className="app-nav" aria-label={labels.menu}>
        {navLink({ path: "dashboard", label: labels.dashboard, icon: LayoutDashboard })}
        <details className="workspace-nav-group" open>
          <summary title="CRM"><Kanban size={21} aria-hidden="true" /><span className="nav-text">CRM</span><ChevronDown size={15} className="nav-chevron" /></summary>
          <div className="workspace-subnav">{crmItems.map(navLink)}</div>
        </details>
        {workItems.map(navLink)}
        <div className="nav-section-label">{labels.tools}</div>
        {toolItems.map(navLink)}
      </nav>
      <div className="workspace-sidebar-bottom">
        {collapsed && !mobile ? navLink({ path: "settings", label: labels.settings, icon: Settings }) : <details className="workspace-settings-menu"
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
          onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}>
          <summary className={`app-nav-link ${active("settings") ? "active" : ""}`}><Settings size={21} /><span>{labels.settings}</span><ChevronDown size={15} className="nav-chevron" /></summary>
          <div>
            <Link href={href("settings")} onClick={closeSettingsMenu}>{t("workspaceSettings")}</Link>
            {canManageMembers && <><Link href={href("settings#company")} onClick={closeSettingsMenu}>{t("companySettings")}</Link><Link href={href("settings#members")} onClick={closeSettingsMenu}>{t("invite")}</Link><Link href={href("settings#pipeline")} onClick={closeSettingsMenu}>{t("pipelineSettings")}</Link></>}
            <Link href={href("contact-center")} onClick={closeSettingsMenu}>{labels.contactCenter}</Link>
          </div>
        </details>}
        <div className="workspace-user"><span className="workspace-avatar" aria-hidden="true">{userName.slice(0, 1).toUpperCase()}</span>
          <span className="workspace-user-name">{userName}<small>{activeWorkspace?.name}</small></span>
          <form action={signOutAction}><button className="chrome-icon" type="submit" aria-label={labels.signOut} title={labels.signOut}><LogOut size={18} /></button></form>
        </div>
      </div>
    </>;
  }

  return <div className={`app-frame crm-workspace ${collapsed ? "nav-collapsed" : ""}`}>
    <a className="workspace-skip-link" href="#main-content">{t("skipToContent")}</a>
    <aside className="app-sidebar">{navigation(false)}</aside>
    {open && <div className="workspace-drawer-layer">
      <button className="workspace-scrim" type="button" aria-label={t("closeMenu")} onClick={() => setOpen(false)} tabIndex={-1} />
      <aside ref={drawer} id="mobile-nav" className="workspace-drawer" role="dialog" aria-modal="true" aria-label={labels.menu}>{navigation(true)}</aside>
    </div>}
    <div className="workspace-main" inert={open ? true : undefined}>
      <header className="app-topbar">
        <button ref={menuButton} type="button" className="chrome-icon workspace-mobile-menu" onClick={() => setOpen(true)}
          aria-label={labels.menu} aria-expanded={open} aria-controls="mobile-nav"><Menu size={23} /></button>
        <Link className={brandStyles.mobileLink} href={href("dashboard")} aria-label={brand}><BrandLogo name={brand} compact /></Link>
        <div className="workspace-header-actions">
          <button type="button" className="chrome-icon" aria-label={t("searchDeals")} aria-expanded={searchOpen}
            aria-controls="workspace-search" onClick={() => setSearchOpen(!searchOpen)}><Search size={21} /></button>
          {canManageMembers && <Link className="chrome-pill workspace-invite" href={href("settings#members")}><Plus size={14} />{t("invite")}</Link>}
          <Link className="workspace-avatar" href={href("settings")} title={`${userName} · ${labels.settings}`} aria-label={`${userName} · ${labels.settings}`}>{userName.slice(0, 1).toUpperCase()}</Link>
        </div>
        {searchOpen && <form id="workspace-search" className="workspace-search-popover" action={href("deals")} onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); }}>
          <label htmlFor="workspace-deal-query">{t("searchDeals")}</label>
          <div><input ref={searchInput} id="workspace-deal-query" name="q" maxLength={120} placeholder={t("searchPlaceholder")} className="input" />
            <button className="btn btn-primary" type="submit">{t("search")}</button>
            <button type="button" className="btn btn-secondary" aria-label={t("closeSearch")} onClick={() => setSearchOpen(false)}><X size={18} /></button></div>
        </form>}
      </header>
      <main id="main-content" className="app-content">{children}</main>
      <footer className="workspace-footer"><Link href={href("dashboard")} className="chrome-pill">{brand}</Link><LanguageSwitcher locale={locale} /><ThemeSwitcher /><span>© {new Date().getFullYear()} {brand}</span></footer>
    </div>
    <aside className="workspace-utility-rail" aria-label={t("quickAccess")}>
      <Link className="chrome-icon" href={href("leads")} title={labels.leads} aria-label={`${labels.leads}${newLeadsCount ? ` (${newLeadsCount})` : ""}`}><Inbox size={21} />{newLeadsCount > 0 && <span className="rail-counter">{newLeadsCount}</span>}</Link>
      <Link className="chrome-icon" href={href("tasks")} title={labels.tasks} aria-label={labels.tasks}><CheckSquare size={21} /></Link>
      <Link className="chrome-icon" href={href("calendar")} title={labels.calendar} aria-label={labels.calendar}><CalendarDays size={21} /></Link>
      <span className="rail-divider" />
      <Link className="chrome-icon" href={href("settings")} title={labels.settings} aria-label={labels.settings}><Settings size={21} /></Link>
      {canManageConstruction && <Link className="chrome-icon" href={href("projects/new")} title={t("createProject")} aria-label={t("createProject")}><PanelsTopLeft size={21} /></Link>}
      <Link className="chrome-icon" href={href("customers/new")} title={t("createCustomer")} aria-label={t("createCustomer")}><Users size={21} /></Link>
    </aside>
  </div>;
}
