import { requireAdminPage } from "@/lib/admin-guard";
import { ActivityFeed } from "./ActivityFeed";

export default async function ActivityPage() {
  await requireAdminPage();
  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Live Activity</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Real-time stream of platform events — polls every 5s</p>
      </div>
      <ActivityFeed />
    </div>
  );
}
