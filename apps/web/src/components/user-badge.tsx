import { useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@thicctactoe/ui/components/dropdown-menu";
import { toast } from "sonner";

import { type Provider, authClient, signInWith } from "@/lib/auth-client";

import Avatar from "./avatar";

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "google", label: "Sign in with Google" },
  { id: "github", label: "Sign in with GitHub" },
];

export default function UserBadge() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return null;

  const user = session?.user;
  const guest = !user || user.isAnonymous;
  const signIn = (provider: Provider) =>
    void signInWith(provider).then(({ error }) => {
      if (error) toast.error(error.message ?? "Sign in failed");
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full bg-white py-1 pr-3 pl-1 text-sm shadow-sm transition hover:bg-neutral-50">
        <Avatar name={user?.name ?? "?"} image={user?.image} className="size-7" />
        <span className="max-w-40 truncate">{user ? user.name : "Sign in"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56 bg-white">
        {guest ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-neutral-500">
              {user
                ? "Playing as a guest. Sign in to keep your record and join the leaderboard."
                : "Sign in to join the leaderboard."}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PROVIDERS.map(({ id, label }) => (
              <DropdownMenuItem key={id} onClick={() => signIn(id)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ) : (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-neutral-500">{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                void authClient.signOut({
                  fetchOptions: { onSuccess: () => void navigate({ to: "/" }) },
                })
              }
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
