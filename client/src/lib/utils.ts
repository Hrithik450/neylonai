import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { intervalToDuration } from "date-fns";
import { DateTime } from "luxon";

export interface NavItem {
  label: string;
  id: string;
  action?: string;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const navLists: Array<NavItem> = [
  { label: "Home", id: "home" },
  { label: "Features", id: "features" },
  { label: "Explore AI", id: "ai" },
  { label: "Insights", id: "insights", action: "insights" },
  { label: "Contact Us", id: "contact", action: "contact" },
];

export function loadVideoElement(
  src: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = src;
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };

    video.onerror = (err) => reject(err);
  });
}

const indiaNow = () => DateTime.now().setZone("Asia/Kolkata").toJSDate();
export function shortTimeAgo(createdAt: Date) {
  const d = intervalToDuration({ start: createdAt, end: indiaNow() });
  if (d.years) return `${d.years}y ago`;
  if (d.months) return `${d.months}mo ago`;
  if (d.weeks) return `${d.weeks}w ago`;
  if (d.days) return `${d.days}d ago`;
  if (d.hours) return `${d.hours}h ago`;
  if (d.minutes) return `${d.minutes}m ago`;
  return "just now";
}
