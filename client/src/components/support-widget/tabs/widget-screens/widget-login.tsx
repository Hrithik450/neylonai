"use client";

import { WidgetHeader } from "@/components/support-widget/widget-header";
import { signInWithGoogle } from "@/actions/auth/sign-in";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import React from "react";

export function WidgetLogin({ popScreen }: { popScreen: () => void }) {
  return (
    <div className={cn("flex flex-col h-full")}>
      <WidgetHeader
        className="sticky top-0"
        header="Access your assistant"
        action={() => popScreen()}
      />

      <div className="flex-1 flex flex-col justify-center items-center">
        <p className="text-gray-600 text-lg mt-8 mb-4">
          Please log in to continue
        </p>

        <Button
          variant="default"
          className="max-w-max mx-auto rounded-full px-6 xl:px-10 py-3 text-sm md:text-base cursor-pointer hover:opacity-90 transition-all"
          onClick={async () => {
            await signInWithGoogle();
          }}
        >
          Login
        </Button>
      </div>
    </div>
  );
}
