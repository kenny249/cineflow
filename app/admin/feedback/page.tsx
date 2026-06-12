import { requireAdminPage } from "@/lib/admin-guard";
import { FeedbackClient } from "./FeedbackClient";

export default async function FeedbackPage() {
  await requireAdminPage();
  return <FeedbackClient />;
}
