/**
 * Organization account settings (General, Privacy).
 * Import service functions from server code only.
 */
export type {
  OrganizationSettings,
  OrganizationSettingsPatch,
  OrganizationPrivacyPrefs,
} from "./types";
export { DEFAULT_PRIVACY } from "./types";
export {
  getOrganizationSettings,
  saveOrganizationSettings,
} from "./service";
