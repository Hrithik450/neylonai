import { redirect } from "next/navigation";

/** Billing lives under Settings → Billing & Plan. */
export default function DashboardBillingRedirectPage() {
  redirect("/dashboard/settings?section=billing");
}
