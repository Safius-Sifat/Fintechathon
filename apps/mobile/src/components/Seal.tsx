import { View } from "react-native";
import { makeStyles, useColors } from "../theme";

const BEADS = 48;
const TICKS = 72;

interface SealProps {
  size: number;
  // Beads filled with the accent, 0 to 48. Used as press-and-hold progress.
  filled?: number;
  // Fully signed: the disc is filled and every bead is lit.
  sealed?: boolean;
}

// The notary seal: a ring of beads, a ring of ticks and a disc with the
// Mandate "M". The accent means "signed by you", so it only fills as the seal
// is signed. Decorative: nearby text carries the meaning.
export function Seal({ size, filled = 0, sealed = false }: SealProps) {
  const colors = useColors();
  const styles = useStyles();
  const c = size / 2;
  const beadRing = c - size * 0.035;
  const bead = size * 0.027;
  const tickRing = c - size * 0.135;
  const tickLen = size * 0.05;
  const tickWidth = Math.max(2, size * 0.011);
  const disc = size * 0.62;
  const stroke = disc * 0.075;
  const halfW = disc * 0.25;
  const halfH = disc * 0.21;
  const apexY = disc * 0.07;
  // The "M" is two stems and two diagonals meeting at an apex.
  const diag = (side: -1 | 1) => {
    const x1 = side * halfW;
    const y1 = -halfH;
    const len = Math.hypot(x1, apexY - y1);
    const angle = (Math.atan2(apexY - y1, -x1) * 180) / Math.PI;
    return {
      width: len,
      left: disc / 2 + x1 / 2 - len / 2,
      top: disc / 2 + (y1 + apexY) / 2 - stroke / 2,
      transform: [{ rotate: `${angle}deg` }],
    };
  };
  const markColor = sealed ? colors.onAccent : colors.waxTint;
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
              left: c + Math.cos(angle) * beadRing - bead,
              top: c + Math.sin(angle) * beadRing - bead,
              backgroundColor: lit ? colors.accent : colors.raised,
              borderWidth: 1,
              borderColor: lit ? colors.accent : colors.rule,
            }}
          />
        );
      })}
      {Array.from({ length: TICKS }, (_, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: tickWidth,
            height: tickLen,
            borderRadius: tickWidth / 2,
            left: c - tickWidth / 2,
            top: c - tickLen / 2,
            backgroundColor: sealed ? colors.accent : colors.waxTint,
            transform: [
              { rotate: `${(i / TICKS) * 360}deg` },
              { translateY: -tickRing },
            ],
          }}
        />
      ))}
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
        <View
          style={[
            styles.bar,
            {
              left: disc / 2 - halfW - stroke / 2,
              top: disc / 2 - halfH,
              width: stroke,
              height: halfH * 2 + stroke * 0.2,
              backgroundColor: markColor,
              borderRadius: stroke / 2,
            },
          ]}
        />
        <View
          style={[
            styles.bar,
            {
              left: disc / 2 + halfW - stroke / 2,
              top: disc / 2 - halfH,
              width: stroke,
              height: halfH * 2 + stroke * 0.2,
              backgroundColor: markColor,
              borderRadius: stroke / 2,
            },
          ]}
        />
        {([-1, 1] as const).map((side) => (
          <View
            key={side}
            style={[
              styles.bar,
              diag(side),
              {
                height: stroke,
                backgroundColor: markColor,
                borderRadius: stroke / 2,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  disc: { position: "absolute", borderWidth: 1 },
  bar: { position: "absolute" },
}));
