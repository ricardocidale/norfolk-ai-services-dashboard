import { redirect } from "next/navigation";

export default function AdminSourcesRedirect(): never {
  redirect("/admin?tab=vendors");
}
