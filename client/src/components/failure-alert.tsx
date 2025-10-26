import React from "react";
import { CircleX } from "lucide-react";

type FailureAlertProps = {
  message: string;
  duration?: number;
  setMessage?: (message: string | null) => void;
  setStatus?: (status: "error" | "saving" | "saved" | null) => void;
};

export const FailureAlert = ({
  message,
  duration = 2000,
  setMessage,
  setStatus,
}: FailureAlertProps) => {
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (setMessage !== undefined) setMessage(null);
      if (setStatus !== undefined) setStatus(null);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, setMessage, setStatus]);

  if (!visible) return null;

  return (
    <div className="fixed max-sm:w-[95%] max-sm:mx-auto bottom-3 max-sm:left-1/2 max-sm:-translate-x-1/2 sm:right-4 z-999">
      <div className="rounded-md bg-red-50 border border-red-400 p-4 shadow-lg">
        <div className="flex">
          <div className="shrink-0">
            <CircleX className="h-5 w-5 text-red-400" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-red-800">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
