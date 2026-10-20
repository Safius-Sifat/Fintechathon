import { useState } from "react";
import {
  Chips,
  SectionHeading,
  Note,
  Row,
  Rows,
  Voice,
} from "../components/blocks";
import { Screen } from "../components/Screen";
import { statusLabel } from "../components/StatusTag";
import { historyState, type HistoryState } from "../config/activity";

type Filter = "all" | "sent" | "received" | "agent";

export function ActivityScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  return (
    <Screen title="Activity">
      <Chips
        options={[
          { key: "all", label: "All" },
          { key: "sent", label: "Sent" },
          { key: "received", label: "Received" },
          { key: "agent", label: "Agent" },
        ]}
        selected={filter}
        onSelect={setFilter}
      />
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
          <Voice>History unavailable.</Voice>
          <Note>
            This is not an empty history. This build cannot read activity
            because there is no wallet on this phone and the Mandate service is
            not connected.
          </Note>
          <SectionHeading>Sources</SectionHeading>
          <Rows>
            {state.sources.map((source) => (
              <Row
                key={source.id}
                label={source.title}
                detail={source.detail}
                value={statusLabel(source.state)}
              />
            ))}
          </Rows>
        </>
      );
    case "empty":
      // A working source reported nothing. Not reachable in this build.
      return (
        <>
          <Voice>No activity yet.</Voice>
          <Note>Your wallet is connected and nothing has happened yet.</Note>
        </>
      );
  }
}
