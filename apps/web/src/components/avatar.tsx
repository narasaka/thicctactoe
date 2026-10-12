import { cn } from "@thicctactoe/ui/lib/utils";

export default function Avatar({
  name,
  image,
  className,
}: {
  name: string;
  image: string | null | undefined;
  className?: string;
}) {
  const base = cn("size-8 shrink-0 rounded-full bg-neutral-200", className);
  if (image) return <img src={image} alt="" className={cn(base, "object-cover")} />;
  return (
    <span className={cn(base, "grid place-items-center text-sm font-semibold text-neutral-600")}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
