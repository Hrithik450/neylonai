"use client";

import z from "zod";
import React from "react";
import { Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { WidgetHeader } from "@/components/support-widget/widget-header";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { guminertBold, guminertRegular } from "@/assets/fonts";

const suggestions = [
  "What did you like about this widget?",
  "How can we make this experience better?",
  "Did this help you achieve what you wanted?",
  "What feature would you love to see next?",
  "Was anything confusing or unclear?",
];

const feedbackSchema = z.object({
  feedback: z
    .string()
    .min(5, "Please provide at least 5 characters.")
    .max(500, "Keep it concise (max 500 characters)."),
});
type FeedbackFormData = z.infer<typeof feedbackSchema>;

export function WidgetFeedback({ popScreen }: { popScreen: () => void }) {
  const [current, setCurrent] = React.useState(0);
  const [submitted, setSubmitted] = React.useState(false);
  const [isChanging, setIsChanging] = React.useState(false);

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { feedback: "" },
  });

  React.useEffect(() => {
    const interval = setInterval(() => {
      setIsChanging(true);
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % suggestions.length);
        setIsChanging(false);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const onSubmit = (data: FeedbackFormData) => {
    console.log("Feedback submitted:", data.feedback);
    setSubmitted(true);

    setTimeout(() => setSubmitted(false), 3000);
    form.reset();
  };

  return (
    <div className={cn("h-full w-full", guminertRegular.className)}>
      <WidgetHeader header="Share your feedback" action={() => popScreen()} />

      <div className="py-8 px-4">
        <div className="h-8 mb-2 overflow-hidden text-gray-700 relative">
          <p
            key={current}
            className="text-md md:text-lg transition-all duration-500 ease-in-out opacity-100 translate-y-0 bg-linear-to-r from-[#050c0a] via-[#0d3129] to-[#007a63] bg-clip-text text-transparent"
            style={{
              position: "absolute",
              opacity: isChanging ? 0 : 1,
              transform: isChanging ? "translateY(-10px)" : "translateY(0)",
            }}
          >
            {suggestions[current]}
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="feedback"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-md md:text-base">
                    Feedback
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      className="border border-black"
                      placeholder="Anything...."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-gray-600">
                    Help us improve with your suggestions.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <button
              type="submit"
              disabled={!form.watch("feedback").trim()}
              className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {submitted ? "Thanks for your feedback!" : "Submit"}
            </button>
          </form>
        </Form>
      </div>
    </div>
  );
}
