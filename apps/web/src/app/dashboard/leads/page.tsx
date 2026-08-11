import { redirect } from "next/navigation";

/** Leads live under Conversations — no separate main nav page. */
export default function DashboardLeadsRedirectPage() {
  redirect("/dashboard/conversations?view=leads");
}
