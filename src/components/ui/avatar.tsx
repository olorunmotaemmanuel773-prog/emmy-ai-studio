import * as React from "react";
import { cn, getInitials } from "@/lib/utils";

export function Avatar({
  src,
  name,
  className,
  size = "md",
}: {
  src?: string | null;
  name?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const [failed, setFailed] = React.useState(false);
  const dims = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg", xl: "h-24 w-24 text-2xl" }[size];
  const showImage = src && !failed;
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-brand-gradient font-display font-bold text-white",
        dims,
        className,
      )}
      aria-label={name ?? "User avatar"}
    >
      {showImage ? (
        <img src={src} alt={name ?? "Avatar"} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
}
