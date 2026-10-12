import type { ReactNode } from "react";

export default function Layout({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <main className="relative grid min-h-dvh place-items-center bg-neutral-100 pb-12">
      <div className={className}>{children}</div>
      <footer className="absolute bottom-5 font-mono text-sm text-gray-500">
        ✌🏻 narasaka, {new Date().getFullYear()}
      </footer>
    </main>
  );
}
