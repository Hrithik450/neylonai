export interface NavItem {
  label: string;
  id: string;
  action?: string;
}

export const navLists: Array<NavItem> = [
  { label: "Home", id: "home" },
  { label: "Features", id: "features" },
  { label: "Explore AI", id: "ai" },
  { label: "Contact Us", id: "footer" },
];

export { cn, shortTimeAgo } from "@neylonai/ui";
