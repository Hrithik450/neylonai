"use client";

import { Suspense } from "react";
import Link from "next/link";
import { BillingPanel } from "@/components/dashboard/billing-panel";
import { SettingsSectionFrame } from "./settings-ui";

export function BillingSettingsSection() {
  return (
    <SettingsSectionFrame
      id="billing-section"
      headingId="billing-heading"
      title="Billing & Plan"
      description="Subscription, payment method, invoices, and plan changes. Detailed consumption is under Usage."
    >
      <div className="space-y-6">
        <p className="caption text-sm ink-card bg-[var(--cream)] px-4 py-3">
          Looking for AI credits used, remaining balance, and trends?{" "}
          <Link
            href="/dashboard/usage"
            className="underline underline-offset-4 font-medium"
          >
            Open Usage
          </Link>
        </p>
        <Suspense fallback={<p className="caption text-sm">Loading billing…</p>}>
          <BillingPanel embedded />
        </Suspense>
      </div>
    </SettingsSectionFrame>
  );
}
