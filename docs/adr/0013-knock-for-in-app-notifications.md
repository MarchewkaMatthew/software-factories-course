# Use Knock for Notifications, with our own feed UI

Cadence's in-app Notifications are delivered through Knock, a hosted provider. The feed is built in Cadence's own shadcn/Tailwind components on Knock's headless hooks (`@knocklabs/react` / `@knocklabs/client`), not Knock's prebuilt feed component. Knock's free tier has no cap on workflows, so every Notification type can have its own workflow. It can run unsigned in dev and require signed user tokens in prod.

## Considered Options

- **Novu Cloud.** It has a prebuilt Inbox and Preferences, and its first paid tier is $30/mo. Rejected because its free tier allows only 5 workflows, and Cadence has 43 notifiable events across four roles. Staying under the cap would mean one generic workflow that switches on its payload, which loses per-type templates and preferences. Its UI is also rendered in Solid.js inside React.
- **Courier, MagicBell, SuprSend.** Courier and MagicBell always need a server-minted JWT, MagicBell's free tier is 1,000 deliveries a month, and SuprSend's preferences are only on its $250/mo plan.
- **Knock's prebuilt `NotificationFeedPopover`.** Rejected: it brings its own markup and CSS, and it keeps Knock branding on the free tier. It would decide the look of the feed instead of letting us design it.

## Consequences

- Recipient ids are immutable at Knock, so the id format has to be fixed before the first trigger.
- Knock has no prebuilt preferences UI. If preferences are added, we build that UI ourselves.
- No provider documents React Router SSR, so the feed renders client-only after hydration. Secret-key work (triggers, token signing) lives only in `.server.ts` modules.
- Knock's first paid tier is $250/mo, which is acceptable while the free tier covers dev.
