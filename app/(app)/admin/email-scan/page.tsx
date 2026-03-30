import { redirect } from "next/navigation";

export default function EmailScanRedirect(): never {
  redirect("/admin?tab=email-scanner");
}
