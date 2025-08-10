import { cn } from "@/lib/utils";

const conversations = [
  {
    user: "Update last month's report please.",
  },
  {
    assistant: "Report ready. Shall I email?",
  },
  {
    user: "Yes, and add sales summary.",
  },
  {
    assistant: "Sales summary added. Anything else?",
  },
];

export default function ChatHistory({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-full h-full rounded-xl p-5 shadow-sm text-sm bg-white font-sf-pro-medium",
        className
      )}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-gray-800 text-2xl">Chat Memory</h2>
        <span className="text-sm text-gray-400 cursor-pointer">See all</span>
      </div>

      <div className="mt-10">
        {conversations.map((conversation, i) => (
          <div
            key={i}
            className={cn(
              "flex my-7 px-3 hover:bg-gray-50 rounded-lg transition",
              conversation.assistant ? "justify-start" : "justify-end"
            )}
          >
            {conversation.assistant ? (
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-[#E3F2FD] flex items-center justify-center font-semibold">
                  <img
                    src="/images/assistant-avatar.png"
                    alt="Assistant"
                    className="w-7 h-7 rounded-full object-cover"
                  />
                </div>

                <p className="text-sm rounded-t-lg rounded-br-lg p-3 px-4 text-black/80 bg-[#E3F2FD] shadow-sm">
                  {conversation.assistant}
                </p>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <p className="text-sm rounded-t-lg rounded-bl-lg p-3 px-4 text-black/80 bg-[#F1F8E9] shadow-sm">
                  {conversation.user}
                </p>
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-[#F1F8E9] font-semibold">
                  <img
                    src="/images/user-avatar.png"
                    alt="User"
                    className="w-7 h-7 rounded-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
