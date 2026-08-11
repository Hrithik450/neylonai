import { desc } from "drizzle-orm";
import { db, schema } from "@neylonai/database";
import { requireAdmin } from "@/server/auth-guards";
import { Card, CardContent, CardHeader, CardTitle } from "@neylonai/ui";

export default async function AdminUsersPage() {
  await requireAdmin();

  let users: Array<{
    id: string;
    email: string;
    username: string;
    role: string;
    created_at: Date | null;
  }> = [];
  try {
    users = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        username: schema.users.username,
        role: schema.users.role,
        created_at: schema.users.created_at,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.created_at))
      .limit(100);
  } catch {
    users = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Accounts signed in via Google.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Directory</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Role</th>
                  <th className="pb-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4">{u.username}</td>
                    <td className="py-2.5 pr-4">{u.email}</td>
                    <td className="py-2.5 pr-4">{u.role}</td>
                    <td className="py-2.5">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
