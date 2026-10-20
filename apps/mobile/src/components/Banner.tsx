import { Text, View } from "react-native";
import { radius, space, type, makeStyles, useColors } from "../theme";
import { Icon, type IconName } from "./Icon";

interface BannerProps {
  icon: IconName;
  title: string;
  body: string;
}

// Quiet notice for "preview build" style statements, not errors.
export function Banner({ icon, title, body }: BannerProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View
      style={styles.banner}
      accessible
      accessibilityLabel={`${title}. ${body}`}
    >
      <Icon name={icon} size={20} color={colors.ink2} />
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  banner: {
    flexDirection: "row",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  text: { flex: 1, gap: 2 },
  title: { ...type.label, fontSize: 13, color: colors.ink },
  body: { ...type.small, color: colors.ink2 },
}));
