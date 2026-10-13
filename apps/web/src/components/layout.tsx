import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@thicctactoe/ui/lib/utils";
import type { ReactNode } from "react";

import SoundToggle from "./sound-toggle";
import UserBadge from "./user-badge";

export default function Layout({
  className,
  fit = false,
  children,
}: {
  className?: string;
  /** On phones, fill exactly one screen and stretch the content to it, so play never scrolls. */
  fit?: boolean;
  children: ReactNode;
}) {
  const home = useLocation({ select: (location) => location.pathname === "/" });
  // One shrinkable column: a long unbreakable line (e.g. truncated text) must not widen the page.
  return (
    <main
      className={cn(
        "relative grid min-h-dvh grid-cols-[minmax(0,1fr)] place-items-center bg-neutral-100 px-4 pt-16 pb-12",
        fit && "max-md:h-dvh max-md:place-items-stretch max-md:overflow-hidden max-md:pb-4",
      )}
    >
      <header className="absolute inset-x-4 top-4 flex items-center justify-between">
        {home ? (
          <span />
        ) : (
          <Link to="/" className="font-extrabold tracking-tight text-neutral-800">
            ThiccTacToe
          </Link>
        )}
        <div className="flex items-center gap-2">
          <SoundToggle />
          <UserBadge />
        </div>
      </header>
      <div className={cn(fit && "max-md:min-h-0", className)}>{children}</div>
      <footer
        className={cn("absolute bottom-5 font-mono text-sm text-gray-500", fit && "max-md:hidden")}
      >
        ✌🏻 narasaka, {new Date().getFullYear()}
      </footer>
    </main>
  );
}
