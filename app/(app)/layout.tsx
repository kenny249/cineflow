import { AppLayout } from "@/components/layout/AppLayout";
import { EditSessionProvider } from "@/contexts/EditSessionContext";
import { PostHogProvider } from "@/components/shared/PostHogProvider";

export default function AppRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PostHogProvider>
      <EditSessionProvider>
        <AppLayout>{children}</AppLayout>
      </EditSessionProvider>
    </PostHogProvider>
  );
}
