"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export const description = "A multiple bar chart";

const chartData = [
  {
    category: "Customer Support Assistant",
    manual: 320,
    AI: 90, // Saved 230 hrs
    note: "Equivalent to 40 human workdays (8 hrs/day)",
  },
  {
    category: "Document Summarization Assistant",
    manual: 210,
    AI: 65, // Saved 145 hrs
    note: "Equivalent to 26.25 human workdays (8 hrs/day)",
  },
  {
    category: "Data Entry Automation Assistant",
    manual: 185,
    AI: 40, // Saved 145 hrs
    note: "Equivalent to 23.12 human workdays (8 hrs/day)",
  },
  {
    category: "Lead Qualification Assistant",
    manual: 165,
    AI: 35,
    note: "Equivalent to 20.62 human workdays (8 hrs/day)", // Saved 130 hrs
  },
];

const chartConfig = {
  manual: {
    label: "Manual (hrs)",
    color: "#4F6D7A (hrs)",
  },
  AI: {
    label: "AISolutionz Assistant (hrs)",
    color: "#EFC958",
  },
} satisfies ChartConfig;

export function ChartBarMultiple({ className }: { className: string }) {
  return (
    <Card className={cn("h-full font-sf-pro-regular", className)}>
      <CardContent>
        <ChartContainer className="max-h-[250px] w-full" config={chartConfig}>
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(_, index) => {
                const data = chartData[index];
                if (!data) return "";
                const savedPercent =
                  ((data.manual - data.AI) / data.manual) * 100;
                return `${savedPercent.toFixed(0)}% Improved`;
              }}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dashed" />}
            />
            <Bar dataKey="manual" fill="#4F6D7A" radius={4} />
            <Bar dataKey="AI" fill="#EFC958" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-md">
        <div className="flex gap-2 leading-snug font-medium">
          1250+ Hours Saved → Equal to 156 full workdays (8 hrs/day) of manual
          effort every month.
        </div>
        <div className="text-muted-foreground leading-snug text-md">
          $65,000 Monthly Savings → Equal to ~4 full-time salaries saved.
        </div>
      </CardFooter>
    </Card>
  );
}
