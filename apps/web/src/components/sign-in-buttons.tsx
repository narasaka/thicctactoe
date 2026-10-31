import { cn } from "@thicctactoe/ui/lib/utils";

import { PROVIDERS, signInWith } from "@/lib/auth-client";

import ProviderIcon from "./provider-icon";

/** One button per sign-in provider, each coming back to the current page. */
export default function SignInButtons({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {PROVIDERS.map(({ id, name }) => (
        <button
          key={id}
          type="button"
          className="flex items-center justify-center gap-3 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 active:bg-neutral-200"
          onClick={() => signInWith(id)}
        >
          <ProviderIcon provider={id} />
          Continue with {name}
        </button>
      ))}
    </div>
  );
}
