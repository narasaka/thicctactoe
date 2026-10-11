import type { Session } from "@thicctactoe/auth";
import type { Database } from "@thicctactoe/db";

export type Context = {
  session: Session | null;
  db: Database;
};
