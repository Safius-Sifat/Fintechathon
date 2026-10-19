import { StyleSheet, View } from "react-native";
import { colors, shadows } from "../theme";
import { Icon, type IconName } from "./Icon";

interface OrbChip {
  icon: IconName;
  color: string;
  // Position of the chip centre, as fractions of the orb area.
  x: number;
  y: number;
}

interface OrbProps {
  size: number;
  chips?: readonly OrbChip[];
}

const CHIP = 52;

// Decorative glowing sphere with floating icon chips (the design boards'
// agent orb). Hidden from screen readers; nearby text carries the meaning.
export function Orb({ size, chips = [] }: OrbProps) {
  const sphere = size * 0.56;
  return (
    <View
      style={[styles.area, { width: size, height: size }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <View
        style={[
          styles.glow,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      />
      <View
        style={[
          styles.sphere,
          { width: sphere, height: sphere, borderRadius: sphere / 2 },
        ]}
      />
      {chips.map((chip) => (
        <View
          key={chip.icon}
          style={[
            styles.chip,
            { left: chip.x * size - CHIP / 2, top: chip.y * size - CHIP / 2 },
          ]}
        >
          <Icon name={chip.icon} size={24} color={chip.color} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  area: { alignItems: "center", justifyContent: "center" },
  glow: {
    position: "absolute",
    experimental_backgroundImage:
      "radial-gradient(circle at 50% 50%, rgba(120, 160, 255, 0.42) 0%, rgba(150, 190, 255, 0.18) 45%, rgba(255, 200, 160, 0.10) 60%, rgba(255, 255, 255, 0) 72%)",
  },
  sphere: {
    // Layers paint first-on-top: the translucent peach rim over the sphere.
    experimental_backgroundImage:
      "radial-gradient(circle at 78% 84%, rgba(255, 190, 140, 0.85) 0%, rgba(255, 190, 140, 0) 40%), " +
      "radial-gradient(circle at 34% 28%, #FFFFFF 0%, #D6E3FF 14%, #7FA6F5 42%, #3563D1 72%, #1F3C8F 100%)",
    boxShadow: "0px 18px 40px rgba(47, 107, 223, 0.35)",
  },
  chip: {
    position: "absolute",
    width: CHIP,
    height: CHIP,
    borderRadius: CHIP / 2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: shadows.card,
  },
});
