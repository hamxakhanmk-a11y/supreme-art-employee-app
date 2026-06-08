import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Supreme Art — Employee Management",
  description: "Employee records and onboarding",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Sidebar />
        <main style={{ marginLeft: 210, padding: "1.75rem", minHeight: "100vh" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
