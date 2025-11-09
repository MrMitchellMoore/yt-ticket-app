import type { Metadata } from "next";
import "./globals.css";
import { ConvexClientProviderWithClerk } from "@/components/providers/ConvexClientProviderWithClerk";
import Header from "@/components/shared/Header";
import SyncUserWithConvex from "@/components/shared/SyncUserWithConvex";

export const metadata: Metadata = {
  title: "YT Ticket App",
  description: "YT Ticket App created with Next.js and TypeScript",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col w-full">
        <ConvexClientProviderWithClerk>
          <Header />
          <SyncUserWithConvex />
          {children}
        </ConvexClientProviderWithClerk>
      </body>
    </html>
  );
}
