import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  coupons,
  lessonProgress,
  lessons,
  LessonProgressStatus,
  modules,
  purchases,
  refunds,
  RefundStatus,
  videoWatchEvents,
} from "~/db/schema";

export const REFUND_WINDOW_DAYS = 14;
export const REFUND_WATCH_LIMIT_SECONDS = 2 * 60 * 60;
export const REFUND_COMPLETION_LIMIT = 0.5;

export type RefundIneligibleReason =
  | "no_purchase"
  | "refund_already_requested"
  | "redeemed_seat"
  | "outside_refund_window"
  | "too_much_completed"
  | "too_much_watched";

export type RefundEligibility =
  | {
      eligible: true;
      purchaseId: number;
      refundAmount: number;
      lastDayOfRefundWindow: string;
    }
  | { eligible: false; reason: RefundIneligibleReason };

export interface RefundFacts {
  purchase: { id: number; amountPaid: number; createdAt: string } | null;
  hasRequestedRefund: boolean;
  isRedeemedSeat: boolean;
  lessonCount: number;
  completedLessonCount: number;
  secondsWatched: number;
  today: Date;
}

// The Refund Window is counted in whole calendar days, not hours — someone
// who buys at 23:00 still gets the whole of their fourteenth day.
function calendarDay(when: Date): string {
  const month = String(when.getMonth() + 1).padStart(2, "0");
  const day = String(when.getDate()).padStart(2, "0");
  return `${when.getFullYear()}-${month}-${day}`;
}

export function lastDayOfRefundWindow(purchasedAtIso: string): string {
  const deadline = new Date(purchasedAtIso);
  deadline.setDate(deadline.getDate() + REFUND_WINDOW_DAYS);
  return calendarDay(deadline);
}

/**
 * Refund Eligibility: the single rule both the course page and the refund
 * action apply. The Refund Amount is always what the Student paid.
 */
export function decideRefundEligibility(facts: RefundFacts): RefundEligibility {
  const { purchase } = facts;

  if (!purchase) return { eligible: false, reason: "no_purchase" };
  if (facts.hasRequestedRefund) {
    return { eligible: false, reason: "refund_already_requested" };
  }
  // A Seat that has been Redeemed belongs to the Team — the Student cannot
  // hand it back on their own.
  if (facts.isRedeemedSeat) return { eligible: false, reason: "redeemed_seat" };

  const today = calendarDay(facts.today);
  const purchasedDay = calendarDay(new Date(purchase.createdAt));
  const lastDay = lastDayOfRefundWindow(purchase.createdAt);
  if (today < purchasedDay || today > lastDay) {
    return { eligible: false, reason: "outside_refund_window" };
  }

  if (
    facts.lessonCount > 0 &&
    facts.completedLessonCount / facts.lessonCount >= REFUND_COMPLETION_LIMIT
  ) {
    return { eligible: false, reason: "too_much_completed" };
  }

  if (facts.secondsWatched >= REFUND_WATCH_LIMIT_SECONDS) {
    return { eligible: false, reason: "too_much_watched" };
  }

  return {
    eligible: true,
    purchaseId: purchase.id,
    refundAmount: purchase.amountPaid,
    lastDayOfRefundWindow: lastDay,
  };
}

function getLatestPurchase(userId: number, courseId: number) {
  return db
    .select({
      id: purchases.id,
      amountPaid: purchases.amountPaid,
      createdAt: purchases.createdAt,
    })
    .from(purchases)
    .where(and(eq(purchases.userId, userId), eq(purchases.courseId, courseId)))
    .orderBy(desc(purchases.createdAt))
    .get();
}

function getLessonIdsForCourse(courseId: number): number[] {
  return db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .all()
    .map((row) => row.id);
}

function hasRequestedRefund(purchaseId: number): boolean {
  const row = db
    .select({ id: refunds.id })
    .from(refunds)
    .where(
      and(
        eq(refunds.purchaseId, purchaseId),
        eq(refunds.status, RefundStatus.Requested)
      )
    )
    .get();
  return row !== undefined;
}

function isRedeemedSeat(purchaseId: number): boolean {
  const row = db
    .select({ id: coupons.id })
    .from(coupons)
    .where(
      and(eq(coupons.purchaseId, purchaseId), isNotNull(coupons.redeemedAt))
    )
    .get();
  return row !== undefined;
}

function getCompletedLessonCount(userId: number, lessonIds: number[]): number {
  if (lessonIds.length === 0) return 0;
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.status, LessonProgressStatus.Completed),
        inArray(lessonProgress.lessonId, lessonIds)
      )
    )
    .get();
  return result?.count ?? 0;
}

function getSecondsWatched(userId: number, lessonIds: number[]): number {
  if (lessonIds.length === 0) return 0;
  const furthestPerLesson = db
    .select({
      furthest: sql<number>`max(${videoWatchEvents.positionSeconds})`,
    })
    .from(videoWatchEvents)
    .where(
      and(
        eq(videoWatchEvents.userId, userId),
        inArray(videoWatchEvents.lessonId, lessonIds)
      )
    )
    .groupBy(videoWatchEvents.lessonId)
    .all();
  return furthestPerLesson.reduce((total, row) => total + row.furthest, 0);
}

export function getRefundEligibility(
  userId: number,
  courseId: number
): RefundEligibility {
  const purchase = getLatestPurchase(userId, courseId) ?? null;
  if (!purchase) {
    return decideRefundEligibility({
      purchase: null,
      hasRequestedRefund: false,
      isRedeemedSeat: false,
      lessonCount: 0,
      completedLessonCount: 0,
      secondsWatched: 0,
      today: new Date(),
    });
  }

  const lessonIds = getLessonIdsForCourse(courseId);

  return decideRefundEligibility({
    purchase,
    hasRequestedRefund: hasRequestedRefund(purchase.id),
    isRedeemedSeat: isRedeemedSeat(purchase.id),
    lessonCount: lessonIds.length,
    completedLessonCount: getCompletedLessonCount(userId, lessonIds),
    secondsWatched: getSecondsWatched(userId, lessonIds),
    today: new Date(),
  });
}
