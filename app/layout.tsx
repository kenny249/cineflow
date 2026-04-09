import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Cineflow — Creative Project Management for Filmmakers",
    template: "%s | Cineflow",
  },
  description:
    "Manage client content projects from idea to delivery. Shot lists, storyboards, revisions, and collaboration — all in one place.",
  keywords: ["filmmaking", "video production", "project management", "storyboard", "shot list"],
  openGraph: {
    title: "Cineflow",
    description: "Creative project management for filmmakers and videographers.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${syne.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
