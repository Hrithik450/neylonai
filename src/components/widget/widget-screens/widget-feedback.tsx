"use client";

import React from "react";
import { Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { WidgetHeader } from "@/components/widget/widget-header";
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
import { guminertRegular } from "@/assets/fonts";
import { useSessionStore } from "@/store/session-store";

const suggestions = [
  "What did you like about this widget?",
  "How can we make this experience better?",
  "Did this help you achieve what you wanted?",
  "What feature would you love to see next?",
  "Was anything confusing or unclear?",
];

// export function WidgetFeedback({
//   popScreen,
//   setMessage,
//   setStatus,
// }: {
//   popScreen: () => void;
//   setMessage: React.Dispatch<React.SetStateAction<string | null>>;
//   setStatus: React.Dispatch<
//     React.SetStateAction<"error" | "saving" | "saved" | null>
//   >;
// }) {
//   const [loading, setLoading] = React.useState(false);
//   const [current, setCurrent] = React.useState(0);
//   const [isChanging, setIsChanging] = React.useState(false);

//   const { user, isAuthenticated } = useSessionStore();

//   const form = useForm<FeedbackFormData>({
//     resolver: zodResolver(feedbackSchema),
//     defaultValues: {
//       content: "",
//       user_id: user?.id,
//       user_name: user?.name as string,
//     },
//   });

//   React.useEffect(() => {
//     if (isAuthenticated && user) {
//       form.reset({
//         content: "",
//         user_id: user.id,
//         user_name: user.name,
//       });
//     }
//   }, [isAuthenticated]);

//   React.useEffect(() => {
//     const interval = setInterval(() => {
//       setIsChanging(true);
//       setTimeout(() => {
//         setCurrent((prev) => (prev + 1) % suggestions.length);
//         setIsChanging(false);
//       }, 400);
//     }, 3000);
//     return () => clearInterval(interval);
//   }, []);

//   const onSubmit = async (data: FeedbackFormData) => {
//     console.log("Feedback data:", data);
//     try {
//       setLoading(true);
//       const response = await fetch("/api/feedback", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(data),
//       });
//       const feedbackData: FeedbackResponse = await response.json();

//       if (!feedbackData.success && feedbackData.error) {
//         setStatus("error");
//         setMessage(feedbackData.error);
//       }

//       setStatus("saved");
//       setMessage("Your feedback has been received. Thank you!");
//       form.reset();
//     } catch (error) {
//       console.error("Error occured:", error);
//       setLoading(false);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className={cn("h-full w-full", guminertRegular.className)}>
//       <WidgetHeader header="Share your feedback" action={() => popScreen()} />

//       <div className="py-8 px-4">
//         <div className="h-14 mb-2 overflow-hidden text-gray-700 relative">
//           <p
//             key={current}
//             className="text-md md:text-lg transition-all duration-500 ease-in-out opacity-100 translate-y-0 bg-linear-to-r from-[#050c0a] via-[#0d3129] to-[#007a63] bg-clip-text text-transparent"
//             style={{
//               position: "absolute",
//               opacity: isChanging ? 0 : 1,
//               transform: isChanging ? "translateY(-10px)" : "translateY(0)",
//             }}
//           >
//             {suggestions[current]}
//           </p>
//         </div>

//         <Form {...form}>
//           <form onSubmit={form.handleSubmit(onSubmit)}>
//             <FormField
//               control={form.control}
//               name="content"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel className="text-md md:text-base">
//                     Feedback
//                   </FormLabel>
//                   <FormControl>
//                     <Textarea
//                       className="border border-black"
//                       placeholder="Anything...."
//                       disabled={loading}
//                       {...field}
//                     />
//                   </FormControl>
//                   <FormDescription className="text-gray-600">
//                     Help us improve with your suggestions.
//                   </FormDescription>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />

//             <button
//               type="submit"
//               disabled={loading || !form.watch("content").trim()}
//               className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50 cursor-pointer"
//             >
//               <Send className="w-4 h-4" />
//               {loading ? "Submitting..." : "Submit"}
//             </button>
//           </form>
//         </Form>
//       </div>
//     </div>
//   );
// }

export function WidgetFeedback() {
  return <div></div>;
}
