// PROTOTYPE — throwaway. Full-page Inbox for notifications variant B.
import { useRouteLoaderData } from "react-router";
import { VariantBPage, useHydrated } from "~/components/notifications.prototype";
import type { loader as layoutLoader } from "./layout.app";

export default function NotificationsPrototypePage() {
  const data = useRouteLoaderData<typeof layoutLoader>("routes/layout.app");
  const hydrated = useHydrated();
  const user = data?.currentUser;
  if (!user) return <div className="p-8">Select a user from the DevUI panel.</div>;
  if (!hydrated) return null;
  return (
    <VariantBPage
      viewer={{ id: user.id, role: user.role, isTeamAdmin: data.isTeamAdmin }}
    />
  );
}
