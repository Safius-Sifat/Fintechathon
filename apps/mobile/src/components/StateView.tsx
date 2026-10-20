import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { space, type, type Tone, makeStyles } from "../theme";
import { IconTile } from "./IconTile";
import type { IconName } from "./Icon";

interface StateViewProps {
  icon: IconName;
  tone: Tone;
  title: string;
  body: string;
  // Optional tag under the title, e.g. "Unavailable".
  tag?: ReactNode;
}

// Whole-section state: unavailable, empty or error.
export function StateView({ icon, tone, title, body, tag }: StateViewProps) {
  const styles = useStyles();
  return (
    <View style={styles.root}>
      <IconTile icon={icon} tone={tone} size={64} />
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {tag ? <View style={styles.tag}>{tag}</View> : null}
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: {
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.xl,
    paddingHorizontal: space.sm,
  },
  title: {
    ...type.heading,
    fontSize: 19,
    color: colors.ink,
    textAlign: "center",
  },
  tag: { alignSelf: "center" },
  body: { ...type.body, color: colors.ink2, textAlign: "center" },
}));
