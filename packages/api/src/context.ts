import type { Session } from "@thicctactoe/auth";

import type { Arena } from "./arena";

export type Context = {
  session: Session | null;
  arena: Arena;
};
