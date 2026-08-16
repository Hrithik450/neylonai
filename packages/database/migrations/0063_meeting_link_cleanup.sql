-- Replace the former booking workflow configuration with a plain meeting URL.
-- The Main Agent only shares this URL; it does not perform scheduling.

UPDATE "organization_integrations"
SET "config" =
  ("config" - 'bookingUrl' - 'booking_url') ||
  jsonb_build_object(
    'meetingUrl',
    COALESCE(
      "config"->>'meetingUrl',
      "config"->>'bookingUrl',
      "config"->>'booking_url'
    )
  )
WHERE "integration_id" = 'calcom'
  AND COALESCE(
    "config"->>'meetingUrl',
    "config"->>'bookingUrl',
    "config"->>'booking_url'
  ) IS NOT NULL;
