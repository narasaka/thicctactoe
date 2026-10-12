import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

import UserBadge from "./user-badge";

export default function Layout({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const home = useLocation({ select: (location) => location.pathname === "/" });
  // One shrinkable column: a long unbreakable line (e.g. truncated text) must not widen the page.
  return (
    <main className="relative grid min-h-dvh grid-cols-[minmax(0,1fr)] place-items-center bg-neutral-100 px-4 pt-16 pb-12">
      <header className="absolute inset-x-4 top-4 flex items-center justify-between">
        {home ? (
          <span />
        ) : (
          <Link to="/" className="font-extrabold tracking-tight text-neutral-800">
            ThiccTacToe
          </Link>
        )}
        <UserBadge />
      </header>
      <div className={className}>{children}</div>
      <footer className="absolute bottom-5 font-mono text-sm text-gray-500">
        ✌🏻 narasaka, {new Date().getFullYear()}
      </footer>
    </main>
  );
}
