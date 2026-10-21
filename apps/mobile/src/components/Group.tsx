import { Children, Fragment, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { radius, space, type, makeStyles, useColors } from "../theme";
import { Icon, type IconName } from "./Icon";

type Tint = "primary" | "warn" | "bad" | "good" | "plain";

// A raised card of rows split by hairlines, as in grouped iOS settings lists.
export function Group({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={styles.rule} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

// Icon in a tinted circle, a title with an optional detail, and an optional
// value; a chevron when the row opens something.
export function IconRow({
  icon,
  tint = "primary",
  title,
  detail,
  value,
  onPress,
}: {
  icon: IconName;
  tint?: Tint;
  title: string;
  detail?: string;
  value?: string;
  onPress?: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const fg = {
    primary: colors.primary,
    warn: colors.warn,
    bad: colors.bad,
    good: colors.good,
    plain: colors.ink2,
  }[tint];
  const body = (
    <View
      style={styles.row}
      accessible={!onPress}
      accessibilityLabel={[title, detail, value].filter(Boolean).join(". ")}
    >
      <View style={[styles.icon, { backgroundColor: colors.tile }]}>
        <Icon name={icon} size={20} color={fg} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {onPress ? (
        <Icon name="chevron-right" size={20} color={colors.ink3} />
      ) : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, detail, value].filter(Boolean).join(". ")}
      onPress={onPress}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {body}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  group: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.raised,
    overflow: "hidden",
  },
  rule: { height: 1, marginLeft: 64, backgroundColor: colors.rule },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 60,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
  title: { ...type.bodyStrong, color: colors.ink },
  detail: { ...type.small, color: colors.ink2 },
  value: { ...type.bodyStrong, color: colors.ink, flexShrink: 0 },
  pressed: { opacity: 0.7 },
}));
