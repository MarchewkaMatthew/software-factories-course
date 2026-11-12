# Hosted in-app notification providers for Cadence

Research for [#4](https://github.com/MarchewkaMatthew/software-factories-course/issues/4), part of the map [#2](https://github.com/MarchewkaMatthew/software-factories-course/issues/2). Sources checked 2026-11-12. Pricing pages, official docs, and the npm registry (`npm view <pkg>`) are the primary sources. Everything below is findings only. Picking the provider is a grilling decision.

## Constraints (from map #2)

- Hosted SaaS, with a **free tier** that covers dev.
- Works from **localhost** with no public webhook URL.
- Compatible with **React Router 8 SSR**. Cadence runs `react-router` 8.3.0 with `ssr: true` and React 19.2 ([`react-router.config.ts`](../../react-router.config.ts), [`package.json`](../../package.json)).
- In-app feed only. Email and push must remain possible later.
- Recipient identity must survive DevUI user switching. Cadence keeps an integer `userId` in a cookie session ([`app/lib/session.ts`](../../app/lib/session.ts)).

## Comparison

| | Knock | Novu Cloud | Courier | MagicBell | SuprSend |
|---|---|---|---|---|---|
| **Free tier** | 10,000 messages/mo; unlimited workflows, feeds and profiles; feed retention has no limit; preferences included; Knock branding stays [^k-price] | 10,000 workflow runs/mo; **max 5 workflows**; 3 team members; Dev and Prod envs; 24h activity-log retention; branding can't be removed [^n-price][^n-prod] | 10,000 sends/mo (Developer). Inbox has no separate fee. Going over means adding a card, and then **every** send is billed [^c-price][^c-bill] | **1,000 deliveries/mo** (Builder); 1 project [^m-price] | 10,000 notifications/mo; inbox carries SuprSend branding; **user preferences only on Business ($250/mo)** [^s-price] |
| **First paid tier** | Starter $250/mo [^k-price] | Pro from $30/mo [^n-price] | $0.005/send PAYG [^c-price] | Startup $249/mo [^m-price] | Essentials $100/mo (annual) [^s-price] |
| **Prebuilt React feed** | Yes: `NotificationFeedPopover`, `NotificationFeed`, `NotificationIconButton` [^k-react] | Yes: `<Inbox/>` with Bell, Notifications, Preferences sub-components [^n-inbox] | Yes: `CourierInbox`, toasts [^c-inbox] | Yes: `FloatingInbox`, `Inbox`, `ToastContainer`, `UserPreferences` [^m-react] | Yes: `Inbox`, `NotificationsFeed`, `Preferences` [^s-react] |
| **Headless option** | Hooks in `@knocklabs/react`, plus `@knocklabs/client` [^k-react] | `@novu/react` hooks, plus `@novu/js` [^n-inbox] | `useCourier`, plus `@trycourier/courier-js` [^c-inbox] | `magicbell-js` user client and Realtime [^m-js] | `@suprsend/react-core` (providers and hooks only) [^s-react] |
| **React pkg / React 19** | `@knocklabs/react` 0.15.1; peers `react ^17 \|\| ^18 \|\| ^19`; optional peers `next`, `@tanstack/react-router` [^npm] | `@novu/react` 3.19.2; peers `^18 \|\| ^19` [^npm][^n-inbox] | `@trycourier/courier-react` 9.3.5; peers `>=18` (developed against 19.1) [^npm] | `@magicbell/react` 1.14.0; **declares no React peer dependency** [^npm] | `@suprsend/react` 1.5.0; peers `react >=16.8` [^npm] |
| **Real-time transport** | WebSocket (Phoenix channels in `@knocklabs/client`); can auto-disconnect inactive tabs [^k-feed][^npm-src] | WebSocket via `socket.io-client`/`partysocket` in `@novu/js`; the UI is rendered in Solid.js inside the React wrapper [^npm-src] | WebSocket `wss://realtime.courier.io` [^npm-src] | WebSocket [^m-js] | Not documented on the pages read |
| **Node SDK (trigger)** | `@knocklabs/node` 1.41.1: `workflows.trigger(key, { recipients, data })` [^k-node] | `@novu/api` 3.19.1: `novu.trigger({ workflowId, to: { subscriberId }, payload })` [^n-node] | `@trycourier/courier` 10.0.0: `send.message`, `profiles.create` [^c-node] | `magicbell-js/project-client`: `broadcasts.createBroadcast({ recipients: [{ externalId }] })` [^m-js] | `@suprsend/node-sdk` 1.15.1: `workflows.trigger`, recipients as `distinct_id` or inline objects [^s-node] |
| **Recipient id** | String up to 256 chars, no `/` or `#`, immutable. Docs recommend your DB primary key. Identify via API or inline on trigger [^k-users] | `subscriberId` string; created on first Inbox session or via trigger `to` [^n-inbox][^n-node] | `user_id` string (`user_id:<id>` token scope) [^c-auth] | `external_id`, immutable once set; **cast integers to strings** [^m-user] | `distinct_id` string [^s-auth] |
| **Client auth** | Public key + user id. Optional "enhanced security": RS256 JWT minted server-side (`signUserToken` in `@knocklabs/node`). Can stay off in dev and be enforced in prod per environment [^k-sec] | `applicationIdentifier` + `subscriberId`. Optional HMAC-SHA256 `subscriberHash` of the id with the secret key; once enabled, Inbox won't load without it [^n-prod] | **Always a JWT**: backend calls `auth.issueToken({ scope: "user_id:… inbox:read:messages inbox:write:events", expires_in })`. No unsigned mode; the SDK doesn't refresh tokens [^c-auth] | **Always a user JWT**: HS256 signed with the project secret, `user_external_id` claim [^m-auth] | Public key + `distinctId`. Optional enhanced security: ES256 JWT, `refreshUserToken` callback [^s-auth][^s-react] |
| **Preferences** | Included on free. **No prebuilt UI**: build your own with `getPreferences`/`setPreferences` [^k-price][^k-pref] | Prebuilt Preferences in Inbox, per workflow/channel [^n-inbox] | Preference center (token needs `read:preferences write:preferences`). Free-tier availability not stated [^c-auth][^c-bill] | `UserPreferences` component [^m-react] | `Preferences` component, but a Business-plan feature [^s-price] |
| **Localhost, no webhook** | Yes. Trigger is an outbound API call and the feed is an outbound socket | Yes for dashboard-built workflows. Code-first `@novu/framework` needs a bridge endpoint plus a `npx novu dev` tunnel [^n-fw] | Yes (outbound API and socket) | Yes (outbound API and socket) | Yes (outbound API) |
| **Add email/push later** | Yes; all channels unlimited on free [^k-price] | Yes: Email, SMS, Chat, Push on free [^n-price] | Yes; one send covers all channels; push tokens via `signIn` [^c-bill][^c-inbox] | Yes: web push, Slack, and more [^m-react] | Yes: unlimited channels [^s-price] |

## What matters for Cadence

**Identity and DevUI switching.** Every provider keys recipients by a string. Cadence's integer `users.id` must be stringified, for example `String(user.id)` or a prefix like `user_42` (Knock suggests prefixes for different user types [^k-users]). Knock and MagicBell make these ids immutable, so the format should be fixed before the first trigger. Every provider expects the client to be (re)identified for the current user. When DevUI switches users, the provider component has to remount or re-`authenticate` with the new id, and with a new token where one applies. Courier's SDK doesn't refresh tokens itself [^c-auth], and Knock re-authenticates through `onUserTokenExpiring` [^k-sec]. Ids and tokens come naturally from the root `loader`, which already resolves `getCurrentUserId`.

**Auth friction in dev.** Knock, Novu, and SuprSend can run unsigned in dev and enforce signing in prod. Courier and MagicBell always need a server-minted JWT. That isn't hard, because a root loader can mint it, but it makes signing part of the very first spike.

**SSR / React Router 8.** No provider documents React Router or Remix SSR. Every feed opens a browser WebSocket and is client-state driven. Plan to render the feed client-only: mount after hydration, or gate on `typeof window`. Load the secret-key work (token minting, HMAC, triggers) only from `.server.ts` modules. Knock is the only package that lists router integrations as optional peers (`next`, `@tanstack/react-router`), not React Router [^npm]. Novu renders its UI with Solid.js inside React [^npm-src], so it ships a second UI runtime and is opaque to SSR. None of this was verified by running the packages; a throwaway prototype would settle it.

**Free-tier fit.** Knock, Novu, Courier, and SuprSend each give about 10k a month, which is ample for dev. MagicBell's 1,000 deliveries is tight but probably fine for dev alone. Novu caps the free tier at **5 workflows**. If each Notification type in the catalogue becomes its own workflow, that cap could bind, depending on how many types the four roles end up with. SuprSend gates preferences behind its $250 plan. If the preferences open question is decided "yes", that matters.

## Front-runners against the constraints (not a pick)

- **Knock**: generous free tier with no workflow cap; unsigned dev mode with per-environment enforced prod signing; official React 19 peer support; documented guidance to use DB primary keys as ids. Weaknesses: no prebuilt preference UI, and Starter jumps to $250/mo.
- **Novu Cloud**: prebuilt Inbox with Preferences included; simple HMAC; cheapest paid tier ($30/mo). Weaknesses: the 5-workflow free cap, the Solid.js-rendered UI, and the tunnel requirement if code-first workflows were wanted.
- Courier is a solid third (10k/mo, React >=18), but its mandatory JWT and unclear free-tier preference availability count against it. MagicBell and SuprSend trail on free-tier limits (1k deliveries) and preferences gating, respectively.

## Open questions / risks

1. How many Notification types will the catalogue have, and does each map to one provider workflow? This decides whether Novu's 5-workflow cap binds.
2. Will preferences be in scope? If so, the prebuilt UIs (Novu, MagicBell) score higher, while Knock means building our own and SuprSend means the Business plan.
3. Is Courier Inbox and its preference center fully available on the Developer plan? Neither the pricing nor the billing docs say so explicitly [^c-price][^c-bill].
4. SuprSend's real-time transport, and MagicBell's missing React peer dependency (possible bundling or duplicate-React risk), weren't confirmed.
5. Real SSR behaviour under React Router 8 is unverified for all five. Do a prototype: mount the feed, switch the DevUI user, and confirm the feed swaps and nothing leaks across users.
6. Recipient-id format (`"42"` vs `"user_42"`) must be decided once, because it is immutable at Knock and MagicBell.
7. Seed data and tests: how does `npm run db:seed` relate to provider-side recipients, and how are triggers stubbed in tests? This belongs to the map's "Integration architecture" item.

## Sources

[^k-price]: Knock pricing: https://knock.app/pricing
[^k-react]: Knock React SDK overview: https://docs.knock.app/in-app-ui/react/overview
[^k-feed]: Knock React feed: https://docs.knock.app/in-app-ui/react/feed
[^k-sec]: Knock security and authentication: https://docs.knock.app/in-app-ui/security-and-authentication
[^k-users]: Knock users concept: https://docs.knock.app/concepts/users
[^k-node]: Knock Node SDK repo: https://github.com/knocklabs/knock-node
[^k-pref]: Knock React preferences guide: https://docs.knock.app/in-app-ui/react/preferences
[^n-price]: Novu pricing: https://novu.co/pricing
[^n-inbox]: Novu Inbox overview: https://docs.novu.co/platform/inbox/overview
[^n-prod]: Novu Inbox, prepare for production (HMAC, branding): https://docs.novu.co/platform/inbox/prepare-for-production
[^n-node]: Novu TypeScript server SDK: https://docs.novu.co/platform/sdks/server/typescript
[^n-fw]: Novu Framework overview and Local Studio/tunnel: https://docs.novu.co/framework/overview, https://docs.novu.co/framework/studio, https://docs.novu.co/framework/endpoint
[^c-price]: Courier pricing: https://www.courier.com/pricing
[^c-bill]: Courier billing docs: https://www.courier.com/docs/workspaces/billing
[^c-inbox]: Courier Inbox overview: https://www.courier.com/docs/platform/inbox/inbox-overview, packages: https://github.com/trycourier/courier-web
[^c-auth]: Courier Inbox authentication: https://www.courier.com/docs/platform/inbox/authentication
[^c-node]: Courier Node SDK: https://github.com/trycourier/courier-node
[^m-price]: MagicBell pricing: https://www.magicbell.com/pricing
[^m-react]: MagicBell React components: https://www.magicbell.com/docs/libraries/magicbell-react
[^m-js]: MagicBell JS client (project client, Realtime): https://www.magicbell.com/docs/libraries/magicbell-js
[^m-auth]: MagicBell User JWT: https://www.magicbell.com/docs/api/authentication/user
[^m-user]: MagicBell user identifier: https://www.magicbell.com/docs/primitive/user
[^s-price]: SuprSend pricing: https://www.suprsend.com/pricing
[^s-auth]: SuprSend client authentication: https://docs.suprsend.com/docs/client-authentication
[^s-react]: SuprSend React SDK: https://docs.suprsend.com/docs/react-sdk, https://docs.suprsend.com/docs/inbox-react
[^s-node]: SuprSend Node workflow trigger: https://docs.suprsend.com/docs/node-trigger-workflow-from-api
[^npm]: npm registry metadata via `npm view <pkg> version peerDependencies peerDependenciesMeta dependencies` on 2026-11-12 for `@knocklabs/react`, `@knocklabs/node`, `@novu/react`, `@novu/api`, `@novu/js`, `@trycourier/courier-react`, `@trycourier/courier`, `@magicbell/react`, `magicbell-js`, `@suprsend/react`, `@suprsend/node-sdk`.
[^npm-src]: Transport read from published tarballs (`npm pack`): `@knocklabs/client` 0.23.1 bundles `phoenix`; `@trycourier/courier-js` 3.7.1 opens `new WebSocket("wss://realtime.courier.io")`; `@novu/js` 3.19.2 depends on `socket.io-client`, `partysocket` and `solid-js`.
