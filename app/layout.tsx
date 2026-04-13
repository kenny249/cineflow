import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
  metadataBase: new URL("https://usecineflow.com"),
  title: {
    default: "Cineflow · Project Workspace for Film Teams",
    template: "%s | Cineflow",
  },
  description:
    "Plan shoots, manage edits, and collaborate with your crew in one workspace.",
  keywords: ["filmmaking", "video production", "project management", "storyboard", "shot list"],
  openGraph: {
    title: "Cineflow",
    description: "Project workspace for film teams.",
    type: "website",
    url: "https://usecineflow.com",
    siteName: "Cineflow",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cineflow",
    description: "Project workspace for film teams.",
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
        <SpeedInsights />
      </body>
    </html>
  );
}
