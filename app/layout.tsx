import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";
import AppIntro from "@/components/AppIntro";
import PrintWatermark from "@/components/PrintWatermark";
import PrintTextareas from "@/components/PrintTextareas";
import { MeProvider } from "@/components/MeProvider";

export const metadata: Metadata = {
  title: "Supreme Art ERP",
  description: "Supreme Art enterprise portal — HR, forms, reports, salary, KPI, procurement, station, and store.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <MeProvider>
          <AppIntro />
          <PrintWatermark />
          <PrintTextareas />
          <TopNav />
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <Sidebar />
            <main style={{ flex: 1, minWidth: 0, padding: "1.75rem", minHeight: "calc(100vh - 56px)" }}>
              {children}
            </main>
          </div>
        </MeProvider>
      </body>
    </html>
  );
}
