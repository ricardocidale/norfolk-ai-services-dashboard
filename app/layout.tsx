import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Norfolk AI – Services Spend",
  description:
    "Dashboard for AI vendor expenses across Norfolk Group and Cidale accounts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`dark ${GeistSans.variable} ${GeistMono.variable} h-full`}
      >
        <body className="flex min-h-full flex-col selection:bg-primary/25 selection:text-foreground">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}