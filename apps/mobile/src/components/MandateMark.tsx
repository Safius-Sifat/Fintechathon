import Svg, { Circle, Path } from "react-native-svg";
import { useColors } from "../theme";

// The Mandate "M" from the seal, on a primary disc: the agent's avatar.
// Same geometry as the seal's mark, drawn as one stroke.
export function MandateMark({ size = 28 }: { size?: number }) {
  const colors = useColors();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle cx={50} cy={50} r={50} fill={colors.primary} />
      <Path
        d="M27 70 V30 L50 57 L73 30 V70"
        stroke={colors.onPrimary}
        strokeWidth={10}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
