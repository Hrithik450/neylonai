import "dotenv/config";
import { applyRetentionForAllOrganizations } from "./retention/apply-retention";

async function main() {
  const results = await applyRetentionForAllOrganizations();
  const total = results.reduce((sum, r) => sum + r.totalDeleted, 0);
  console.log(
    `[retention] processed ${results.length} org(s), deleted ${total} row(s)`,
  );
  for (const r of results) {
    if (r.totalDeleted === 0) continue;
    console.log(
      `  org ${r.organizationId}: ${r.totalDeleted} row(s) (${r.retentionDays}d policy)`,
    );
  }
}

main().catch((err) => {
  console.error("[retention] failed", err);
  process.exit(1);
});
