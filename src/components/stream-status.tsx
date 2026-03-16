interface StreamStatusProps {
  message: string;
  isActive: boolean;
}

export function StreamStatus({ message, isActive }: StreamStatusProps) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 text-blue-800">
      {isActive && (
        <div className="h-4 w-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      )}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
