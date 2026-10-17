import { SafeAreaView, StyleSheet, Text, View } from "react-native";
export default function App() {
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.body}>
        <Text style={styles.title}>Mandate</Text>
        <Text style={styles.label}>BASE SEPOLIA · DEVELOPMENT</Text>
        <Text style={styles.text}>Project foundation is ready.</Text>
        <Text style={styles.text}>
          Native owner signing, task approval and financial execution are not
          connected yet.
        </Text>
        <Text style={styles.text}>
          Person 3: follow the Android Owner Wallet handoff in docs/plans.
        </Text>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fafafa" },
  body: { padding: 24, gap: 18 },
  title: { fontSize: 34, fontWeight: "700", color: "#151515" },
  label: { fontSize: 12, fontWeight: "600", color: "#555" },
  text: { fontSize: 17, lineHeight: 25, color: "#222" },
});
