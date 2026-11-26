export type LessonPanelTabId = "notes" | "discussion";

export type LessonPanelTab = {
  id: LessonPanelTabId;
  label: string;
  /** Shown beside the label; absent when there is nothing to count. */
  count?: number;
};

export type CountableComment = {
  deleted: boolean;
  replies: CountableComment[];
};

export function countVisibleComments(comments: CountableComment[]): number {
  return comments.reduce(
    (total, comment) =>
      total + (comment.deleted ? 0 : 1) + countVisibleComments(comment.replies),
    0
  );
}

export function buildTabs({
  signedIn,
  comments,
}: {
  signedIn: boolean;
  comments: CountableComment[];
}): LessonPanelTab[] {
  const count = countVisibleComments(comments);
  const discussion: LessonPanelTab = {
    id: "discussion",
    label: "Discussion",
    ...(count > 0 ? { count } : {}),
  };
  // Notes are private to a person, so a visitor without a session has none.
  if (!signedIn) return [discussion];
  return [{ id: "notes", label: "Your notes" }, discussion];
}
