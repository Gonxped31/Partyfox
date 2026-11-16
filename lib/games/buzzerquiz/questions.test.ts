import { describe, expect, it } from "vitest";
import { CHOICES, LENGTHS, TOPICS } from "./constants";
import { pickQuestions } from "./game";
import { QUESTIONS } from "./questions";

/** Choices must fit a 390 px wide tile; questions must fit the question card. */
const MAX_CHOICE = 30;
const MAX_QUESTION = 120;
const LONGEST_GAME = Math.max(...LENGTHS);
/** Per topic and language: a room playing one topic gets 6 full-length games before any question repeats. */
const POOL = 120;

describe("questions.json", () => {
  it("has unique ids that fit the rules (1-40 characters)", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.length).toBeGreaterThanOrEqual(1);
      expect(id.length).toBeLessThanOrEqual(40);
    }
  });

  it.each(QUESTIONS.map((q) => [q.id, q] as const))("%s is well formed", (_, q) => {
    expect(["en", "fr"]).toContain(q.lang);
    expect(TOPICS).toContain(q.topic);
    expect(q.question.trim()).toBe(q.question);
    expect(q.question.length).toBeLessThanOrEqual(MAX_QUESTION);
    expect(q.question.endsWith("?")).toBe(true);
    expect(q.choices).toHaveLength(CHOICES);
    for (const choice of q.choices) {
      expect(choice.trim()).toBe(choice);
      expect(choice.length).toBeGreaterThan(0);
      expect(choice.length).toBeLessThanOrEqual(MAX_CHOICE);
    }
    expect(new Set(q.choices.map((c) => c.toLowerCase())).size).toBe(CHOICES);
  });

  it("has enough questions per topic in every language for several games without a repeat", () => {
    for (const lang of ["en", "fr"] as const) {
      for (const topic of TOPICS) {
        expect(QUESTIONS.filter((q) => q.lang === lang && q.topic === topic).length, `${lang} ${topic}`).toBeGreaterThanOrEqual(POOL);
        expect(() => pickQuestions(QUESTIONS, { settings: { lang, topics: [topic], length: LONGEST_GAME } }, Math.random)).not.toThrow();
      }
    }
  });

  it("names each question <topic>-<lang>-<number>", () => {
    const prefix: Record<string, string> = { geography: "geo", cinema: "cin", science: "sci", sport: "spo", music: "mus", history: "his" };
    for (const q of QUESTIONS) expect(q.id).toMatch(new RegExp(`^${prefix[q.topic]}-${q.lang}-[0-9]{2,3}$`));
  });

  it("never asks the same question twice in a language", () => {
    for (const lang of ["en", "fr"] as const) {
      const texts = QUESTIONS.filter((q) => q.lang === lang).map((q) => q.question.toLowerCase());
      expect(texts.filter((text, i) => texts.indexOf(text) !== i), lang).toEqual([]);
    }
  });

  it("writes French questions with French spacing before the question mark", () => {
    for (const q of QUESTIONS.filter((q) => q.lang === "fr")) expect(q.question.endsWith(" ?"), q.id).toBe(true);
  });
});
