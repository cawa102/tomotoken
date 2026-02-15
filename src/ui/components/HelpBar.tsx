import React from "react";
import { Text } from "ink";

interface Props {
  readonly activeTab: number;
}

export function HelpBar({ activeTab }: Props) {
  const arrows = activeTab === 0 ? "  \u2190\u2192: browse pets" : "";
  return <Text dimColor>Tab: switch tab{arrows}  q: exit</Text>;
}
