import type { Move, Player } from "@thicctactoe/game";
import { defineRelationsPart, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { publicId } from "../public-id";
import { user } from "./auth";

/** A move as stored: the move itself plus when the server accepted it. */
export type LoggedMove = Move & {
  /** ISO timestamp. Missing on moves played before move times were logged. */
  at?: string;
};

export const gameStatus = pgEnum("game_status", ["waiting", "active", "finished", "cancelled"]);
export const gameEndReason = pgEnum("game_end_reason", ["line", "draw", "resign", "abandon"]);

export const game = pgTable(
  "game",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    /** The id in game links. */
    publicId: text("public_id").notNull().unique().$defaultFn(publicId),
    status: gameStatus("status").default("waiting").notNull(),
    /** Private games are only joinable by link; public ones by matchmaking. */
    private: boolean("private").default(false).notNull(),
    /** Whether the game may change ratings. Matchmade games are; invites are if their host chose so. */
    rated: boolean("rated").default(false).notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    playerX: text("player_x").references(() => user.id, { onDelete: "set null" }),
    playerO: text("player_o").references(() => user.id, { onDelete: "set null" }),
    moves: jsonb("moves").$type<LoggedMove[]>().default([]).notNull(),
    winner: text("winner").$type<Player>(),
    endReason: gameEndReason("end_reason"),
    ratingDelta: jsonb("rating_delta").$type<Record<Player, number>>(),
    /** The cap on rating moving between the same two players cut this game's change short. */
    ratingCapped: boolean("rating_capped").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    /** When the second player sat down. */
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    /** The seat that offered to play again, once the game is over. */
    rematchOffer: text("rematch_offer").$type<Player>(),
    /** Public id of the game both players agreed to play next. */
    rematchId: text("rematch_id"),
  },
  (table) => [
    index("game_matchmaking_idx")
      .on(table.createdAt)
      .where(sql`${table.status} = 'waiting' and ${table.private} = false`),
    index("game_stalled_idx")
      .on(table.updatedAt)
      .where(sql`${table.status} = 'active'`),
    index("game_unplayed_idx")
      .on(table.createdAt)
      .where(sql`${table.status} = 'cancelled' and ${table.startedAt} is null`),
    index("game_playerX_idx").on(table.playerX),
    index("game_playerO_idx").on(table.playerO),
  ],
);

export const playerStats = pgTable(
  "player_stats",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .unique()
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

/**
 * One row per open watch stream of a seated player, on any server instance.
 * The instance holding the stream refreshes `seenAt`; a row that stops being
 * refreshed belongs to an instance that died.
 */
export const presence = pgTable(
  "presence",
  {
    id: text("id").primaryKey(),
    /** The game's public id, which is what every live update is keyed by. */
    gameId: text("game_id")
      .notNull()
      .references(() => game.publicId, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    seenAt: timestamp("seen_at").defaultNow().notNull(),
    /** When the stream closed. Kept for a while so abandonment can tell how long ago. */
    leftAt: timestamp("left_at"),
  },
  (table) => [index("presence_gameId_idx").on(table.gameId)],
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
