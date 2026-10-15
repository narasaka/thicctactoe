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
import { useState } from "react";

import { PROVIDERS, authClient, signInWith } from "@/lib/auth-client";

import Avatar from "./avatar";
import ProviderIcon from "./provider-icon";
import RenameDialog from "./rename-dialog";

export default function UserBadge() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [renaming, setRenaming] = useState(false);
  if (isPending) return null;

  const user = session?.user;
  const guest = !user || user.isAnonymous;
  const profile = user && (
    <DropdownMenuItem
      onClick={() =>
        void navigate({ to: "/players/$playerId", params: { playerId: user.publicId } })
      }
    >
      Your profile
    </DropdownMenuItem>
  );

  return (
    <>
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
              {PROVIDERS.map(({ id, name }) => (
                <DropdownMenuItem key={id} onClick={() => signInWith(id)}>
                  <ProviderIcon provider={id} />
                  Sign in with {name}
                </DropdownMenuItem>
              ))}
              {user && (
                <>
                  <DropdownMenuSeparator />
                  {profile}
                </>
              )}
            </DropdownMenuGroup>
          ) : (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-neutral-500">{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {profile}
              <DropdownMenuItem onClick={() => setRenaming(true)}>Change name</DropdownMenuItem>
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
      {user && !guest && (
        <RenameDialog open={renaming} onOpenChange={setRenaming} current={user.name} />
      )}
    </>
  );
}
