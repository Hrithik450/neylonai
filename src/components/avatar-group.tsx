import { sfProRegular } from "@/assets/fonts";
import { cn } from "@/lib/utils";
import Image, { StaticImageData } from "next/image";
import React from "react";

type AvatarGroupProps = {
  avatars: (string | StaticImageData)[];
  count?: string;
};

export function AvatarGroup({ avatars }: AvatarGroupProps) {
  return (
    <div
      className={cn(
        "relative flex items-center space-x-2",
        sfProRegular.className
      )}
    >
      {avatars.map((avatar, index) => (
        <div
          key={index}
          className={`w-15 h-15 rounded-full overflow-hidden bg-white border border-black/60 hover:-translate-y-1 transition-all duration-300 ease-in-out ${
            index > 0 ? "-ml-6" : ""
          }`}
          style={{ zIndex: avatars.length - index }}
        >
          <Image
            src={avatar}
            alt={`Avatar ${index + 1}`}
            className="w-15 h-15 object-cover"
            width={48}
            height={48}
          />
        </div>
      ))}

      {/* <div className="-ml-6 cursor-pointer w-16 h-16 rounded-full bg-[#0d3129] text-white flex items-center justify-center text-lg font-bold hover:-translate-y-1 transition-all duration-300 ease-in-out border-4 border-white">
        <Plus className="w-4 h-4" />8
      </div> */}
    </div>
  );
}
