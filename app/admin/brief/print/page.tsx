import { requireAdminPage } from "@/lib/admin-guard";
import { PrintBrief } from "./PrintBrief";

export default async function BriefPrintPage() {
  await requireAdminPage();
  return <PrintBrief />;
}
