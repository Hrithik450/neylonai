/**
 * Client-safe type exports only.
 * Import service functions from `@neylonai/domain/workspace` from server code.
 */
export type {
  WorkspaceSettings,
  WorkspaceSettingsPatch,
} from "./types";
export {
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PRIVACY,
  DEFAULT_SSO,
} from "./types";
export {
  getWorkspaceSettings,
  saveWorkspaceSettings,
} from "./service";
