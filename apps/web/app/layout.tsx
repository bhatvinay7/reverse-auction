import type { Metadata } from "next";
import { Quicksand } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "../components/AppShell";
import { cookies } from "next/headers";

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "AquaBid | Live Forward & Reverse Auctions",
  description:
    "Discover live and upcoming auctions for items, assets, services, capacity, and contracts.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  let serverUserId = "";

  if (token) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      const res = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        serverUserId = data.userId || "";
      }
    } catch (e) {
      console.error("Failed to fetch userId from backend api", e);
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${quicksand.variable} ${geistMono.variable} font-sans antialiased transition-colors duration-300`}
        suppressHydrationWarning
      >
        <Providers serverUserId={serverUserId}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
