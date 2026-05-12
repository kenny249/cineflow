import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Project Workspace", template: "%s | Cineflow" },
  robots: { index: false, follow: false },
};

export default function CollabLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
