import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "../components/Icon";
import {
  shadows,
  space,
  touchTarget,
  type,
  makeStyles,
  useColors,
} from "../theme";

export interface TabMeta {
  label: string;
  icon: IconName;
  iconSelected: IconName;
}

// Plain bottom bar: outline icons with labels; the selected tab switches to a
// filled glyph and dark ink with a bold label.
export function TabBar({
  state,
  navigation,
  meta,
}: BottomTabBarProps & { meta: Record<string, TabMeta> }) {
  const colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}
    >
      {state.routes.map((route, index) => {
        const selected = state.index === index;
        const tab = meta[route.name];
        const color = selected ? colors.ink : colors.ink3;
        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!selected && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            onPress={onPress}
            android_ripple={{
              color: colors.ripple,
              borderless: true,
            }}
            style={styles.item}
          >
            <Icon
              name={selected ? tab.iconSelected : tab.icon}
              size={24}
              color={color}
            />
            <Text
              style={[styles.label, { color }, selected && styles.selected]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.5}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.raised,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    paddingTop: space.sm,
    boxShadow: shadows.bar,
  },
  item: {
    flex: 1,
    minHeight: touchTarget + space.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  label: { ...type.label, fontWeight: "500" },
  selected: { fontWeight: "700" },
}));
