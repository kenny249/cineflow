import { requireAdminPage } from "@/lib/admin-guard";
import { GrowthModelClient } from "./GrowthModelClient";

export const metadata = { title: "Growth Model — CineFlow Admin" };

export default async function GrowthModelPage() {
  await requireAdminPage();
  return <GrowthModelClient />;
}
