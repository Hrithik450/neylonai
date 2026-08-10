-- Solo-founder model: drop team invites, membership roles; one org per user.
DROP TABLE IF EXISTS "organization_invites";

DROP INDEX IF EXISTS "organization_members_user_id_idx";

-- If legacy multi-member rows exist, keep the earliest membership per user.
DELETE FROM organization_members a
USING organization_members b
WHERE a.user_id = b.user_id
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_user_uidx"
  ON "organization_members" ("user_id");

ALTER TABLE "organization_members" DROP COLUMN IF EXISTS "role";
