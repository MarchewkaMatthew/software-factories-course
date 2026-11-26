import { describe, expect, it } from "vitest";
import { lessonPanel, type CountableComment } from "../index";

function comment(overrides: Partial<CountableComment> = {}): CountableComment {
  return { deleted: false, replies: [], ...overrides };
}

describe("lessonPanel", () => {
  it("gives a signed-in Student notes first, then discussion", () => {
    const panel = lessonPanel({ signedIn: true, comments: [] });

    expect(panel.tabs).toEqual([
      { id: "notes", label: "Your notes" },
      { id: "discussion", label: "Discussion" },
    ]);
    expect(panel.defaultTab).toBe("notes");
  });

  it("gives a visitor without a session only the discussion", () => {
    const panel = lessonPanel({ signedIn: false, comments: [comment()] });

    expect(panel.tabs).toEqual([
      { id: "discussion", label: "Discussion", count: 1 },
    ]);
    expect(panel.defaultTab).toBe("discussion");
  });

  it("counts replies alongside top-level comments", () => {
    const panel = lessonPanel({
      signedIn: true,
      comments: [comment({ replies: [comment(), comment()] }), comment()],
    });

    expect(panel.tabs[1]).toEqual({
      id: "discussion",
      label: "Discussion",
      count: 4,
    });
  });

  it("leaves deleted comments out of the count but keeps their replies", () => {
    const panel = lessonPanel({
      signedIn: true,
      comments: [comment({ deleted: true, replies: [comment()] })],
    });

    expect(panel.tabs[1].count).toBe(1);
  });

  it("shows no count when every comment is deleted", () => {
    const panel = lessonPanel({
      signedIn: true,
      comments: [comment({ deleted: true })],
    });

    expect(panel.tabs[1]).toEqual({ id: "discussion", label: "Discussion" });
  });
});
