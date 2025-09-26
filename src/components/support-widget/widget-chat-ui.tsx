"use client";

import React from "react";

interface WidgetChatUIProps {
  id: string;
  pushScreen: (screen: Screen) => void;
  popScreen: () => void;
}

export const WidgetChatUI = ({}: WidgetChatUIProps) => {
  return <section></section>;
};
