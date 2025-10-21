import { PromptInputTextarea } from "@/components/ui/prompt-input";
import { useInputStore } from "@/store/store";

interface ChatInputTextareaProps {
  placeholder: string;
  disabled: boolean;
  handleSubmit: () => void;
}

export function ChatInputTextarea({
  handleSubmit,
  placeholder,
  disabled,
}: ChatInputTextareaProps) {
  const { disableInput } = useInputStore();

  return (
    <PromptInputTextarea
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (!disabled && !disableInput) {
            handleSubmit();
          }
        }
      }}
      placeholder={placeholder}
      disabled={disabled || disableInput}
    />
  );
}
