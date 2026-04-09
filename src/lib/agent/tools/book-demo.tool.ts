import { tool } from "@langchain/core/tools";
import { z } from "zod";

const DEMO_BOOKING_URL =
  process.env.DEMO_BOOKING_URL ?? "https://cal.com/company/demo";

export const bookDemoTool = tool(
  async () => {
    console.log("book_demo called");
    return `Book a demo here: ${DEMO_BOOKING_URL}`;
  },
  {
    name: "book_demo",
    description:
      "Provide the demo booking link when the user expresses interest in scheduling a meeting, demo, or call with the Neylon-AI team.",
    schema: z.object({}),
  },
);
