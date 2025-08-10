import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function loadVideoElement(
  src: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = src;
    video.preload = "metadata";

    video.onloadedmetadata = (e: Event) => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };

    video.onerror = (err) => reject(err);
  });
}

export const navLists = [
  { label: "Home", id: "home" },
  { label: "Features", id: "features" },
  { label: "Products", id: "products" },
  { label: "Customize", id: "customize" },
  { label: "Testimonials", id: "testimonials" },
];
