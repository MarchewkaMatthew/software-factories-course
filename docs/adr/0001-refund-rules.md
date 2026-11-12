# Refund rules: what a Student can ask for, and what an Admin's decision does

Students request Refunds themselves, but every Refund is reviewed by hand by an Admin (never the Course Instructor), and both outcomes are final. The rules are strict on purpose: a Refund returns the full amount paid, so the limits on time, Progress and repeats are what keep it from becoming a free trial.

## Refund Eligibility

A Student can request a Refund for a Purchase only when all of these hold:

- **Inside the Refund Window**: fourteen calendar days after the Purchase, counted in whole days, so someone who buys at 23:00 still gets all of their fourteenth day.
- **Less than half the Course Completed**: exactly 50% of Lessons Completed is already too much.
- **Under two hours watched** across the Course. This catches Students who watch most of the Course without marking Lessons Completed.
- **Not a Redeemed Seat.** A Seat that has been Redeemed belongs to the Team, so the Student can't hand it back on their own.
- **No Refund already Requested or Declined** for this Purchase. A Decline is final and can't be got around by asking again.
- **No earlier Purchase of the same Course with an Approved Refund.** A Student may buy the Course again, but only one Refund per Course, so buying, refunding and buying again can't loop.

Eligibility is judged **when the Refund is Requested**, not when the Admin decides. A Student who keeps learning while waiting doesn't lose an eligible request through the Admin's delay. The Admin sees how much was Completed at the request and how much now, and may still Decline at their discretion. That is why the Completed % is snapshotted on the Refund.

## The Admin's decision

- **Approved**:
  - The Refund Amount is always what the Student paid; there are no partial Refunds.
  - The Student loses their Enrollment in the Course, but their Progress is kept, so they can pick up where they left off if they buy again.
  - For a Team Purchase, its Unredeemed Coupons can no longer be Redeemed. Otherwise refunded Seats could still be given away.
  - The Purchase no longer counts as revenue in instructor analytics.
- **Declined**: the Admin must give a Decline Reason, which the Student sees. That Purchase can never be refunded.
- **Both are final.** There is no undo in the app; a mistaken decision is fixed by hand. Without undo, nobody has to reverse an Enrollment removal or Coupon changes that have already happened.

The Student is emailed on request, on Approval and on Decline.

## Considered Options

- **Re-checking eligibility at decision time**: rejected, because a slow review would make the Student pay for the Admin's delay.
- **Letting Course Instructors review their own Courses' Refunds**: rejected, because Instructors would be deciding on their own revenue.
- **Allowing a new request after a Decline**: rejected, because it turns Decline into "ask again later" and repeats the review work.

## Consequences

- Progress, watch history and quiz attempts can exist for a Student with no Enrollment in the Course. This is deliberate, not orphaned data.
- No money moves yet: there is no payment provider. Approval records the Refund Amount, and paying it back happens outside the app.
