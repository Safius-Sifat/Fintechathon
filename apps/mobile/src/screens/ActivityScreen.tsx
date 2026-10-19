import { Card, SectionTitle } from "../components/Card";
import { CapabilityRow } from "../components/CapabilityRow";
import { Screen } from "../components/Screen";
import { StateView } from "../components/StateView";
import { StatusTag } from "../components/StatusTag";
import { historyState, type HistoryState } from "../config/activity";

export function ActivityScreen() {
  return (
    <Screen title="Activity" subtitle="Personal transfers and agent spending">
      <History state={historyState} />
    </Screen>
  );
}

function History({ state }: { state: HistoryState }) {
  switch (state.kind) {
    case "unavailable":
      // Not the same as "no activity": the app cannot know what happened.
      return (
        <>
          <Card>
            <StateView
              icon="cloud-off-outline"
              tone="amber"
              title="History unavailable"
              tag={<StatusTag state="unavailable" />}
              body="This is not an empty history. This build cannot read activity because there is no wallet on this phone and the Mandate service is not connected."
            />
          </Card>
          <SectionTitle>Sources</SectionTitle>
          <Card>
            {state.sources.map((source) => (
              <CapabilityRow key={source.id} capability={source} />
            ))}
          </Card>
        </>
      );
    case "empty":
      // A working source reported nothing. Not reachable in this build.
      return (
        <Card>
          <StateView
            icon="history"
            tone="slate"
            title="No activity yet"
            body="Your wallet is connected and nothing has happened yet."
          />
        </Card>
      );
  }
}
