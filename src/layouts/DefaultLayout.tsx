import type { ComponentPropsWithRef } from 'react';

const DefaultLayout: React.FC<ComponentPropsWithRef<'div'>> = ({
  className,
  children,
}) => {
  return (
    <main className="relative grid min-h-screen place-items-center bg-neutral-100">
      <div className={className}>{children}</div>
      <footer className="absolute bottom-5 font-mono text-sm text-gray-500">
        ✌🏻 narasaka, {new Date().getFullYear()}
      </footer>
    </main>
  );
};

export default DefaultLayout;
