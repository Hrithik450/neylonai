export const LoadingDots = () => {
  return (
    <div className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-white/80 rounded-full animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 bg-white/80 rounded-full animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 bg-white/80 rounded-full animate-bounce" />
    </div>
  );
};
