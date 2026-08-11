import { Suspense } from "react";
import { requireOrgMember } from "@/server/auth-guards";
import { ConversationsInbox } from "@/components/dashboard/conversations/conversations-inbox";
import { loadConversationsInbox } from "@/components/dashboard/conversations/load-conversations-inbox";

export default async function DashboardConversationsPage() {
  const member = await requireOrgMember();
  const payload = await loadConversationsInbox(member);
  return (
    <Suspense
      fallback={
        <p className="caption text-sm">Loading conversations…</p>
      }
    >
      <ConversationsInbox payload={payload} />
    </Suspense>
  );
}
