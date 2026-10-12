import { createAuth } from "@thicctactoe/auth";
import { createDb } from "@thicctactoe/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
