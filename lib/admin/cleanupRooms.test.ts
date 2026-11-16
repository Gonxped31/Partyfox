import { describe, expect, it } from "vitest";
import { CLOSED_DAYS, IDLE_DAYS, roomsToClean } from "./cleanupRooms";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 16);
const room = (fields: { createdAt?: number; lastActive?: number; closedAt?: number }) => ({
  meta: { gameSlug: "ftw", maxPlayers: 2, ...(fields.createdAt != null ? { createdAt: fields.createdAt } : {}) },
  ...(fields.lastActive != null ? { lastActive: fields.lastActive } : {}),
  ...(fields.closedAt != null ? { closedAt: fields.closedAt } : {}),
});

describe("roomsToClean", () => {
  it("picks rooms idle for the limit, by lastActive, else by creation", () => {
    const games = {
      abc234: room({ createdAt: NOW - 90 * DAY, lastActive: NOW - IDLE_DAYS * DAY }), // idle exactly the limit
      bcd345: room({ createdAt: NOW - 90 * DAY, lastActive: NOW - (IDLE_DAYS - 1) * DAY }), // played recently
      cde456: room({ createdAt: NOW - (IDLE_DAYS + 1) * DAY }), // never played, made long ago
      def567: room({ createdAt: NOW - DAY }), // never played, made yesterday
    };
    expect(roomsToClean(games, NOW)).toEqual(["cde456", "abc234"]);
  });

  it("picks closed rooms once they've been closed long enough, whatever their activity", () => {
    const games = {
      abc234: room({ createdAt: NOW - 2 * DAY, lastActive: NOW - DAY, closedAt: NOW - CLOSED_DAYS * DAY }),
      bcd345: room({ createdAt: NOW - 2 * DAY, lastActive: NOW - DAY, closedAt: NOW - (CLOSED_DAYS - 1) * DAY }),
    };
    expect(roomsToClean(games, NOW)).toEqual(["abc234"]);
  });

  it("lists the oldest first", () => {
    const games = {
      abc234: room({ createdAt: NOW - 40 * DAY }),
      bcd345: room({ createdAt: NOW - 400 * DAY }),
      cde456: room({ createdAt: NOW - 90 * DAY, closedAt: NOW - 100 * DAY }),
    };
    expect(roomsToClean(games, NOW)).toEqual(["bcd345", "cde456", "abc234"]);
  });

  it("leaves alone what it can't date or isn't a room", () => {
    const games = {
      abc234: room({}), // no dates at all
      bcd345: { presence: { u1: { online: false, lastSeen: 1 } } }, // no meta
      "not-a-code": room({ createdAt: 1 }),
      cde456: room({ createdAt: Number.NaN }),
    };
    expect(roomsToClean(games, NOW)).toEqual([]);
    expect(roomsToClean(null, NOW)).toEqual([]);
  });
});
