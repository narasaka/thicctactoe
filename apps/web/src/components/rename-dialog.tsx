import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@thicctactoe/ui/components/dialog";

import NameForm from "./name-form";

/** Lets a signed-in player pick the name shown in games and on the leaderboard. */
export default function RenameDialog({
  open,
  onOpenChange,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 rounded-2xl bg-white p-6 text-base shadow-xl ring-0 sm:max-w-sm"
      >
        <DialogTitle className="text-2xl font-pixel">Change your name</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-gray-500">
          This is what opponents and the leaderboard see.
        </DialogDescription>
        {/* The form unmounts while closed, so it starts from the current name each time. */}
        <NameForm initial={current} submitLabel="Save" onSaved={() => onOpenChange(false)}>
          <DialogClose className="mt-2 text-sm text-neutral-400 underline hover:text-neutral-600">
            Cancel
          </DialogClose>
        </NameForm>
      </DialogContent>
    </Dialog>
  );
}
