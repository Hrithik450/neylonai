-- Social turns are free; paid plans may use provider-invoiced credit overage.

ALTER TABLE "usage_request_reservations"
  ADD COLUMN IF NOT EXISTS "billing_mode" varchar(16) NOT NULL DEFAULT 'included';
