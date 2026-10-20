import { Note, Row, Rows, SectionHeading, Voice } from "../components/blocks";
import { Screen } from "../components/Screen";
import { statusLabel } from "../components/StatusTag";
import { agentCapabilities } from "../config/capabilities";

// Agents preview. The agent wallet is separate from the personal account.
// None of this exists in the build yet, so each part says so.
export function AgentsScreen() {
  return (
    <Screen title="Agents">
      <Voice>No agent wallet.</Voice>
      <Note>
        Separate funds your agents spend under limits you sign. This build
        cannot create one, fund one or run a task.
      </Note>
      <SectionHeading>What will live here</SectionHeading>
      <Rows>
        {agentCapabilities.map((c) => (
          <Row
            key={c.id}
            label={c.title}
            detail={c.detail}
            value={statusLabel(c.state)}
          />
        ))}
      </Rows>
    </Screen>
  );
}
