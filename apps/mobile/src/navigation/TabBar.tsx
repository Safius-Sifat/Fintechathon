import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "../components/Icon";
import {
  makeStyles,
  radius,
  shadows,
  space,
  touchTarget,
  type,
  useColors,
} from "../theme";

export interface TabMeta {
  label: string;
  icon: IconName;
  iconSelected: IconName;
}

// Floating pill bar: outline icons with labels; the selected tab sits on a
// soft pill and its label turns to full ink.
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
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, space.md) },
      ]}
    >
      <View accessibilityRole="tablist" style={styles.bar}>
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
              accessibilityLabel={tab?.label}
              onPress={onPress}
              style={[styles.item, selected && styles.itemSelected]}
            >
              <Icon
                name={selected ? tab!.iconSelected : tab!.icon}
                size={24}
                color={color}
              />
              <Text
                style={[
                  styles.label,
                  { color },
                  selected && styles.labelSelected,
                ]}
                numberOfLines={1}
              >
                {tab?.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { paddingHorizontal: space.lg, backgroundColor: colors.ground },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.xs,
    borderRadius: radius.hero + 4,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.rule,
    boxShadow: shadows.card,
  },
  item: {
    flex: 1,
    minHeight: touchTarget + space.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: radius.hero,
  },
  itemSelected: { backgroundColor: colors.tile },
  label: { ...type.label },
  labelSelected: { fontWeight: "700" },
}));
