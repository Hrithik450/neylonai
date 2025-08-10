import { sfProRegular } from "@/assets/fonts";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import Image from "next/image";
import React from "react";

type AvatarGroupProps = {
  avatars: string[]; // URLs of avatar images
  count?: string;
};

export function AvatarGroup({ avatars }: AvatarGroupProps) {
  return (
    <div className={cn("flex items-center space-x-2", sfProRegular.className)}>
      {avatars.map((avatar, index) => (
        <div
          key={index}
          className={`w-12 h-12 rounded-full overflow-hidden border-2 border-white ${
            index > 0 ? "-ml-4" : ""
          }`}
        >
          <Image
            src={avatar}
            alt={`Avatar ${index + 1}`}
            className="w-12 h-12 object-cover"
            width={50}
            height={50}
          />
        </div>
      ))}

      <div className="cursor-pointer w-12 h-12 rounded-full bg-black text-white flex items-center justify-center text-lg font-bold -ml-3">
        <Plus />
      </div>
    </div>
  );
}
