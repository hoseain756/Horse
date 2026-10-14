import { AppShell } from "@/components/harbor/chrome/app-shell";
import { TraktCallbackBridge } from "@/components/harbor/trakt-callback-bridge";

export default function Page() {
  return (
    <>
      <AppShell />
      {/* Trakt OAuth HTTPS return (App Links / browser redirect):
          relays ?code&state to the app via /api/trakt/relay; renders
          nothing on ordinary visits. */}
      <TraktCallbackBridge />
    </>
  );
}
