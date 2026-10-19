import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { useEffect, useState } from "react";
import {
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton, TextButton } from "../components/Button";
import { Card } from "../components/Card";
import { Icon } from "../components/Icon";
import { IconTile } from "../components/IconTile";
import { Screen } from "../components/Screen";
import { StatusTag } from "../components/StatusTag";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, fonts, radius, space, touchTarget, type } from "../theme";

// QR scanner. Reading a code works; understanding it as a payment request
// does not exist yet, so a scan only shows the code's text. Nothing is
// opened, paid, signed or saved. The camera runs only while this screen is
// open and only after the user allows it.

type Props = NativeStackScreenProps<RootStackParamList, "Scan">;

export function ScanScreen({ navigation }: Props) {
  const [permission, requestPermission, getPermission] = useCameraPermissions();

  // Returning from system settings must pick up a newly granted permission.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") getPermission();
    });
    return () => subscription.remove();
  }, [getPermission]);

  const close = () => navigation.goBack();

  if (!permission) {
    return (
      <Screen title="Scan a QR code" onBack={close}>
        {null}
      </Screen>
    );
  }
  if (permission.granted) return <Scanner onClose={close} />;

  if (permission.status === "undetermined") {
    return (
      <PermissionView
        icon="qrcode-scan"
        title="Scan a QR code"
        body="Mandate uses the camera only while this screen is open, and only to read QR codes. Scanning never pays or signs anything."
        actionLabel="Allow camera"
        onAction={requestPermission}
        cancelLabel="Not now"
        onCancel={close}
      />
    );
  }
  return permission.canAskAgain ? (
    <PermissionView
      icon="camera-off-outline"
      title="Camera access denied"
      body="Without the camera, Mandate cannot scan QR codes. Everything else keeps working."
      actionLabel="Try again"
      onAction={requestPermission}
      cancelLabel="Cancel"
      onCancel={close}
    />
  ) : (
    <PermissionView
      icon="camera-off-outline"
      title="Camera access is off"
      body="Android will not ask again. To scan QR codes, allow the camera for Mandate in system settings."
      actionLabel="Open settings"
      onAction={() => Linking.openSettings()}
      cancelLabel="Cancel"
      onCancel={close}
    />
  );
}

interface PermissionViewProps {
  icon: "qrcode-scan" | "camera-off-outline";
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  cancelLabel: string;
  onCancel: () => void;
}

function PermissionView({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  cancelLabel,
  onCancel,
}: PermissionViewProps) {
  return (
    <Screen title={title} onBack={onCancel}>
      <Card>
        <View style={styles.permission}>
          <IconTile icon={icon} tone="blue" size={64} />
          <Text style={styles.permissionText}>{body}</Text>
        </View>
        <PrimaryButton
          label={actionLabel}
          icon="camera-outline"
          onPress={onAction}
        />
        <TextButton label={cancelLabel} onPress={onCancel} />
      </Card>
    </Screen>
  );
}

// Development builds only: previews the result sheet without a camera scan,
// e.g. on an emulator whose virtual camera cannot be pointed at a code. The
// sheet labels it as a sample; release builds do not contain the button.
const DEV_SAMPLE =
  "MANDATE DEVELOPMENT SAMPLE. This text is built into development builds " +
  "to preview the scan result layout. It was not read by the camera and is " +
  "not a payment request or an address. Long-text check: " +
  "abcdefghijklmnopqrstuvwxyz-0123456789-".repeat(4);

interface ScanResult {
  text: string;
  sample: boolean;
}

function Scanner({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [scanned, setScanned] = useState<ScanResult | null>(null);

  const onScanned = (result: BarcodeScanningResult) =>
    setScanned({ text: result.data, sample: false });

  return (
    <View style={styles.scanner}>
      <StatusBar barStyle="light-content" />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        // Stop reading once a code is shown, so it cannot change underneath.
        onBarcodeScanned={scanned === null ? onScanned : undefined}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close scanner"
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Icon name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>

      {scanned === null ? (
        <>
          <View style={styles.frameArea} pointerEvents="none">
            <View style={styles.frame} />
          </View>
          <View
            style={[styles.hint, { marginBottom: insets.bottom + space.xl }]}
          >
            <Text style={styles.hintTitle}>Point the camera at a QR code</Text>
            <Text style={styles.hintText}>
              Scanning only reads the code. It never pays or signs anything.
            </Text>
            {__DEV__ ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setScanned({ text: DEV_SAMPLE, sample: true })}
                style={({ pressed }) => [
                  styles.devSample,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.devSampleText}>
                  Development build: preview the result with a sample
                </Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : (
        <View
          style={[styles.result, { paddingBottom: insets.bottom + space.lg }]}
          accessibilityViewIsModal
        >
          <View style={styles.resultHeader}>
            <IconTile icon="qrcode-scan" tone="green" />
            <Text style={styles.resultTitle} accessibilityRole="header">
              {scanned.sample ? "Sample result" : "QR code read"}
            </Text>
          </View>
          {scanned.sample ? (
            <StatusTag
              state="unavailable"
              label="Development sample, not scanned"
            />
          ) : null}
          <Text style={styles.resultLabel}>Content</Text>
          <ScrollView style={styles.resultBox} nestedScrollEnabled>
            <Text style={styles.resultData} selectable>
              {scanned.text}
            </Text>
          </ScrollView>
          <View style={styles.notice}>
            <Icon
              name="information-outline"
              size={20}
              color={colors.textMuted}
            />
            <Text style={styles.noticeText}>
              Reading payment requests is not available yet. Nothing was paid,
              sent or saved.
            </Text>
          </View>
          <PrimaryButton
            label="Scan again"
            icon="qrcode-scan"
            onPress={() => setScanned(null)}
          />
          <TextButton label="Done" onPress={onClose} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  permission: {
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  permissionText: { ...type.body, color: colors.text, textAlign: "center" },

  scanner: { flex: 1, backgroundColor: "#000000" },
  topBar: { paddingHorizontal: space.lg },
  close: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.7 },
  frameArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  frame: {
    width: 240,
    height: 240,
    borderRadius: radius.hero,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  hint: {
    marginHorizontal: space.xl,
    padding: space.lg,
    gap: space.xs,
    borderRadius: radius.lg,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
  },
  hintTitle: { ...type.bodyStrong, color: colors.onDark, textAlign: "center" },
  hintText: { ...type.small, color: colors.onDarkMuted, textAlign: "center" },

  result: {
    marginTop: "auto",
    padding: space.xl,
    gap: space.md,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    backgroundColor: colors.surface,
  },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: space.md },
  resultTitle: { ...type.heading, color: colors.ink, flex: 1 },
  resultLabel: { ...type.label, color: colors.textMuted },
  // Long content scrolls inside the box instead of pushing the actions off
  // screen.
  resultBox: {
    maxHeight: 160,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  resultData: {
    ...type.body,
    fontFamily: fonts.mono,
    color: colors.ink,
    padding: space.md,
  },
  devSample: {
    marginTop: space.sm,
    minHeight: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.heroLine,
  },
  devSampleText: {
    ...type.label,
    color: colors.onDark,
    textAlign: "center",
    paddingHorizontal: space.sm,
  },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  noticeText: { ...type.small, color: colors.textMuted, flex: 1 },
});
