/** URL segment → breadcrumb label */
export const BREADCRUMB_LABELS: Record<string, string> = {
  admin: "Admin",
  analysis: "Analysis & reports",
  expenses: "Expenses",
  add: "Add manually",
  profile: "Profile",
  "user-profile": "Account",
};

export type NavItem = {
  title: string;
  href: string;
  icon: "dashboard" | "plus" | "admin" | "profile";
};

export const MAIN_NAV: NavItem[] = [
  { title: "Dashboard", href: "/", icon: "dashboard" },
  { title: "Add expense", href: "/expenses/add", icon: "plus" },
  { title: "Profile", href: "/profile", icon: "profile" },
];

export const ADMIN_NAV: NavItem[] = [
  { title: "Admin", href: "/admin", icon: "admin" },
];
