"use client";

import React from "react";
import { WidgetHeader } from "@/components/support-widget/widget-header";

interface WidgetChatUIProps {
  id: string;
  pushScreen: (screen: Screen) => void;
  popScreen: () => void;
}

export const WidgetChatUI = ({
  id,
  pushScreen,
  popScreen,
}: WidgetChatUIProps) => {
  return (
    <section>
      <WidgetHeader header={id} />
    </section>
  );
};
