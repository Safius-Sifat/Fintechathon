import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { Card, SectionTitle } from "../components/Card";
import { CapabilityRow } from "../components/CapabilityRow";
import { Icon } from "../components/Icon";
import { IconTile } from "../components/IconTile";
import { NavRow } from "../components/NavRow";
import { Screen } from "../components/Screen";
import { StateView } from "../components/StateView";
import { StatusTag } from "../components/StatusTag";
import { TaskStateChip } from "../components/TaskStateChip";
import { SAMPLE_TASKS, type SampleTask } from "../config/taskSamples";
import { OUTCOME_INFO } from "../config/taskStatus";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space, type } from "../theme";

// Entry to agent work. Tasks come from the Mandate service, which this build
// does not connect to, so the list is unavailable (not empty). The two task
// forms work locally for layout review; nothing is created or approved.

type Props = NativeStackScreenProps<RootStackParamList, "AgentTasks">;

export function AgentTasksScreen({ navigation }: Props) {
  return (
    <Screen
      title="Agent tasks"
      subtitle="Work your agent does from the agent wallet, inside limits you approve."
      onBack={() => navigation.goBack()}
    >
      <Card>
        <StateView
          icon="cloud-off-outline"
          tone="amber"
          title="Tasks unavailable"
          tag={<StatusTag state="unavailable" />}
          body="This is not an empty list. Tasks come from the Mandate service, which this build does not connect to."
        />
      </Card>

      <SectionTitle>Start a task</SectionTitle>
      <NavRow
        icon="web-check"
        tone="amber"
        label="Browser check"
        value="Pay providers to check a web page"
        accessibilityHint="Opens the browser check form. Nothing is created."
        onPress={() => navigation.navigate("TaskCreate")}
      />
      <NavRow
        icon="calendar-clock"
        tone="amber"
        label="Scheduled payment"
        value="A fixed amount on a fixed timetable"
        accessibilityHint="Opens the scheduled payment form. Nothing is created."
        onPress={() => navigation.navigate("Schedule")}
      />
      <Card>
        <CapabilityRow
          capability={{
            id: "service-allowance",
            title: "Service allowance",
            detail:
              "Let the agent buy allowed services up to a daily or weekly cap.",
            icon: "repeat",
            tone: "slate",
            state: "notBuilt",
          }}
        />
        <CapabilityRow
          capability={{
            id: "liquidity-keeper",
            title: "Liquidity keeper",
            detail: "Move agent funds into or out of the test vault.",
            icon: "bank-transfer",
            tone: "slate",
            state: "notBuilt",
          }}
        />
      </Card>

      <Banner
        icon="shield-check-outline"
        title="How approval works"
        body="You approve each task once, on a protected screen of this phone. The agent then works inside those limits without asking for every payment."
      />

      {__DEV__ ? (
        <>
          <SectionTitle>Development samples</SectionTitle>
          <Text style={styles.devNote}>
            Development builds only. Placeholder tasks to review the task and
            inspection layouts. They are not tasks and never appear in a release
            build.
          </Text>
          <Card>
            {SAMPLE_TASKS.map((task) => (
              <SampleTaskRow
                key={task.id}
                task={task}
                onPress={() =>
                  navigation.navigate("Task", { sampleId: task.id })
                }
              />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function SampleTaskRow({
  task,
  onPress,
}: {
  task: SampleTask;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens the sample task"
      onPress={onPress}
      style={({ pressed }) => [styles.sampleRow, pressed && styles.pressed]}
    >
      <IconTile icon="web-check" tone="amber" size={40} />
      <View style={styles.sampleText}>
        <Text style={styles.sampleTitle}>{task.title}</Text>
        <View style={styles.tags}>
          <TaskStateChip info={OUTCOME_INFO[task.outcome]} />
          <StatusTag state="unavailable" label="Development sample" />
        </View>
      </View>
      <Icon name="chevron-right" size={24} color={colors.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  devNote: { ...type.small, color: colors.textMuted },
  sampleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.xs,
  },
  pressed: { opacity: 0.7 },
  sampleText: { flex: 1, gap: space.xs },
  sampleTitle: { ...type.bodyStrong, color: colors.ink },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
