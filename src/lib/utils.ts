import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const navLists = [
  { label: "Home", id: "home" },
  { label: "Features", id: "features" },
  { label: "Products", id: "products" },
  { label: "Customize", id: "customize" },
  { label: "Testimonials", id: "testimonials" },
];
