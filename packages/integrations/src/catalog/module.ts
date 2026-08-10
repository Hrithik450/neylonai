import type { IntegrationManifest } from "../catalog/types";

/**
 * One registered customer-facing integration.
 * Domain/UI read `manifest`; integration-specific ops live on the module.
 */
export type IntegrationModule = {
  manifest: IntegrationManifest;
};
