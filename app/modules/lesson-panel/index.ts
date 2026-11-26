import {
  buildTabs,
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
