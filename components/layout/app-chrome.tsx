"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useState } from "react";
import {
  LayoutDashboard,
  Mail,
  Menu,
  Plus,
  Settings2,
  Unplug,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ADMIN_NAV,
  BREADCRUMB_LABELS,
  MAIN_NAV,
  type NavItem,
} from "@/lib/nav-config";
import { UserButton } from "@clerk/nextjs";

function formatSegment(seg: string): string {
  return seg
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function useBreadcrumbItems(): { href: string; label: string; current: boolean }[] {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [{ href: "/", label: "Dashboard", current: true }];
  }

  const items: { href: string; label: string; current: boolean }[] = [
    { href: "/", label: "Dashboard", current: false },
  ];
  let acc = "";
  for (let i = 0; i < segments.length; i++) {
    acc += `/${segments[i]}`;
    const isCurrent = i === segments.length - 1;
    const label = BREADCRUMB_LABELS[segments[i]] ?? formatSegment(segments[i]);
    items.push({ href: acc, label, current: isCurrent });
  }
  return items;
}

function NavIcon({ item }: { item: NavItem }) {
  const c = "size-4 shrink-0 opacity-70";
  switch (item.icon) {
    case "dashboard":
      return <LayoutDashboard className={c} />;
    case "plus":
      return <Plus className={c} />;
    case "admin":
      return <Settings2 className={c} />;
    case "sources":
      return <Unplug className={c} />;
    case "profile":
      return <UserCircle className={c} />;
    case "users":
      return <Users className={c} />;
    case "email-scan":
      return <Mail className={c} />;
    default:
      return null;
  }
}

function NavLink({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active =
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-[background-color,color,transform,box-shadow] duration-200 ease-out motion-reduce:transition-none",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-primary/25"
          : "text-sidebar-foreground/80 hover:translate-x-0.5 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground hover:shadow-sm motion-reduce:hover:translate-x-0",
      )}
    >
      <NavIcon item={item} />
      {item.title}
    </Link>
  );
}

function SidebarContent({
  onNavigate,
  showAdminNav,
}: {
  onNavigate?: () => void;
  showAdminNav: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link
        href="/"
        onClick={onNavigate}
        className="group flex items-center gap-3 rounded-lg px-1 py-1 text-sm font-semibold tracking-tight text-sidebar-foreground transition-[color,transform] duration-200 hover:text-primary group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
      >
        <span className="relative size-6 shrink-0" aria-hidden>
          <Image
            src="/logo-icone-azul.svg"
            alt=""
            width={24}
            height={24}
            className="size-6 dark:hidden"
            unoptimized
          />
          <Image
            src="/logo-icone-branco.svg"
            alt=""
            width={24}
            height={24}
            className="absolute inset-0 size-6 hidden dark:block"
            unoptimized
          />
        </span>
        Norfolk AI Expense Pulse
      </Link>
      <nav className="flex flex-col gap-1" aria-label="Main">
        <p className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Main
        </p>
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
      {showAdminNav ? (
        <nav className="flex flex-col gap-1" aria-label="Administration">
          <p className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Admin
          </p>
          {ADMIN_NAV.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </nav>
      ) : null}
    </div>
  );
}

export function AppChrome({
  children,
  showAdminNav = false,
}: {
  children: React.ReactNode;
  /** When true, show Admin section (role=admin or default owner email). */
  showAdminNav?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const crumbs = useBreadcrumbItems();

  return (
    <div className="flex min-h-full">
      <aside
        className="hidden w-56 shrink-0 border-r border-sidebar-border bg-sidebar md:block"
        aria-label="Sidebar"
      >
        <SidebarContent showAdminNav={showAdminNav} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-[min(100%,280px)] flex-col border-r border-sidebar-border bg-sidebar shadow-2xl shadow-black/40 ring-1 ring-sidebar-border/50">
            <div className="flex items-center justify-end border-b border-sidebar-border p-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="size-5" />
              </Button>
            </div>
            <SidebarContent
              showAdminNav={showAdminNav}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 shadow-sm shadow-black/5 backdrop-blur-md supports-[backdrop-filter]:bg-background/75 dark:shadow-black/20">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>
            <Breadcrumb className="hidden min-w-0 sm:block">
              <BreadcrumbList>
                {crumbs.map((c, i) => (
                  <Fragment key={c.href}>
                    {i > 0 ? <BreadcrumbSeparator /> : null}
                    <BreadcrumbItem>
                      {c.current ? (
                        <BreadcrumbPage>{c.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link href={c.href}>{c.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
            <span className="min-w-0 truncate text-sm font-medium text-foreground sm:hidden">
              {crumbs.find((c) => c.current)?.label ?? "Norfolk AI"}
            </span>
            <div className="ml-auto">
              <UserButton userProfileUrl="/user-profile" />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}