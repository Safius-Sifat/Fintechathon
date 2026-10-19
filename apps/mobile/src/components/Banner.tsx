import { StyleSheet, Text, View } from "react-native";
import { colors, radius, space, type } from "../theme";
import { Icon, type IconName } from "./Icon";

interface BannerProps {
  icon: IconName;
  title: string;
  body: string;
}

// Quiet notice for "preview build" style statements, not errors.
export function Banner({ icon, title, body }: BannerProps) {
  return (
    <View
      style={styles.banner}
      accessible
      accessibilityLabel={`${title}. ${body}`}
    >
      <Icon name={icon} size={20} color={colors.textMuted} />
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  text: { flex: 1, gap: 2 },
  title: { ...type.label, fontSize: 13, color: colors.ink },
  body: { ...type.small, color: colors.textMuted },
});
