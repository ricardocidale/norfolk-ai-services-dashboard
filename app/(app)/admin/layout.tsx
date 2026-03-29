import { redirect } from "next/navigation";
import { isAppAdmin } from "@/lib/admin/is-app-admin";

export const dynamic = "force-dynamic";

export default async function AdminSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAppAdmin())) {
    redirect("/");
  }
  return <>{children}</>;
}
