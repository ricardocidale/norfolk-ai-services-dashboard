import { AppChrome } from "@/components/layout/app-chrome";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppChrome>{children}</AppChrome>;
}
