"use client";

import React from "react";
import { Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { WidgetHeader } from "@/components/widget/widget-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { guminertRegular } from "@/assets/fonts";
import z from "zod";

// const updateProfileSchema = z.object({
//   assistant: z.enum(assistantEnum),
//   role: z.enum(roleEnum),
// });

// export function WidgetUpdateSettings({
//   popScreen,
//   setMessage,
//   setStatus,
//   role,
//   assistant,
// }: {
//   popScreen: () => void;
//   setMessage: React.Dispatch<React.SetStateAction<string | null>>;
//   setStatus: React.Dispatch<
//     React.SetStateAction<"error" | "saving" | "saved" | null>
//   >;
//   role: RoleKey | null;
//   assistant: AssistantKey;
// }) {
//   const [loading, setLoading] = React.useState(false);

//   const form = useForm<z.infer<typeof updateProfileSchema>>({
//     resolver: zodResolver(updateProfileSchema),
//     defaultValues: {
//       assistant: assistant as AssistantKey,
//       role: role as RoleKey,
//     },
//   });
//   const selectedRole = form.watch("role");
//   const availableAssistants = RoleAssistantMap[selectedRole] || [];

//   React.useEffect(() => {
//     form.reset({
//       assistant: availableAssistants[0] as AssistantKey,
//       role: selectedRole as RoleKey,
//     });
//   }, [selectedRole]);

//   const onSubmit = async (data: z.infer<typeof updateProfileSchema>) => {
//     // try {
//     //   setLoading(true);
//     //   const response = await fetch(
//     //     `${process.env.NEXT_PUBLIC_BACKEND_URL}/core-manager/api/v1/user/${currentUserId}/`,
//     //     {
//     //       method: "PUT",
//     //       headers: { "Content-Type": "application/json" },
//     //       body: JSON.stringify(data),
//     //     },
//     //   );
//     //   const updatedData = await response.json();
//     //   if (!updatedData.success && updatedData.error) {
//     //     setStatus("error");
//     //     setMessage(updatedData.error);
//     //   }
//     //   setRole(updatedData.data.role as RoleKey);
//     //   setAssistant(updatedData.data.assistant as AssistantKey);
//     //   popScreen();
//     //   setStatus("saved");
//     //   setMessage("Your profile settings has been updated.");
//     //   form.reset();
//     // } catch (error) {
//     //   console.error("Error occured:", error);
//     //   setLoading(false);
//     // } finally {
//     //   setLoading(false);
//     // }
//   };

//   return (
//     <div className={cn("h-full w-full", guminertRegular.className)}>
//       <WidgetHeader header="Update Settings" action={() => popScreen()} />

//       <div className="py-8 px-4">
//         <Form {...form}>
//           <form className="space-y-2" onSubmit={form.handleSubmit(onSubmit)}>
//             <FormField
//               control={form.control}
//               name="role"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel className="text-md">Role</FormLabel>
//                   <FormControl>
//                     <Select
//                       {...field}
//                       onValueChange={field.onChange}
//                       disabled={loading}
//                     >
//                       <SelectTrigger className="w-full border border-black/80">
//                         <SelectValue placeholder="Select Role" />
//                       </SelectTrigger>
//                       <SelectContent className="z-999">
//                         {roleEnum
//                           .filter((r) => r !== "admin")
//                           .map((r) => (
//                             <SelectItem key={r} value={r}>
//                               {RoleDisplayMap[r]}
//                             </SelectItem>
//                           ))}
//                       </SelectContent>
//                     </Select>
//                   </FormControl>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />

//             <FormField
//               control={form.control}
//               name="assistant"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel className="text-md">Assistant</FormLabel>
//                   <FormControl>
//                     <Select
//                       {...field}
//                       onValueChange={field.onChange}
//                       disabled={loading}
//                     >
//                       <SelectTrigger className="w-full border border-black/80">
//                         <SelectValue placeholder="Select Assistant" />
//                       </SelectTrigger>
//                       <SelectContent className="z-999">
//                         {availableAssistants.map((a) => (
//                           <SelectItem key={a} value={a}>
//                             {AssistantDisplayMap[a]}
//                           </SelectItem>
//                         ))}
//                       </SelectContent>
//                     </Select>
//                   </FormControl>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />

//             <button
//               type="submit"
//               disabled={loading}
//               className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50 cursor-pointer"
//             >
//               <Send className="w-4 h-4" />
//               {loading ? "Updating..." : "Update Profile"}
//             </button>
//           </form>
//         </Form>
//       </div>
//     </div>
//   );
// }
