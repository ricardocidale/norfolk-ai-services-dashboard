import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
        className={`dark ${geistSans.variable} ${geistMono.variable} h-full`}
      >
        <body className="flex min-h-full flex-col selection:bg-primary/25 selection:text-foreground">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}