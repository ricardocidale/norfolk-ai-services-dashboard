import { AppChrome } from "@/components/layout/app-chrome";
import { isAppAdmin } from "@/lib/admin/is-app-admin";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const showAdminNav = await isAppAdmin();
  return <AppChrome showAdminNav={showAdminNav}>{children}</AppChrome>;
}
