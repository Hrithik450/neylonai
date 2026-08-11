import { redirect } from "next/navigation";

/** Developer tools live under Settings → Developer (keys under Security). */
export default function DashboardDeveloperRedirectPage() {
  redirect("/dashboard/settings?section=developer");
}
