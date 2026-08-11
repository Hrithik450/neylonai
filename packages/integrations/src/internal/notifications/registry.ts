import { createRegistry } from "../registry";
import type { NotificationProvider } from "./types";

export const notificationProviders = createRegistry<NotificationProvider>();
