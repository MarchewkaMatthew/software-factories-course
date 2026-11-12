// PROTOTYPE — throwaway. Answers: "What do Notifications look like and how do
// they behave in Cadence's UI?" (wayfinder ticket "Prototype how Notifications
// look in the app").
//
// Three variants of the in-app feed, mounted in the real app shell and switched
// via `?variant=A|B|C` (sticky across navigation through localStorage):
//   A  Sidebar flyout:   "Notifications" row in the sidebar → popover beside it; toast on arrival
//   B  Inbox page:       "Inbox" row in the sidebar → full /notifications page; no toast, in-page banner
//   C  Header + drawer:  new top bar with a bell → right-hand slide-over; opening clears the badge
//
// The feed is an in-memory STUB standing in for Knock's headless hooks
// (useNotifications / feed store). Entries are the five v1 catalogue types,
// with real seed names. Nothing persists; reload resets the feed.
// Rendered client-only (after hydration), as the Knock decision requires.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Circle,
  Inbox,
  MessageSquare,
  MessageSquareReply,
  Receipt,
  RotateCcw,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { UserRole } from "~/db/schema";
import { PrototypeSwitcher } from "~/components/prototype-switcher";

// ─── Stub feed ────────────────────────────────────────────────────────────────

type Kind =
  | "refund-raised" // A → every Platform Admin
  | "refund-approved" // B → buyer
  | "refund-declined" // C → buyer
  | "staff-answer" // D → question author
  | "new-question"; // E → course's Instructor

interface Notification {
  id: string;
  kind: Kind;
  title: string;
  body: string;
  tag?: string;
  link: string;
  at: number;
  read: boolean;
  seen: boolean;
  archived: boolean;
}

type Seed = Omit<Notification, "id" | "at" | "read" | "seen" | "archived"> & {
  minutesAgo: number;
  read?: boolean;
};

const ACTION_LABEL: Record<Kind, string> = {
  "refund-raised": "Review Refund Request",
  "refund-approved": "View purchase",
  "refund-declined": "See decision",
  "staff-answer": "Read answer",
  "new-question": "Answer question",
};

const NEEDS_ACTION: Kind[] = ["refund-raised", "new-question"];

const TS = "/courses/introduction-to-typescript/lessons";

const SEEDS: Record<string, { initial: Seed[]; arrivals: Seed[] }> = {
  admin: {
    initial: [
      {
        kind: "refund-raised",
        title: "Emma Wilson requested a refund for Introduction to TypeScript",
        body: "“The pace was too fast for me and I couldn't keep up after the generics module…”",
        link: "/admin/refunds",
        minutesAgo: 12,
      },
      {
        kind: "refund-raised",
        title: "Bossy McBossface requested a refund for Building REST APIs with Node.js",
        body: "“We bought seats for the wrong team, sorry!”",
        tag: "Team Licence",
        link: "/admin/refunds",
        minutesAgo: 190,
      },
      {
        kind: "refund-raised",
        title: "Liam Thompson requested a refund for Design Systems with Tailwind",
        body: "“Bought it twice by accident.”",
        link: "/admin/refunds",
        minutesAgo: 60 * 50,
        read: true,
      },
    ],
    arrivals: [
      {
        kind: "refund-raised",
        title: "Olivia Martinez requested a refund for Practical Data Visualisation",
        body: "“Not what I expected from the course description.”",
        link: "/admin/refunds",
        minutesAgo: 0,
      },
      {
        kind: "refund-raised",
        title: "Ava Nakamura requested a refund for Shipping with Docker and Kubernetes",
        body: "“My employer is covering a different course instead.”",
        tag: "Team Licence",
        link: "/admin/refunds",
        minutesAgo: 0,
      },
    ],
  },
  instructor: {
    initial: [
      {
        kind: "new-question",
        title: "New question in Introduction to TypeScript · Generics Basics",
        body: "James Park: Why does `T extends object` reject arrays here? I thought arrays were objects…",
        link: `${TS}/9`,
        minutesAgo: 5,
      },
      {
        kind: "new-question",
        title: "New question in Introduction to TypeScript · Discriminated Unions",
        body: "Sophia Davis: Is there a way to make the switch exhaustive without a default case?",
        link: `${TS}/12`,
        minutesAgo: 64,
      },
      {
        kind: "new-question",
        title: "New question in Design Systems with Tailwind · Design Tokens",
        body: "Ava Nakamura: Should spacing tokens live in the Tailwind config or in CSS variables?",
        link: "/courses/design-systems-with-tailwind/lessons/41",
        minutesAgo: 60 * 26,
        read: true,
      },
    ],
    arrivals: [
      {
        kind: "new-question",
        title: "New question in Introduction to TypeScript · Utility Types",
        body: "Noah Blackwood: When would I reach for Pick over Omit?",
        link: `${TS}/11`,
        minutesAgo: 0,
      },
      {
        kind: "new-question",
        title: "New question in Design Systems with Tailwind · Variants and Composition",
        body: "Isla Fernandes: How do you stop cva variants from exploding combinatorially?",
        link: "/courses/design-systems-with-tailwind/lessons/43",
        minutesAgo: 0,
      },
    ],
  },
  student: {
    initial: [
      {
        kind: "staff-answer",
        title: "Sarah Chen answered your question in Generic Constraints",
        body: "“Good catch: the constraint has to come before the default. Try `<T extends Base = Base>` and it'll compile.”",
        link: `${TS}/10`,
        minutesAgo: 20,
      },
      {
        kind: "refund-approved",
        title: "Your refund for Building REST APIs with Node.js was approved",
        body: "$49.00 is on its way back. “Sorry the course wasn't a fit!”",
        link: "/settings",
        minutesAgo: 60 * 22,
      },
      {
        kind: "refund-declined",
        title: "Your refund for Design Systems with Tailwind was declined",
        body: "“This purchase is outside the 30-day Refund window.”",
        link: "/settings",
        minutesAgo: 60 * 24 * 4,
        read: true,
      },
      {
        kind: "staff-answer",
        title: "Alex Rivera answered your question in Arrays and Tuples",
        body: "“Tuples are fixed-length; if you need variable length, reach for a rest element.”",
        link: `${TS}/5`,
        minutesAgo: 60 * 24 * 6,
        read: true,
      },
    ],
    arrivals: [
      {
        kind: "staff-answer",
        title: "Sarah Chen answered your question in Utility Types",
        body: "“Pick when you know what you want, Omit when you know what you don't.”",
        link: `${TS}/11`,
        minutesAgo: 0,
      },
      {
        kind: "refund-approved",
        title: "Your refund for Practical Data Visualisation was approved",
        body: "$39.00 is on its way back.",
        link: "/settings",
        minutesAgo: 0,
      },
    ],
  },
  "team-admin": {
    initial: [
      {
        kind: "refund-approved",
        title: "Your refund for Building REST APIs with Node.js was approved",
        body: "$490.00 is on its way back. 10 unclaimed Seats were released.",
        tag: "Team Licence",
        link: "/team",
        minutesAgo: 45,
      },
    ],
    arrivals: [
      {
        kind: "refund-declined",
        title: "Your refund for Introduction to TypeScript was declined",
        body: "“Three Seats on this Team Licence are already Claimed.”",
        tag: "Team Licence",
        link: "/team",
        minutesAgo: 0,
      },
    ],
  },
};

let nextId = 1;
function materialise(s: Seed): Notification {
  const { minutesAgo, read, ...rest } = s;
  return {
    ...rest,
    id: `n${nextId++}`,
    at: Date.now() - minutesAgo * 60_000,
    read: !!read,
    seen: !!read,
    archived: false,
  };
}

// one feed per DevUI user, so switching users swaps feeds like Knock would
const feeds = new Map<string, Notification[]>();
const arrivalCursor = new Map<string, number>();
const listeners = new Set<() => void>();
const arrivalListeners = new Set<(n: Notification) => void>();
const emit = () => listeners.forEach((l) => l());

function feedFor(key: string, seedKey: string) {
  if (!feeds.has(key)) feeds.set(key, SEEDS[seedKey].initial.map(materialise));
  return feeds.get(key)!;
}

function update(key: string, fn: (n: Notification[]) => Notification[]) {
  feeds.set(key, fn(feeds.get(key) ?? []));
  emit();
}

interface Viewer {
  id: number;
  role: UserRole;
  isTeamAdmin: boolean;
}

function seedKeyFor(v: Viewer) {
  if (v.role === UserRole.Admin) return "admin";
  if (v.role === UserRole.Instructor) return "instructor";
  return v.isTeamAdmin ? "team-admin" : "student";
}

/** Stand-in for Knock's feed hook. */
function useFeed(viewer: Viewer) {
  const key = String(viewer.id);
  const seedKey = seedKeyFor(viewer);
  const items = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => feedFor(key, seedKey),
    () => [] as Notification[]
  );
  const visible = items.filter((n) => !n.archived).sort((a, b) => b.at - a.at);
  const set = (id: string, patch: Partial<Notification>) =>
    update(key, (all) => all.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  return {
    items: visible,
    unread: visible.filter((n) => !n.read).length,
    unseen: visible.filter((n) => !n.seen).length,
    markRead: (id: string) => set(id, { read: true, seen: true }),
    markUnread: (id: string) => set(id, { read: false }),
    archive: (id: string) => set(id, { archived: true, read: true, seen: true }),
    markAllRead: () =>
      update(key, (all) => all.map((n) => ({ ...n, read: true, seen: true }))),
    markAllSeen: () => update(key, (all) => all.map((n) => ({ ...n, seen: true }))),
    simulateArrival: () => {
      const pool = SEEDS[seedKey].arrivals;
      const i = arrivalCursor.get(key) ?? 0;
      arrivalCursor.set(key, i + 1);
      const n = materialise(pool[i % pool.length]);
      update(key, (all) => [n, ...all]);
      arrivalListeners.forEach((l) => l(n));
    },
    empty: () => update(key, (all) => all.map((n) => ({ ...n, archived: true }))),
    reset: () => {
      feeds.delete(key);
      emit();
    },
  };
}

// ─── Shared bits (small on purpose; layouts are NOT shared) ──────────────────

function timeAgo(at: number) {
  const m = Math.round((Date.now() - at) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function KindIcon({ kind, className }: { kind: Kind; className?: string }) {
  const c = cn("size-4", className);
  if (kind === "refund-raised") return <Receipt className={c} />;
  if (kind === "refund-approved") return <Check className={c} />;
  if (kind === "refund-declined") return <X className={c} />;
  if (kind === "staff-answer") return <MessageSquareReply className={c} />;
  return <MessageSquare className={c} />;
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
      {children}
    </span>
  );
}

function Count({ n, className }: { n: number; className?: string }) {
  if (n === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-5 text-white",
        className
      )}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  });
}

const navRow =
  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors";

// ─── Variant A: Sidebar flyout ───────────────────────────────────────────────

function VariantASidebar({ viewer }: { viewer: Viewer }) {
  const feed = useFeed(viewer);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  return (
    <div ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          navRow,
          open
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <Bell className="size-4" />
        <span className="flex-1 text-left">Notifications</span>
        <Count n={feed.unread} />
      </button>

      {open && (
        <div className="fixed left-56 top-14 z-50 ml-2 flex max-h-[70vh] w-96 flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {feed.unread > 0 && (
              <button
                onClick={feed.markAllRead}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {feed.items.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                You're all caught up.
              </div>
            )}
            {feed.items.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "group relative flex cursor-pointer gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-accent",
                  !n.read && "bg-primary/5"
                )}
                onClick={() => {
                  feed.markRead(n.id);
                  setOpen(false);
                  navigate(n.link);
                }}
              >
                <div className="mt-1.5 w-2 shrink-0">
                  {!n.read && <div className="size-2 rounded-full bg-primary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={cn("text-sm leading-snug", !n.read && "font-semibold")}>
                    {n.title}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {n.body}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {timeAgo(n.at)}
                    {n.tag && <Tag>{n.tag}</Tag>}
                  </div>
                </div>
                <button
                  title={n.read ? "Mark as unread" : "Mark as read"}
                  onClick={(e) => {
                    e.stopPropagation();
                    n.read ? feed.markUnread(n.id) : feed.markRead(n.id);
                  }}
                  className="invisible self-start rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground group-hover:visible"
                >
                  {n.read ? <Circle className="size-3.5" /> : <Check className="size-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Variant B: Inbox page ───────────────────────────────────────────────────

function VariantBSidebar({ viewer }: { viewer: Viewer }) {
  const feed = useFeed(viewer);
  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) =>
        cn(
          navRow,
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      <Inbox className="size-4" />
      <span className="flex-1">Inbox</span>
      <Count n={feed.unread} />
    </NavLink>
  );
}

function dayGroup(at: number) {
  const d = new Date(at);
  const today = new Date();
  const yest = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return "Earlier";
}

export function VariantBPage({ viewer }: { viewer: Viewer }) {
  const feed = useFeed(viewer);
  const navigate = useNavigate();
  const [tab, setTab] = useState<"unread" | "all">("all");
  // B never toasts; new arrivals land behind a banner so the list doesn't jump
  const [pending, setPending] = useState<string[]>([]);
  useEffect(() => {
    const l = (n: Notification) => setPending((p) => [...p, n.id]);
    arrivalListeners.add(l);
    return () => void arrivalListeners.delete(l);
  }, []);

  const shown = feed.items
    .filter((n) => !pending.includes(n.id))
    .filter((n) => (tab === "unread" ? !n.read : true));
  const groups = useMemo(() => {
    const g = new Map<string, Notification[]>();
    for (const n of shown) {
      const k = dayGroup(n.at);
      g.set(k, [...(g.get(k) ?? []), n]);
    }
    return [...g.entries()];
  }, [shown]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            {feed.unread} unread · {feed.items.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border p-0.5 text-sm">
            {(["all", "unread"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded px-3 py-1 capitalize",
                  tab === t ? "bg-accent font-medium" : "text-muted-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={feed.markAllRead} disabled={feed.unread === 0}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
      </div>

      {pending.length > 0 && (
        <button
          onClick={() => setPending([])}
          className="mb-4 w-full rounded-md border border-primary/40 bg-primary/10 py-2 text-sm font-medium text-primary hover:bg-primary/15"
        >
          {pending.length} new notification{pending.length > 1 ? "s" : ""} · Show
        </button>
      )}

      {shown.length === 0 && (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          <Inbox className="mx-auto mb-2 size-8 opacity-40" />
          {tab === "unread" ? "No unread notifications." : "Nothing here yet."}
        </div>
      )}

      {groups.map(([label, items]) => (
        <section key={label} className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </h2>
          <div className="divide-y rounded-lg border">
            {items.map((n) => (
              <div key={n.id} className={cn("flex gap-4 p-4", !n.read && "bg-primary/5")}>
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full",
                    n.read ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
                  )}
                >
                  <KindIcon kind={n.kind} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</span>
                    {n.tag && <Tag>{n.tag}</Tag>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <Button
                      size="sm"
                      variant={NEEDS_ACTION.includes(n.kind) ? "default" : "outline"}
                      onClick={() => {
                        feed.markRead(n.id);
                        navigate(n.link);
                      }}
                    >
                      {ACTION_LABEL[n.kind]}
                    </Button>
                    <button
                      onClick={() => (n.read ? feed.markUnread(n.id) : feed.markRead(n.id))}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Mark as {n.read ? "unread" : "read"}
                    </button>
                    <span className="ml-auto text-xs text-muted-foreground">{timeAgo(n.at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Variant C: Header bell + drawer ─────────────────────────────────────────

function VariantCHeader({ viewer }: { viewer: Viewer }) {
  const feed = useFeed(viewer);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  // C's read model: opening the drawer marks everything *seen* (badge clears),
  // but each item stays visually unread until it's clicked.
  const openDrawer = () => {
    setOpen(true);
    feed.markAllSeen();
  };

  const action = feed.items.filter((n) => NEEDS_ACTION.includes(n.kind));
  const updates = feed.items.filter((n) => !NEEDS_ACTION.includes(n.kind));

  const Card = ({ n }: { n: Notification }) => (
    <div
      className={cn(
        "group relative rounded-lg border p-3 transition-colors",
        n.read ? "bg-card" : "border-primary/40 bg-primary/5"
      )}
    >
      <button
        title="Dismiss"
        onClick={() => feed.archive(n.id)}
        className="absolute right-2 top-2 invisible rounded p-0.5 text-muted-foreground hover:bg-accent group-hover:visible"
      >
        <X className="size-3.5" />
      </button>
      <div className="flex items-center gap-2 pr-5 text-xs text-muted-foreground">
        <KindIcon kind={n.kind} className="size-3.5" />
        {timeAgo(n.at)}
        {n.tag && <Tag>{n.tag}</Tag>}
        {!n.read && <span className="ml-auto size-2 rounded-full bg-primary" />}
      </div>
      <div className={cn("mt-1.5 text-sm", !n.read && "font-semibold")}>{n.title}</div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
      <button
        onClick={() => {
          feed.markRead(n.id);
          setOpen(false);
          navigate(n.link);
        }}
        className="mt-2 text-xs font-medium text-primary hover:underline"
      >
        {ACTION_LABEL[n.kind]} →
      </button>
    </div>
  );

  return (
    <div className="sticky top-0 z-40 flex h-14 items-center justify-end border-b bg-background/90 px-6 backdrop-blur">
      <div ref={ref}>
        <button
          onClick={() => (open ? setOpen(false) : openDrawer())}
          className="relative rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Notifications"
        >
          {feed.unseen > 0 ? <BellRing className="size-5" /> : <Bell className="size-5" />}
          <Count n={feed.unseen} className="absolute -right-0.5 -top-0.5" />
        </button>
        {open && (
          <div className="fixed inset-y-0 right-0 z-50 flex w-[26rem] flex-col border-l bg-background shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="font-semibold">Notifications</span>
              <div className="flex items-center gap-1">
                <Button size="xs" variant="ghost" onClick={feed.markAllRead}>
                  <CheckCheck /> Read all
                </Button>
                <Button size="icon-xs" variant="ghost" onClick={() => setOpen(false)}>
                  <X />
                </Button>
              </div>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto p-4">
              {feed.items.length === 0 && (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  <Bell className="mx-auto mb-2 size-8 opacity-30" />
                  No notifications.
                </div>
              )}
              {action.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Needs your action
                  </h3>
                  <div className="space-y-2">
                    {action.map((n) => (
                      <Card key={n.id} n={n} />
                    ))}
                  </div>
                </section>
              )}
              {updates.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Updates
                  </h3>
                  <div className="space-y-2">
                    {updates.map((n) => (
                      <Card key={n.id} n={n} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Controller ──────────────────────────────────────────────────────────────

const VARIANTS = [
  { key: "A", name: "Sidebar flyout + toast" },
  { key: "B", name: "Inbox page, no toast" },
  { key: "C", name: "Header bell + drawer" },
];
const STORAGE = "cadence-prototype-notifications-variant";

export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

export function useNotificationsVariant() {
  const hydrated = useHydrated();
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get("variant");
  const [stored, setStored] = useState<string | null>(null);
  useEffect(() => {
    if (fromUrl) localStorage.setItem(STORAGE, fromUrl);
    setStored(localStorage.getItem(STORAGE));
  }, [fromUrl]);
  const variant = fromUrl ?? stored ?? "A";
  const setVariant = (v: string) => {
    localStorage.setItem(STORAGE, v);
    setStored(v);
    setParams(
      (p) => {
        p.set("variant", v);
        return p;
      },
      { replace: true, preventScrollReset: true }
    );
  };
  return { hydrated, variant, setVariant };
}

/** Mounted once in the app layout; returns the slots each variant fills. */
export function useNotificationsPrototype(viewer: Viewer | null) {
  const { hydrated, variant, setVariant } = useNotificationsVariant();
  const navigate = useNavigate();

  // arrival toasts: A and C toast, B doesn't
  useEffect(() => {
    if (variant === "B") return;
    const l = (n: Notification) =>
      toast(n.title, {
        description: n.body,
        icon: <KindIcon kind={n.kind} />,
        action: {
          label: ACTION_LABEL[n.kind],
          onClick: () => navigate(n.link),
        },
      });
    arrivalListeners.add(l);
    return () => void arrivalListeners.delete(l);
  }, [variant, navigate]);

  if (!hydrated || !viewer) {
    return { sidebarSlot: null, headerSlot: null, switcher: null };
  }

  return {
    sidebarSlot:
      variant === "A" ? (
        <VariantASidebar viewer={viewer} />
      ) : variant === "B" ? (
        <VariantBSidebar viewer={viewer} />
      ) : null,
    headerSlot: variant === "C" ? <VariantCHeader viewer={viewer} /> : null,
    switcher: (
      <PrototypeSwitcher variants={VARIANTS} current={variant} onChange={setVariant}>
        <PrototypeControls viewer={viewer} />
      </PrototypeSwitcher>
    ),
  };
}

function PrototypeControls({ viewer }: { viewer: Viewer }) {
  const feed = useFeed(viewer);
  const btn = "rounded-full px-2 py-0.5 text-xs hover:bg-white/10";
  return (
    <>
      <button className={btn} onClick={feed.simulateArrival} title="Push a new Notification for this user">
        + Arrival
      </button>
      <button className={btn} onClick={feed.empty} title="Empty the feed">
        Empty
      </button>
      <button className={btn} onClick={feed.reset} title="Reset this user's feed">
        <RotateCcw className="inline size-3" />
      </button>
      <span className="pl-1 text-[11px] text-white/50">
        {seedKeyFor(viewer)} · {feed.unread} unread · {feed.unseen} unseen
      </span>
    </>
  );
}
