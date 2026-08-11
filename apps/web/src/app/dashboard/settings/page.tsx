import { Suspense } from "react";
import { requireOrgMember } from "@/server/auth-guards";
import { SettingsCenter } from "@/components/dashboard/settings/settings-center";

export default async function DashboardSettingsPage() {
  await requireOrgMember();

  return (
    <Suspense fallback={<p className="caption text-sm">Loading settings…</p>}>
      <SettingsCenter />
    </Suspense>
  );
}
