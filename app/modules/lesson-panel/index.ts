import {
  buildTabs,
  linksToComment,
  type CountableComment,
  type LessonPanelTab,
  type LessonPanelTabId,
} from "./lib/tabs";

export type { CountableComment, LessonPanelTab, LessonPanelTabId };

/**
 * The lesson page shows the Student's Note and the lesson's Discussion in one
 * tabbed panel under the video. This decides which tabs it has, what they are
 * called, and which one opens first.
 */
export function lessonPanel(input: {
  signedIn: boolean;
  comments: CountableComment[];
}): { tabs: LessonPanelTab[]; defaultTab: LessonPanelTabId } {
  const tabs = buildTabs(input);
  return { tabs, defaultTab: tabs[0].id };
}

/**
 * The tab a URL hash asks for, or null. A notification links to
 * `#comment-N`, which must open the Discussion: the comment is hidden while
 * the Notes tab is open, so the browser cannot scroll to it.
 */
export function tabForHash(hash: string): LessonPanelTabId | null {
  return linksToComment(hash) ? "discussion" : null;
}
