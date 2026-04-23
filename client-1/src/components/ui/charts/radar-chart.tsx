"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import { CardContent } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export const description = "A radar chart with a legend";

// Given an example demo with n8n if anyone asked, how?
const chartData = [
  {
    metric: "Accuracy",
    neylonAI: 99,
    others: 80,
    note: "How precise AI decisions are (core strength).",
  },
  {
    metric: "Efficiency",
    neylonAI: 95,
    others: 70,
    note: "Time saved per task compared to legacy/manual systems.",
  },
  {
    metric: "Error Reduction",
    neylonAI: 98,
    others: 75,
    note: "How much mistakes are prevented.",
  },
  {
    metric: "Revenue Impact",
    neylonAI: 90,
    others: 65,
    note: "Measurable business impact.",
  },
  {
    metric: "Adaptability",
    neylonAI: 97,
    others: 72,
    note: "Ability of AI agents to handle new/unseen tasks.",
  },
  {
    metric: "Scalability",
    neylonAI: 96,
    others: 68,
    note: "Performance when multiple agents run simultaneously.",
  },
];

const chartConfig = {
  neylonAI: {
    label: "Neylon AI",
    color: "var(--chart-1)",
  },
  others: {
    label: "Others",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function ChartRadarLegend() {
  return (
    <CardContent className="w-full h-full pb-0 md:pb-2">
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square w-full h-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            data={chartData}
            margin={{ top: 0, bottom: 0, left: 0, right: 0 }}
          >
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />

            <PolarAngleAxis dataKey="metric" />
            <PolarGrid />

            <Radar
              name="Neylon AI"
              dataKey="neylonAI"
              stroke="#7C3AED"
              fill="#C4B5FD"
              fillOpacity={0.6}
            />
            <Radar
              name="Others"
              dataKey="others"
              stroke="#0D9488"
              fill="#5EEAD4"
              fillOpacity={0.6}
            />

            <ChartLegend className="mt-4" content={<ChartLegendContent />} />
          </RadarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </CardContent>
  );
}
