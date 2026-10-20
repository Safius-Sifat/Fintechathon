import { View } from "react-native";
import { radius, makeStyles, useColors, type Tone } from "../theme";
import { Icon, type IconName } from "./Icon";

interface IconTileProps {
  icon: IconName;
  tone: Tone;
  size?: number;
}

// Rounded tinted square holding a glyph. Decorative; text carries meaning.
export function IconTile({ icon, size = 44 }: IconTileProps) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, backgroundColor: colors.tile },
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={colors.ink} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  tile: {
    borderRadius: radius.tile,
    alignItems: "center",
    justifyContent: "center",
  },
}));
