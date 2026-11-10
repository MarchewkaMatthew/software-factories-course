import { describe, it, expect } from "vitest";
import {
  decideRefundEligibility,
  REFUND_WATCH_LIMIT_SECONDS,
  type RefundFacts,
} from "./refunds.server";

const purchasedAt = new Date(2026, 0, 1, 23, 0).toISOString();

function facts(overrides: Partial<RefundFacts> = {}): RefundFacts {
  return {
    purchase: { id: 7, amountPaid: 4900, createdAt: purchasedAt },
    hasRequestedRefund: false,
    isRedeemedSeat: false,
    lessonCount: 10,
    completedLessonCount: 0,
    secondsWatched: 0,
    today: new Date(2026, 0, 5),
    ...overrides,
  };
}

describe("decideRefundEligibility", () => {
  it("offers the amount the Student paid, not the list price", () => {
    expect(decideRefundEligibility(facts())).toEqual({
      eligible: true,
      purchaseId: 7,
      refundAmount: 4900,
      lastDayOfRefundWindow: "2026-01-15",
    });
  });

  it("is ineligible without a Purchase", () => {
    expect(decideRefundEligibility(facts({ purchase: null }))).toEqual({
      eligible: false,
      reason: "no_purchase",
    });
  });

  it("is ineligible while a Refund is already Requested", () => {
    expect(
      decideRefundEligibility(facts({ hasRequestedRefund: true }))
    ).toMatchObject({ reason: "refund_already_requested" });
  });

  it("is ineligible for a Redeemed Seat", () => {
    expect(
      decideRefundEligibility(facts({ isRedeemedSeat: true }))
    ).toMatchObject({ reason: "redeemed_seat" });
  });

  it("counts the Refund Window in whole calendar days", () => {
    expect(
      decideRefundEligibility(facts({ today: new Date(2026, 0, 15, 23, 59) }))
        .eligible
    ).toBe(true);
    expect(
      decideRefundEligibility(facts({ today: new Date(2026, 0, 16) }))
    ).toMatchObject({ reason: "outside_refund_window" });
  });

  it("is ineligible once half the Lessons are Completed", () => {
    expect(
      decideRefundEligibility(facts({ completedLessonCount: 5 }))
    ).toMatchObject({ reason: "too_much_completed" });
    expect(
      decideRefundEligibility(facts({ completedLessonCount: 4 })).eligible
    ).toBe(true);
  });

  it("is ineligible once two hours have been watched", () => {
    expect(
      decideRefundEligibility(
        facts({ secondsWatched: REFUND_WATCH_LIMIT_SECONDS })
      )
    ).toMatchObject({ reason: "too_much_watched" });
  });
});
