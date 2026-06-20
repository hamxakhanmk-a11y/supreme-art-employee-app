import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/TopNav";
import PrintWatermark from "@/components/PrintWatermark";

export const metadata: Metadata = {
  title: "Supreme Art — Employee Management",
  description: "Employee records and onboarding",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <PrintWatermark />
        <TopNav />
        <main style={{ padding: "1.75rem", minHeight: "calc(100vh - 100px)", maxWidth: 1400, margin: "0 auto" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
