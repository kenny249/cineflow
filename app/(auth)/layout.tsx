import { AdPixels } from "@/components/shared/AdPixels";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AdPixels />
    </>
  );
}
