import { redirect } from "next/navigation";
import { getSessionFromCookies, type SessionUser } from "@/server/auth-cookies";
import { getOrganizationForUser } from "@neylonai/domain/billing";

export type OrgSession = SessionUser & {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
};

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionFromCookies();
  if (!user) redirect("/?auth=false");
  return user;
}

export async function requireOrgMember(): Promise<OrgSession> {
  const user = await requireUser();
  const org = await getOrganizationForUser(user.id);
  if (!org) {
    // Should be rare after login bootstrap; send to home to re-auth.
    redirect("/?auth=false");
  }
  return {
    ...user,
    organizationId: org.organizationId,
    organizationSlug: org.slug,
    organizationName: org.name,
  };
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
