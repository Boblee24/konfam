import { describe, expect, it } from "vitest";
import { paidAnnouncement, planUtterances } from "./phrases";

describe("planUtterances", () => {
  const segs = paidAnnouncement("pcm", 2000, "NGN");

  it("plays everything as clips when every clip exists", () => {
    expect(planUtterances(segs, () => true)).toEqual([
      { kind: "clips", urls: ["/voice/pcm/received.mp3", "/voice/en/two.mp3", "/voice/en/thousand.mp3", "/voice/en/naira.mp3", "/voice/pcm/landed.mp3"] },
    ]);
  });

  it("falls back to one en-NG sentence when no clips exist", () => {
    expect(planUtterances(segs, () => false)).toEqual([
      { kind: "tts", text: "You don receive two thousand naira E don land! Konfam.", voice: "en-NG" },
    ]);
  });

  it("speaks the number by voice if one number clip is missing, keeping recorded phrases", () => {
    const plan = planUtterances(segs, (u) => !u.endsWith("/thousand.mp3"));
    expect(plan).toEqual([
      { kind: "clips", urls: ["/voice/pcm/received.mp3"] },
      { kind: "tts", text: "two thousand naira", voice: "en-NG" },
      { kind: "clips", urls: ["/voice/pcm/landed.mp3"] },
    ]);
  });

  it("speaks French amounts with fr-FR, and Wolof phrases fall back to French", () => {
    expect(planUtterances(paidAnnouncement("wo", 1000, "XOF"), () => false)).toEqual([
      { kind: "tts", text: "Vous avez reçu 1000 francs CFA C'est arrivé ! Konfam.", voice: "fr-FR" },
    ]);
  });
});
