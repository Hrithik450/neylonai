import { redirect } from "next/navigation";
import { requireOrgMember } from "@/server/auth-guards";

/** Knowledge entry is Integrations (synced sources). */
export default async function DashboardKnowledgePage() {
  await requireOrgMember();
  redirect("/dashboard/integrations");
}
