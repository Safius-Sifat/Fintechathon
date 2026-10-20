import { Text, View } from "react-native";
import { network } from "../config/network";
import { radius, shadows, space, type, makeStyles } from "../theme";

export function ChainChip() {
  const styles = useStyles();
  return (
    <View
      style={styles.chip}
      accessible
      accessibilityLabel={`Network: ${network.name}, chain ${network.chainId}${network.isTestnet ? ", testnet" : ""}`}
    >
      <View style={styles.dot} />
      <Text style={styles.text}>{network.name}</Text>
      {network.isTestnet ? <Text style={styles.testnet}>Testnet</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  chip: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.rule,
    boxShadow: shadows.card,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ink,
  },
  text: { ...type.label, color: colors.ink },
  testnet: { ...type.label, color: colors.ink2 },
}));
