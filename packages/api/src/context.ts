import type { Session } from "@thicctactoe/auth";

import type { Arena } from "./arena";
import type { Limits } from "./limits";

export type Context = {
  session: Session | null;
  arena: Arena;
  limits: Limits;
  /** The client's IP address, as far as the server can tell. */
  ip: string;
};
