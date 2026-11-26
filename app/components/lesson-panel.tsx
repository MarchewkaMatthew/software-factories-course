import { useEffect, useState } from "react";
import { useFetcher, useLocation } from "react-router";
import { MessageSquare, NotebookPen } from "lucide-react";
import {
  lessonPanel,
  tabForHash,
  type LessonPanelTab,
  type LessonPanelTabId,
} from "~/modules/lesson-panel";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import {
  CommentThread,
  type RenderedComment,
} from "~/components/comment-thread";
import { formatRelativeTime } from "~/lib/utils";

type Note = { body: string; updatedAt: string } | null;

const TAB_ICONS: Record<LessonPanelTabId, typeof NotebookPen> = {
  notes: NotebookPen,
  discussion: MessageSquare,
};

/**
 * The Student's Note and the lesson's Discussion, as tabs of one panel.
 * Both panels stay mounted so a half-written note or comment survives a
 * switch to the other tab.
 */
export function LessonPanel({
  note,
  comments,
  currentUserId,
  canModerate,
  instructorName,
}: {
  note: Note;
  comments: RenderedComment[];
  currentUserId: number | null;
  canModerate: boolean;
  instructorName: string;
}) {
  const signedIn = currentUserId !== null;
  const { tabs, defaultTab } = lessonPanel({ signedIn, comments });
  const [tab, setTab] = usePanelTab(defaultTab);

  return (
    <Card className="mb-8 gap-0 py-0">
      <Tabs value={tab} onValueChange={setTab} className="gap-0">
        <div className="border-b px-4 py-3">
          <LessonPanelTabs tabs={tabs} />
        </div>

        {signedIn && (
          <TabsContent
            value="notes"
            forceMount
            className="p-4 data-[state=inactive]:hidden"
          >
            <LessonNote note={note} />
          </TabsContent>
        )}

        <TabsContent
          value="discussion"
          forceMount
          className="p-4 data-[state=inactive]:hidden"
        >
          <CommentThread
            comments={comments}
            currentUserId={currentUserId}
            canModerate={canModerate}
            canPost
            instructorName={instructorName}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

/**
 * The open tab. The server never sees the URL hash, so the tab follows a
 * `#comment-N` link only after hydration, then scrolls to that comment.
 */
function usePanelTab(defaultTab: LessonPanelTabId) {
  const [tab, setTab] = useState<string>(defaultTab);
  const { hash } = useLocation();

  useEffect(() => {
    const asked = tabForHash(hash);
    if (!asked) return;
    setTab(asked);
    requestAnimationFrame(() =>
      document.getElementById(hash.slice(1))?.scrollIntoView()
    );
  }, [hash]);

  return [tab, setTab] as const;
}

function LessonPanelTabs({ tabs }: { tabs: LessonPanelTab[] }) {
  return (
    <TabsList>
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab.id];
        return (
          <TabsTrigger key={tab.id} value={tab.id}>
            <Icon />
            {tab.label}
            {tab.count !== undefined && (
              <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">
                {tab.count}
              </span>
            )}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}

function LessonNote({ note }: { note: Note }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const isSaving = fetcher.state !== "idle";
  const error = fetcher.data?.error;

  return (
    <fetcher.Form method="post" className="space-y-3">
      <input type="hidden" name="intent" value="save-note" />
      <Textarea
        name="body"
        rows={6}
        defaultValue={note?.body ?? ""}
        placeholder="Only you can read this."
        aria-label="Your notes"
        className="resize-y"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
        {error && <span className="text-sm text-red-600">{error}</span>}
        {!error && note && (
          <span
            suppressHydrationWarning
            className="text-xs text-muted-foreground"
          >
            Last edited {formatRelativeTime(note.updatedAt)}
          </span>
        )}
      </div>
    </fetcher.Form>
  );
}
