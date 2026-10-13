import { Volume2, VolumeX } from "lucide-react";

import { setMuted, useMuted } from "@/lib/audio";

export default function SoundToggle() {
  const muted = useMuted();
  const label = muted ? "Turn sound on" : "Turn sound off";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={muted}
      onClick={() => setMuted(!muted)}
      className="grid size-9 place-items-center rounded-full bg-white text-neutral-600 shadow-sm transition hover:bg-neutral-50"
    >
      {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
    </button>
  );
}
