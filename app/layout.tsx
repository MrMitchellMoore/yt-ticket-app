import type { Metadata } from "next";
import "./globals.css";
import { ConvexClientProviderWithClerk } from "@/components/ConvexClientProviderWithClerk";

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
      <body>
        <ConvexClientProviderWithClerk>
          {children}
        </ConvexClientProviderWithClerk>
      </body>
    </html>
  );
}
