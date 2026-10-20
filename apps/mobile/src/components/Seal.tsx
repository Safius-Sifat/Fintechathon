import { Text, View } from "react-native";
import { fonts, makeStyles, useColors } from "../theme";

const BEADS = 48;

interface SealProps {
  size: number;
  // Beads filled with the accent, 0 to 48. Used as press-and-hold progress.
  filled?: number;
  // Fully signed: the disc is filled and every bead is lit.
  sealed?: boolean;
}

// The notary seal: a ring of beads around a disc with the Mandate "M". The
// accent means "signed by you", so it only appears as the seal fills.
// Decorative: nearby text carries the meaning.
export function Seal({ size, filled = 0, sealed = false }: SealProps) {
  const colors = useColors();
  const styles = useStyles();
  const ring = size / 2 - size * 0.035;
  const bead = size * 0.027;
  const disc = size * 0.66;
  return (
    <View
      style={{ width: size, height: size }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {Array.from({ length: BEADS }, (_, i) => {
        const angle = (i / BEADS) * Math.PI * 2 - Math.PI / 2;
        const lit = sealed || i < filled;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              width: bead * 2,
              height: bead * 2,
              borderRadius: bead,
              left: size / 2 + Math.cos(angle) * ring - bead,
              top: size / 2 + Math.sin(angle) * ring - bead,
              backgroundColor: lit ? colors.accent : colors.raised,
              borderWidth: 1,
              borderColor: lit ? colors.accent : colors.rule,
            }}
          />
        );
      })}
      <View
        style={[
          styles.disc,
          {
            width: disc,
            height: disc,
            borderRadius: disc / 2,
            left: (size - disc) / 2,
            top: (size - disc) / 2,
            backgroundColor: sealed ? colors.accent : colors.raised,
            borderColor: sealed ? colors.accent : colors.rule,
          },
        ]}
      >
        <Text
          style={[
            styles.mark,
            {
              fontSize: disc * 0.52,
              lineHeight: disc * 0.62,
              color: sealed ? colors.onAccent : colors.waxTint,
            },
          ]}
        >
          M
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  disc: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  mark: { fontFamily: fonts.serifBold, textAlign: "center" },
}));
