import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";
import AppIntro from "@/components/AppIntro";
import PrintWatermark from "@/components/PrintWatermark";
import PrintTextareas from "@/components/PrintTextareas";
import { MeProvider } from "@/components/MeProvider";
import TestEnvBanner from "@/components/TestEnvBanner";
import { APP_NAME, TEST_APP_NAME, appEnv } from "@/lib/appEnv";

const isTest = appEnv() === "test";

export const metadata: Metadata = {
  title: isTest ? TEST_APP_NAME : APP_NAME,
  description: "Supreme Art enterprise portal — HR, forms, reports, salary, KPI, procurement, station, and store.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-env="test" switches the palette and shows the TEST badges (globals.css).
    <html lang="en" data-env={isTest ? "test" : undefined}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <MeProvider>
          {isTest && <TestEnvBanner />}
          <AppIntro />
          <PrintWatermark />
          <PrintTextareas />
          <TopNav />
          <div className="app-body" style={{ display: "flex", alignItems: "flex-start" }}>
            <Sidebar />
            <main className="app-main" style={{ flex: 1, minWidth: 0, minHeight: "calc(100vh - 56px)" }}>
              {children}
            </main>
          </div>
        </MeProvider>
      </body>
    </html>
  );
}
