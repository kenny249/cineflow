import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Wrap", template: "%s · Wrap" },
  description: "Expense tracking for film & video crews.",
  manifest: "/wrap-manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Wrap" },
  themeColor: "#0a0a0a",
};

export default function WrapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
