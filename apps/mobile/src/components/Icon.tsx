import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";

// One icon family for the whole app. Outline glyphs by default, filled for
// the selected tab. Icons are decorative: the adjacent text carries meaning.
export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
}

export function Icon({ name, size = 24, color }: IconProps) {
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={color}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
