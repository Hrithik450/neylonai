import { redirect } from "next/navigation";

/** Legacy route — API keys live under Developer. */
export default function LegacyIntegrationRedirect() {
  redirect("/dashboard/settings?section=developer");
}
