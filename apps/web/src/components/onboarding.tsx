import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@thicctactoe/ui/components/dialog";

import { authClient } from "@/lib/auth-client";

import Avatar from "./avatar";
import NameForm from "./name-form";

/**
 * Greets a player the first time they sign in and asks them to pick a name,
 * starting from the one their provider gave us. It can't be dismissed; once
 * the name is saved the account is marked onboarded and the session refresh
 * closes it.
 */
export default function Onboarding() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const open = !!user && !user.isAnonymous && !user.onboarded;

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 rounded-2xl bg-white p-6 text-center text-base shadow-xl ring-0 sm:max-w-sm"
      >
        {user && (
          <>
            <Avatar name={user.name} image={user.image} className="mx-auto size-14" />
            <DialogTitle className="mt-4 text-2xl font-extrabold tracking-tight">
              Welcome to ThiccTacToe
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-gray-500">
              Pick the name opponents and the leaderboard will see. You can change it later from the
              menu.
            </DialogDescription>
            <NameForm initial={user.name} submitLabel="Let's play" />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
