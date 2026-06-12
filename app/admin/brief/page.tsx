import { requireAdminPage } from "@/lib/admin-guard";
import { BriefClient } from "./BriefClient";

export default async function BriefPage() {
  await requireAdminPage();
  return <BriefClient />;
}
