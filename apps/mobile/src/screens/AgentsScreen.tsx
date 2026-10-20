import { Banner } from "../components/Banner";
import { Card, SectionTitle } from "../components/Card";
import { CapabilityRow } from "../components/CapabilityRow";
import { Screen } from "../components/Screen";
import { agentCapabilities } from "../config/capabilities";

// Agents preview. The agent wallet is separate from the personal account.
// None of this exists in the build yet, so each part says so.
export function AgentsScreen() {
  return (
    <Screen
      title="Agents"
      subtitle="Separate funds your agents spend under limits you sign."
    >
      <Banner
        icon="information-outline"
        title="No agent wallet"
        body="This build cannot create one, fund one or run a task."
      />
      <SectionTitle>What will live here</SectionTitle>
      <Card>
        {agentCapabilities.map((capability) => (
          <CapabilityRow key={capability.id} capability={capability} />
        ))}
      </Card>
    </Screen>
  );
}
