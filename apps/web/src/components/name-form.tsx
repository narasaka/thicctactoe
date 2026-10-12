import { useQueryClient } from "@tanstack/react-query";
import { DISPLAY_NAME_MAX, displayName } from "@thicctactoe/auth/names";
import { cn } from "@thicctactoe/ui/lib/utils";
import { type FormEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

import Button from "./button";

/** A name field that saves to the signed-in player's account. */
export default function NameForm({
  initial,
  submitLabel,
  onSaved,
  children,
}: {
  initial: string;
  submitLabel: string;
  onSaved?: () => void;
  /** Extra actions below the submit button. */
  children?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial);
  const [saving, setSaving] = useState(false);
  const cleaned = displayName(name);
  const length = [...name.trim()].length;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!cleaned) return;
    setSaving(true);
    const { error } = await authClient.updateUser({ name: cleaned });
    setSaving(false);
    if (error) {
      toast.error(error.message ?? "Couldn't change your name");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: orpc.leaderboard.key() });
    onSaved?.();
  };

  return (
    <form onSubmit={save} className="mt-5 flex flex-col gap-2">
      <div className="relative">
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Display name"
          aria-invalid={!cleaned}
          className="w-full rounded-lg border border-neutral-300 py-2 pr-16 pl-3 outline-none focus:border-neutral-500 aria-invalid:border-rose-400"
        />
        <span
          className={cn(
            "absolute top-1/2 right-3 -translate-y-1/2 font-mono text-xs",
            length > DISPLAY_NAME_MAX ? "text-rose-600" : "text-neutral-400",
          )}
        >
          {length}/{DISPLAY_NAME_MAX}
        </span>
      </div>
      <Button type="submit" className="mt-4" disabled={saving || !cleaned}>
        {saving ? "Saving…" : submitLabel}
      </Button>
      {children}
    </form>
  );
}
