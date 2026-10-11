import type { Move, Player } from "@thicctactoe/game";
import { defineRelationsPart, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const gameStatus = pgEnum("game_status", ["waiting", "active", "finished", "cancelled"]);
export const gameEndReason = pgEnum("game_end_reason", ["line", "draw", "resign"]);

export const game = pgTable(
  "game",
  {
    id: text("id").primaryKey(),
    status: gameStatus("status").default("waiting").notNull(),
    /** Private games are only joinable by link; public ones by matchmaking. */
    private: boolean("private").default(false).notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    playerX: text("player_x").references(() => user.id, { onDelete: "set null" }),
    playerO: text("player_o").references(() => user.id, { onDelete: "set null" }),
    moves: jsonb("moves").$type<Move[]>().default([]).notNull(),
    winner: text("winner").$type<Player>(),
    endReason: gameEndReason("end_reason"),
    ratingDelta: jsonb("rating_delta").$type<Record<Player, number>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    finishedAt: timestamp("finished_at"),
  },
  (table) => [
    index("game_matchmaking_idx")
      .on(table.createdAt)
      .where(sql`${table.status} = 'waiting' and ${table.private} = false`),
    index("game_playerX_idx").on(table.playerX),
    index("game_playerO_idx").on(table.playerO),
  ],
);

export const playerStats = pgTable(
  "player_stats",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    rating: integer("rating").default(1000).notNull(),
    wins: integer("wins").default(0).notNull(),
    losses: integer("losses").default(0).notNull(),
    draws: integer("draws").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("player_stats_rating_idx").on(table.rating)],
);

export const playRelations = defineRelationsPart({ user, game, playerStats }, (r) => ({
  game: {
    x: r.one.user({ from: r.game.playerX, to: r.user.id }),
    o: r.one.user({ from: r.game.playerO, to: r.user.id }),
  },
  playerStats: {
    user: r.one.user({ from: r.playerStats.userId, to: r.user.id, optional: false }),
  },
}));
