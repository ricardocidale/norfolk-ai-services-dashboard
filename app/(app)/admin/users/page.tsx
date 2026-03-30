import { redirect } from "next/navigation";

export default function AdminUsersRedirect(): never {
  redirect("/admin?tab=users");
}
