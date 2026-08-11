import { intervalToDuration } from "date-fns";
import { DateTime } from "luxon";

const indiaNow = () => DateTime.now().setZone("Asia/Kolkata").toJSDate();

/** Formats a past timestamp as a short relative string, e.g. "3h ago". */
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
