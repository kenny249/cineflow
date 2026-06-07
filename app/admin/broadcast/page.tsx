import { requireAdminPage } from "@/lib/admin-guard";
import { BroadcastClient } from "./BroadcastClient";

export default async function BroadcastPage() {
  await requireAdminPage();
  return <BroadcastClient />;
}
