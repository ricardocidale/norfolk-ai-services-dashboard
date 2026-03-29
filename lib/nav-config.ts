/** URL segment → breadcrumb label */
export const BREADCRUMB_LABELS: Record<string, string> = {
  admin: "Admin",
  sources: "Expense sources",
  expenses: "Expenses",
  add: "Add manually",
  profile: "Profile",
  "user-profile": "Account",
  users: "Users",
};

export type NavItem = {
  title: string;
  href: string;
  icon: "dashboard" | "plus" | "admin" | "sources" | "profile" | "users";
};

export const MAIN_NAV: NavItem[] = [
  { title: "Dashboard", href: "/", icon: "dashboard" },
  { title: "Add expense", href: "/expenses/add", icon: "plus" },
  { title: "Profile", href: "/profile", icon: "profile" },
];

export const ADMIN_NAV: NavItem[] = [
  { title: "Overview", href: "/admin", icon: "admin" },
  { title: "Expense sources", href: "/admin/sources", icon: "sources" },
  { title: "Users", href: "/admin/users", icon: "users" },
];
