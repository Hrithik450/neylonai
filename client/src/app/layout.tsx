import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neylon AI",
  description:
    "Neylon-AI is a full-service AI agency specializing in the development of custom AI solutions, intelligent agents, and automation systems for both enterprises and individual consumers.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body cz-shortcut-listen="false">{children}</body>
    </html>
  );
}
