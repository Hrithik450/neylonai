"use client";

import { TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export const description = "A simple area chart";

const chartData = [
  {
    category: "Customer Support Assistant",
    savings: 7000,
    note: "Valued at $20.83/hr → Equivalent to 42 human workdays (8 hrs/day) → $7,000/month",
  },
  {
    category: "Document Summarization Assistant",
    savings: 1000,
    note: "Valued at $20.83/hr → Equivalent to 6 human workdays (8 hrs/day) → $1,000/month",
  },
  {
    category: "Data Entry Automation Assistant",
    savings: 25000,
    note: "Valued at $20.83/hr → Equivalent to 150 human workdays (8 hrs/day) → $25,000/month",
  },
  {
    category: "Lead Qualification Assistant",
    savings: 50000,
    note: "Valued at $20.83/hr → Equivalent to 300 human workdays (8 hrs/day) → $50,000/month",
  },
  {
    category: "Meeting Transcription Assistant",
    savings: 40000,
    note: "Valued at $20.83/hr → Equivalent to 240 human workdays (8 hrs/day) → $40,000/month",
  },
  {
    category: "Code Review Assistant",
    savings: 75000,
    note: "Valued at $20.83/hr → Equivalent to 450 human workdays (8 hrs/day) → $75,000/month",
  },
];

const chartConfig = {
  savings: {
    label: "Saving's/month",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function ChartAreaDefault({ className }: { className: string }) {
  return (
    <Card className={cn("h-full", className)}>
      <CardContent>
        <ChartContainer className="max-h-[250px] w-full" config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="category"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(_, index) => {
                return `${index + 1}`;
              }}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Area
              dataKey="savings"
              type="natural"
              fill="#8B5CF6"
              fillOpacity={0.4}
              stroke="#6D28D9"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 leading-none font-medium">
              Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
            </div>
            <div className="text-muted-foreground flex items-center gap-2 leading-none">
              January - June 2024
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
