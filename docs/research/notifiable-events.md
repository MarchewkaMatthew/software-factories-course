# Notifiable events in Cadence

Research for [#3 Inventory notifiable events in Cadence](https://github.com/MarchewkaMatthew/software-factories-course/issues/3), under the map [#2 In-app Notifications for Cadence](https://github.com/MarchewkaMatthew/software-factories-course/issues/2).

This file lists every state change (and a few derived conditions) in Cadence that a Notification could hang off, as the code stands at `08ed53f` on `main`. It records facts only. It does not recommend what to notify.

Vocabulary follows `GLOSSARY.md`. Where the code uses another name, the glossary term comes first and the code name follows in brackets:

| Glossary | Code |
| --- | --- |
| Platform Admin | `UserRole.Admin` (`app/db/schema.ts:14`) |
| Team Admin | `team_members` row with `TeamMemberRole.Admin` (`app/db/schema.ts:40-43`, `:266-278`); not a `UserRole` |
| Refund Request | `refunds` row (`app/db/schema.ts:232-257`) |
| Open / Approved / Declined Refund Request | `RefundStatus.Open/Approved/Declined` (`app/db/schema.ts:34-38`) |
| Seat | `coupons` row (`app/db/schema.ts:280-300`) |
| Claimed Seat | `coupons.redeemedAt` set |
| Individual Purchase / Team Licence | one `purchases` table, no kind column. A Team Licence is a Purchase with Seats (`app/lib/refunds.server.ts:84-90`) |

Columns in every table: **Event** · **Code location** · **Actor** (who causes it) · **Concerns** (people it is about, by role) · **Data at that point** (what is in scope where the change happens, without extra queries).

## 1. Individual Purchases, Team Licences and Seats

| # | Event | Code location | Actor | Concerns | Data at that point |
| --- | --- | --- | --- | --- | --- |
| 1 | Individual Purchase made; buyer gets an Enrollment | `app/routes/courses.$slug.purchase.tsx:366-373` (writes in `createPurchase` `:180-191` and `enrollUser` `:145-178`) | Student | Student (buyer); Instructor (owns the course) | Full `courses` row (incl. `instructorId`, `title`, `slug`, `price`), buyer `userId` only (no name/email loaded), `pppPrice`, `country`. The new `purchases` and `enrollments` rows are returned by the helpers but the action discards them. |
| 2 | Team Licence bought: one Purchase and `quantity` Unclaimed Seats; the buyer gets no Enrollment | `app/routes/courses.$slug.purchase.tsx:375-379` (`createTeamPurchase` `:245-256`, `generateCoupons` `:222-243`) | Team Admin (a Student buying for others) | Team Admin; Instructor | Course row, buyer `userId`, `quantity`, `totalPrice`, `country`. `createTeamPurchase` returns `{ purchase, team, coupons }` (incl. every Seat `code`), and the action discards it. |
| 3 | Buyer's first Team Licence creates a team and makes them its Team Admin | `app/routes/courses.$slug.purchase.tsx:210-220` | Team Admin | Team Admin | `userId`, new `teams` row. It happens inside event 2. |
| 4 | Seat claimed: the Seat records its Student and that Student gets an Enrollment | `app/routes/redeem.$code.tsx:98-110` (in `redeemCoupon` `:47-113`; action `:185-213`) | Student (claimer) | Student (claimer); Team Admin (buyer of the Team Licence); Instructor | `coupons` row (`teamId`, `courseId`, `purchaseId`, `code`), the Team Licence `purchases` row (so the Team Admin's `userId` and `country`), claimer `userId`, new `enrollments` row. The Team Admin's name/email and the course row are not loaded inside `redeemCoupon`. The action loads the course afterwards (`:207`). |
| 5 | Seat claim refused: already claimed, on hold (Open Refund Request), refunded, already enrolled, or country mismatch. Nothing is written. | `app/routes/redeem.$code.tsx:57-96` | Student (would-be claimer) | Student; Team Admin | `coupons` row, `availability`, error string. No state change. |

Notes:
- A Seat has no recipient until claimed. There is no invite, email or user attached to an Unclaimed Seat. The Team Admin copies the code from `/team` (`app/routes/team.tsx`) and passes it on outside Cadence.
- `TeamMemberRole.Member` is never written. A Student who claims a Seat does not join `team_members`. The only link between a Team Admin and their Students is `coupons.redeemedByUserId`.
- `/team` has a loader and no action (`app/routes/team.tsx:83`), so Team Admins only act through purchase and refund.

## 2. Refund Requests and Refunds

| # | Event | Code location | Actor | Concerns | Data at that point |
| --- | --- | --- | --- | --- | --- |
| 6 | Refund Request raised (becomes an Open Refund Request) on an Individual Purchase or a Team Licence | `app/lib/refunds.server.ts:379-388` (in `raiseRefundRequest` `:357-409`); route `app/routes/courses.$slug.refund.ts:32-78` | Student (buyer) or Team Admin (buyer) | Buyer; Platform Admin (decides it); Instructor (owns the course) | `purchases` row, full buyer `users` row (name, email), full `courses` row (incl. `instructorId`), `reason`, `refundRequestId`, `kind` (`individual_purchase` / `team_licence`). Email built at `:394-407` and sent at `courses.$slug.refund.ts:75`. No list of Platform Admins is loaded. |
| 7 | Team Licence's Unclaimed Seats go on hold (side effect of event 6 on a Team Licence). It is derived, not written. | `app/lib/refunds.server.ts:111-121` (`getSeatAvailability`) | (follows from event 6) | Team Admin; anyone holding an Unclaimed Seat code | Nothing is stored. It is computed from the Open Refund Request whenever a Seat is read. |
| 8 | Refund Request approved (becomes an Approved Refund Request); `amountRefunded` = `amountPaid` | `app/lib/refunds.server.ts:669-678` (in `approveRefundRequest` `:614-685`); route `app/routes/admin.refunds.tsx:94-139`, email sent `:130` | Platform Admin | Buyer (Student or Team Admin); Instructor | `purchases` row, Seats of the Purchase, `platformAdminId`, optional `note`, `now`. `buildDecisionEmail` (`:736-781`) loads buyer and course. Only `{ ok, email }` goes back to the route. |
| 9 | Approval of an Individual Purchase ends the buyer's Enrollment (the Student becomes Lapsed), unless they also hold a Claimed Seat for the course | `app/lib/refunds.server.ts:645-666` | Platform Admin | Student (buyer) | `purchase.userId`, `purchase.courseId`, whether a Claimed Seat exists. The Enrollment row is deleted, so no end date is stored. Progress stays (ADR 0001). |
| 10 | Approval of a Team Licence freezes its Unclaimed Seats forever (`coupons.refundedAt` set) | `app/lib/refunds.server.ts:638-643` | Platform Admin | Team Admin; holders of Unclaimed Seat codes | `purchase.id`, `now`. The number of Seats changed is not counted or returned. Holders of Claimed Seats keep their Enrollment. |
| 11 | Approval refused because a Seat on the Team Licence is claimed (409) | `app/lib/refunds.server.ts:628-636` | Platform Admin | Platform Admin | Error only. No state change. |
| 12 | Refund Request declined (becomes a Declined Refund Request); a `decisionNote` is required | `app/lib/refunds.server.ts:713-721` (in `declineRefundRequest` `:692-733`); route `app/routes/admin.refunds.tsx:118-130` | Platform Admin | Buyer; Instructor | `purchases` row, trimmed note, `platformAdminId`, `now`. Decision email from `buildDecisionEmail`. Unclaimed Seats work again at once (derived, event 7 reversed). |
| 13 | Second decision on an already-decided Refund Request rejected (first decision wins, 409) | `app/lib/refunds.server.ts:587-595` | Platform Admin | Platform Admin | Existing `status`. No state change. |

Notes:
- **Pending Refund, Issued Refund and Failed Refund have no code.** There is no Refund table, no Refund status, no payment-provider call and no hook to confirm money sent. Approving a Refund Request only sets `refunds.amountRefunded` (`:672`). The approval email says the money "is on its way back to you" (`:760`) and nothing records whether it went. A Refund's life after approval exists only in `GLOSSARY.md` and ADR 0002.
- Emails go through `sendEmail` (`app/lib/mailer.server.ts:67-73`): Postmark when `POSTMARK_SERVER_TOKEN` is set, otherwise a JSON file in `.outbox/`. The route awaits it after the database write is committed. A Postmark failure throws, but the Refund Request stays decided.
- The decision email goes to `purchase.userId` only. For a Team Licence, Students on Claimed Seats are not addressed. For an Individual Purchase, the Instructor is not addressed.

## 3. Enrollments and progress

| # | Event | Code location | Actor | Concerns | Data at that point |
| --- | --- | --- | --- | --- | --- |
| — | Enrollment created | Events 1 and 4 | — | — | See above. `enrollments` does not record whether a Purchase or a Claimed Seat granted it (ADR 0004). |
| — | Enrollment ended (Student becomes Lapsed) | Event 9 | — | — | Only by Refund Request approval. Nothing else deletes Enrollments. |
| 14 | Lesson marked In Progress when a Student with an Enrollment opens it | `app/routes/courses.$slug.lessons.$lessonId.tsx:735` (`markLessonInProgress` `:245-269`) | Student | Student | `userId`, `lessonId`, course row. **It is written in a loader (a GET), not an action.** |
| 15 | Lesson marked Completed | `app/routes/courses.$slug.lessons.$lessonId.tsx:947-950` (`markLessonComplete` `:218-243`) | Student | Student; Instructor | `userId`, `lessonId`, full course row (incl. `instructorId`). No count of remaining lessons is computed. The action does not check for an Enrollment. |
| 16 | Video watch event recorded (feeds Watched) | `app/routes/api.video-tracking.ts:15-41`, insert `:29-38`; sent from `app/components/youtube-player.tsx:115` on a client `setInterval` | Student | Student | `userId`, `lessonId`, `eventType`, `positionSeconds`. No course, Enrollment or Watched total is loaded. |

Notes:
- **Course completion is never recorded.** `enrollments.completedAt` (`app/db/schema.ts:134`) is read by `dashboard.tsx:27`, `courses.tsx:122` and `instructor.$courseId.students.tsx:39`, but no code writes it.
- **Crossing the Watch Limit is not an event.** Watched is summed on read (`app/lib/refunds.server.ts:157-175`) against `REFUND_WATCH_LIMIT_SECONDS` = 3600 (`app/lib/refund-rules.ts:6`). The 50% lessons-completed rule (`:7`) works the same way. Nothing records the moment either is passed.

## 4. Comments and Instructor questions

| # | Event | Code location | Actor | Concerns | Data at that point |
| --- | --- | --- | --- | --- | --- |
| 17 | Top-level comment (question) posted on a lesson | `app/routes/courses.$slug.lessons.$lessonId.tsx:898-910` → `createComment` `:404-435`, insert `:430-434` | Student (or Instructor / Platform Admin) | Instructor (owns the course); Platform Admin (sees every course's queue) | `userId`, `lessonId`, `body`, `access.isStaff`; `getCourseForLesson` gives `courseId`, `courseTitle`, `courseSlug`, `instructorId` (`:311-323`). The new comment row is returned by `createComment` and discarded by the action. Author name and lesson title are not loaded. |
| 18 | Reply posted on a lesson page | Same as 17, with `parentId` (`:417-428`) | Any person with access to the lesson | Author of the parent comment; Instructor | As 17, plus the parent `comments` row (so the parent author's `userId`). Other repliers in the thread are not loaded. |
| 19 | Question answered from the Unanswered Questions queue | `app/routes/instructor.questions.tsx:188-225` → `createComment` `:118-157` | Instructor (of that course) or Platform Admin (`requireStaff`, `:208`) | Student (question author) | Question `comments` row (author `userId`, `lessonId`), course (`courseId`, `courseTitle`, `courseSlug`, `instructorId`), answerer `access.userId`, `body`. |
| 20 | Comment edited by its author (`editedAt` set) | `app/routes/courses.$slug.lessons.$lessonId.tsx:912-925` → `updateComment` `:437-457` | Comment author | Comment author; repliers | Comment row before the edit, new `body`. |
| 21 | Comment soft-deleted by its author | `:927-936` → `deleteComment` `:459-477` | Comment author | Repliers on a deleted top-level comment | Comment row, `deletedAt`. |
| 22 | Comment soft-deleted by staff (moderation) | Same as 21, with `isStaff` true (`:464`, `:935`) | Instructor or Platform Admin | Comment author | Comment row (author `userId`), actor `userId`. Nothing records who deleted it. |
| 23 | Unanswered question turns stale (3 days with no staff reply) | `app/routes/instructor.questions.tsx:160` (`STALE_AFTER_DAYS`), queue query `:42-97` | — (time passing) | Instructor; Platform Admin | **Derived on read**, nothing is stored. The queue loader computes it from `createdAt` and whether a staff reply exists. |

Notes:
- The code has no separate "question" entity. A question is a top-level comment, and it counts as answered when a live reply by the course's Instructor or a Platform Admin exists (`instructor.questions.tsx:47-70`).
- There is no @-mention, follow or subscription data, so "people in this thread" means the parent author plus the repliers, found by query.

## 5. Quizzes

| # | Event | Code location | Actor | Concerns | Data at that point |
| --- | --- | --- | --- | --- | --- |
| 24 | Quiz attempt submitted, passed or failed | `app/routes/courses.$slug.lessons.$lessonId.tsx:952-976` → `computeResult` `:531-638`, insert `:602-611` | Student | Student; Instructor | `userId`, `quizId`, `score`, `passed`, `grade`, correct/total counts, per-question results, course row. `passed` is `score > 0.7` (`:599`), not the quiz's stored `passingScore`. |
| 25 | Quiz saved (created, or replaced if one exists) | `app/routes/instructor.$courseId.lessons.$lessonId.quiz.tsx:386-423` | Instructor or Platform Admin | Students who attempted the old quiz; Students with an Enrollment | Course row, lesson row, new quiz `title` / `passingScore` / questions. **Replacing a quiz deletes every quiz attempt and answer on it** (`deleteQuiz` `:201-220`). Who attempted it is not kept. |
| 26 | Quiz deleted | `…quiz.tsx:425-431` | Instructor or Platform Admin | Students who attempted it | As 25: their attempts are deleted with it. |

## 6. Ratings

| # | Event | Code location | Actor | Concerns | Data at that point |
| --- | --- | --- | --- | --- | --- |
| 27 | Course rated for the first time (1–5 stars) | `app/routes/courses.$slug.tsx:478` → `rateCourse` `:330-363`, insert `:358-362` | Student with an Enrollment (`:465`) | Instructor | `userId`, full course row (incl. `instructorId`), `rating`. |
| 28 | Rating changed | Same, update `:349-356` | Student | Instructor | As 27. The previous rating (`existing`) is known inside `rateCourse` but not returned. |

## 7. Courses: publishing and edits

| # | Event | Code location | Actor | Concerns | Data at that point |
| --- | --- | --- | --- | --- | --- |
| 29 | Course created (always Draft) | `app/routes/instructor.new.tsx:112-160`, insert `:59-72` | Instructor (Instructors only, `:121`) | Instructor | New course row, instructor user row. |
| 30 | Course status changed (Draft / Published / Archived) by its Instructor or a Platform Admin from the course editor | `app/routes/instructor.$courseId.tsx:695-698` (`updateCourseStatus` `:154-161`) | Instructor or Platform Admin | Students with an Enrollment; Instructor (if a Platform Admin acted) | Course row **before** the change (incl. old `status`, `instructorId`), actor user row, new `status`. Students with an Enrollment are not loaded. |
| 31 | Course status changed by a Platform Admin from `/admin/courses` | `app/routes/admin.courses.tsx:141-144` (`updateCourseStatus` `:76-83`) | Platform Admin | Instructor; Students with an Enrollment | `courseId` and new `status` only. The course row, old status and `instructorId` are not loaded (the returned row is discarded). |
| 32 | Title or description edited | `app/routes/instructor.$courseId.tsx:685-693` | Instructor or Platform Admin | Students with an Enrollment | Old course row, new value. |
| 33 | Price changed | `…instructor.$courseId.tsx:700-714` | Instructor or Platform Admin | (prospective buyers) | Old course row (old `price`), new `priceCents`. |
| 34 | Purchasing-power pricing switched on or off | `…:716-720` | Instructor or Platform Admin | — | Old course row, new flag. |
| 35 | Sales copy edited | `…:844-847` | Instructor or Platform Admin | — | Old course row, new `salesCopy`. |
| 36 | Module added, renamed, reordered or deleted (deleting one deletes its lessons) | `…:722-751`, `:783-787`; `deleteModule` `:236-240` | Instructor or Platform Admin | Students with an Enrollment | Course row, module row, new title / order. |
| 37 | Lesson added, renamed, moved, reordered or deleted | `…:753-842` | Instructor or Platform Admin | Students with an Enrollment | Course row, lesson and module rows, new title / position. |
| 38 | Lesson content edited (content, video URL, duration, GitHub repo URL) | `app/routes/instructor.$courseId.lessons.$lessonId.tsx:207-235`, write `:85-90` | Instructor or Platform Admin | Students with an Enrollment | Course row, lesson row before the edit, new values. |

## 8. People, roles and other admin

| # | Event | Code location | Actor | Concerns | Data at that point |
| --- | --- | --- | --- | --- | --- |
| 39 | Sign-up (always as a Student). If the email exists, that person is logged in and nothing is written. | `app/routes/signup.tsx:76-81` (existing-email branch `:63-74`) | New Student | Student; Platform Admin | New `users` row. |
| 40 | Own profile edited (name, bio) | `app/routes/settings.tsx:89-97` | Any person | Themselves | Current user row before the edit, new `name` / `bio`. |
| 41 | Person's name or email edited by a Platform Admin | `app/routes/admin.users.tsx:119-124` | Platform Admin | That person | Their row before the edit (`:121`), new `name` / `email`, acting Platform Admin. |
| 42 | Person's role changed (Student / Instructor / Platform Admin) | `app/routes/admin.users.tsx:126-130` | Platform Admin | That person | `userId` and new `role` only. **The previous role is not loaded.** |
| 43 | Category created, renamed or deleted | `app/routes/admin.categories.tsx:191-225` | Platform Admin | (Instructors whose courses use it) | Category name / id. |

Not counted as events (session only, no stored state): log in (`login.tsx:40`), log out (`api.logout.ts`), DevUI user switch (`api.switch-user.ts`) and DevUI country switch (`api.set-dev-country.ts`).

## Events outside a request

- **No background work.** Nothing in `app/` is scheduled: no cron, queue, worker or timer on the server. The only `setInterval` / `setTimeout` calls are in the browser (`app/components/youtube-player.tsx:115`, `app/routes/team.tsx:174`).
- **Time-based conditions are computed on read, never stored:**
  - Refund window closes: 14 calendar days after the Purchase (`app/lib/refund-rules.ts:5`, `app/lib/refunds.server.ts:52-64`).
  - Unanswered question turns stale: 3 days (event 23).
  - Watch Limit / 50%-completed passed (section 3 notes).
  - Seats on hold during an Open Refund Request (event 7).
- **Side effect on a GET:** Lesson In Progress is written in the lesson loader (event 14).
- **Outside the app:** `scripts/seed.ts` writes data directly (`npm run db:seed`).
- **Synchronous email:** the two existing transactional emails (events 6, 8/12) are sent inline in the action, after the commit.

## Glossary concepts with no code yet

| Concept | State in code |
| --- | --- |
| Pending Refund, Issued Refund, Failed Refund | Nothing: no Refund entity, status, money movement or confirmation (section 2 notes). |
| Notification | Absent from `GLOSSARY.md` and from the code. Map #2 says it is defined in the glossary, but at `08ed53f` it is not. |
| Lapsed as an event | Derived: a Student is Lapsed when progress exists and no Enrollment does (`app/lib/enrollments.ts:1-4`). The Enrollment row is deleted at approval, so no date of lapsing is kept. |
| Course completed | `enrollments.completedAt` exists but is never written. |
| Watch Limit reached | Constant and check only. No event. |
| Unclaimed Seat recipient | A Seat has no intended recipient until a Student claims it. |
| Team membership for Students on Claimed Seats | `TeamMemberRole.Member` is defined but never written. |

## Data a Notification would need that is missing at the event

Facts about what is not in scope at the write site:

- **Who to tell is often not loaded.** No event loads the list of Platform Admins (6, 39). No event loads the Students with an Enrollment on a course (25, 30, 31, 32, 36–38). The Instructor is reachable through `courses.instructorId` in most events, except event 31.
- **Previous values are missing** for a role change (42), an admin course status change (31) and a rating change (28; known inside `rateCourse` but not returned).
- **Names and emails are mostly not loaded.** Events 1, 2 and 4 have only user ids. Event 4 lacks the Team Admin's name. Event 17 lacks the author name and lesson title.
- **Created rows are thrown away.** The Purchase, Enrollment, Seat codes, comment and rating rows are returned by helpers and discarded by the actions (1, 2, 4, 17–19, 27). The actions return only redirects or `{ ok: true }`.
- **Decision details stay in the transaction.** For an approval, how many Seats were frozen, and whether the Enrollment was actually ended, are not returned from `approveRefundRequest` (8–10).
- **Moderation actor is not stored.** A soft-deleted comment does not record who deleted it (22).
- **Deleted history.** Replacing or deleting a quiz deletes the attempts, so the Students who took it can't be found afterwards (25, 26). An ended Enrollment is deleted, not closed (9).
- **No Purchase kind column.** Telling an Individual Purchase from a Team Licence takes a Seat query (`kindOf`, `app/lib/refunds.server.ts:88-90`).

## Count

43 numbered events across eight areas:

- 38 write state inside a request. One of them (14) is written in a GET loader.
- 3 are refusals that write nothing (5, 11, 13).
- 2 are derived conditions with nothing stored (7, 23).

Four more concepts have no code at all: Pending Refund, Issued Refund, Failed Refund and course completion.

## Sources

All at commit `08ed53f` on `main`:

- `app/db/schema.ts`
- `app/lib/refunds.server.ts`, `app/lib/refund-rules.ts`, `app/lib/mailer.server.ts`, `app/lib/enrollments.ts`, `app/lib/access.server.ts`
- `app/routes/courses.$slug.purchase.tsx`, `redeem.$code.tsx`, `courses.$slug.refund.ts`, `admin.refunds.tsx`, `team.tsx`, `courses.$slug.lessons.$lessonId.tsx`, `api.video-tracking.ts`, `instructor.questions.tsx`, `courses.$slug.tsx`, `instructor.new.tsx`, `instructor.$courseId.tsx`, `instructor.$courseId.lessons.$lessonId.tsx`, `instructor.$courseId.lessons.$lessonId.quiz.tsx`, `admin.courses.tsx`, `admin.users.tsx`, `admin.categories.tsx`, `signup.tsx`, `settings.tsx`
- `app/components/youtube-player.tsx`
- `GLOSSARY.md`, `docs/adr/0001`–`0004`
