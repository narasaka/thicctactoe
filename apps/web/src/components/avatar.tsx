import { cn } from "@thicctactoe/ui/lib/utils";
import { Bot } from "lucide-react";

export default function Avatar({
  name,
  image,
  bot = false,
  className,
}: {
  name: string;
  image: string | null | undefined;
  bot?: boolean;
  className?: string;
}) {
  const base = cn("size-8 shrink-0 rounded-full bg-neutral-200", className);
  if (bot) {
    return (
      <span className={cn(base, "grid place-items-center bg-sky-100 text-sky-700")}>
        <Bot className="size-3/5" />
      </span>
    );
  }
  if (image) return <img src={image} alt="" className={cn(base, "object-cover")} />;
  return (
    <span className={cn(base, "grid place-items-center text-sm font-semibold text-neutral-600")}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
