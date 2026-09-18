import { AppLayout } from "@/components/layout/AppLayout";
import { EditSessionProvider } from "@/contexts/EditSessionContext";

export default function AppRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EditSessionProvider>
      <AppLayout>{children}</AppLayout>
    </EditSessionProvider>
  );
}
