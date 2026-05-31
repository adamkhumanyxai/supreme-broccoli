export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-serif text-xl tracking-tight lowercase ${className}`}>
      interview compass
      <span className="text-primary">.</span>
    </span>
  );
}
