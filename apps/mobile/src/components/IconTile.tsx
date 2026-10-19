import { StyleSheet, View } from "react-native";
import { radius, tones, type Tone } from "../theme";
import { Icon, type IconName } from "./Icon";

interface IconTileProps {
  icon: IconName;
  tone: Tone;
  size?: number;
}

// Rounded tinted square holding a glyph. Decorative; text carries meaning.
export function IconTile({ icon, tone, size = 44 }: IconTileProps) {
  const t = tones[tone];
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, backgroundColor: t.bg },
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={t.fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.tile,
    alignItems: "center",
    justifyContent: "center",
  },
});
