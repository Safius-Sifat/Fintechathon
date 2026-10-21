import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SvgUri } from "react-native-svg";
import { CardLine, ThreadCard } from "../../components/chat";
import { Icon } from "../../components/Icon";
import { agentLine, canStop } from "../../state/agentThread";
import type { ChatStep } from "../../state/chatThread";
import {
  radius,
  space,
  touchTarget,
  type,
  makeStyles,
  useColors,
} from "../../theme";
import { SHOP_ORIGIN } from "../../wallet/config";
import { formatAmount } from "../../wallet/format";
import type { TaskView } from "../../wallet/service-dto/api";
import type { ShopProduct } from "../../wallet/service-dto/provider";

export const usdc = (units: string) => `${formatAmount(BigInt(units), 6)} USDC`;

// The agent's tool calls for one reply, open while it works and folded to a
// single line once it has answered.
export function WorkingSteps({
  steps,
  writing,
}: {
  steps: readonly ChatStep[];
  writing: boolean;
}) {
  const styles = useStyles();
  const colors = useColors();
  const [open, setOpen] = useState<boolean | null>(null);
  if (!steps.length) return null;
  const expanded = open ?? writing;
  const failed = steps.some((s) => s.state === "failed");
  const title = writing
    ? "Working…"
    : `${failed ? "Stopped after" : "Worked through"} ${steps.length} ${steps.length === 1 ? "step" : "steps"}`;
  return (
    <View style={styles.working}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}. ${expanded ? "Hide" : "Show"} steps`}
        onPress={() => setOpen(!expanded)}
        hitSlop={8}
        style={({ pressed }) => [styles.workingHead, pressed && styles.pressed]}
      >
        {writing ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Icon name="playlist-check" size={18} color={colors.ink3} />
        )}
        <Text style={styles.workingTitle}>{title}</Text>
        <Icon
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.ink3}
        />
      </Pressable>
      {expanded ? (
        <View style={styles.stepList}>
          {steps.map((s) => (
            <View
              key={s.id}
              style={styles.step}
              accessible
              accessibilityLabel={`${s.state === "done" ? "Done" : s.state === "failed" ? "Failed" : "In progress"}. ${s.label}${s.detail ? `. ${s.detail}` : ""}`}
            >
              <View style={styles.stepMark}>
                {s.state === "done" ? (
                  <Icon name="check-circle" size={16} color={colors.good} />
                ) : s.state === "failed" ? (
                  <Icon name="close-circle" size={16} color={colors.bad} />
                ) : (
                  <ActivityIndicator size="small" color={colors.primary} />
                )}
              </View>
              <Text style={styles.stepLabel}>
                {s.label}
                {s.detail ? (
                  <Text style={styles.stepDetail}>{` · ${s.detail}`}</Text>
                ) : null}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// "Thinking" before the first word or step arrives.
export function Thinking() {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.thinking} accessibilityLabel="The agent is thinking">
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.thinkingText}>Thinking…</Text>
    </View>
  );
}

function ProductImage({ product }: { product: ShopProduct }) {
  const styles = useStyles();
  const colors = useColors();
  const fallback = (
    <View style={styles.imageFallback}>
      <Icon name="shoe-sneaker" size={40} color={colors.ink4} />
    </View>
  );
  return (
    <View style={styles.image}>
      {SHOP_ORIGIN ? (
        <SvgUri
          uri={`${SHOP_ORIGIN}${product.image}`}
          width="100%"
          height="100%"
          fallback={fallback}
        />
      ) : (
        fallback
      )}
    </View>
  );
}

// Products the shop returned, side by side. Choosing sends the pick to the
// agent as your next message.
export function ProductRow({
  note,
  products,
  onChoose,
}: {
  note: string;
  products: readonly ShopProduct[];
  onChoose?: (product: ShopProduct) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.products}>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.productRow}
      >
        {products.map((p) => (
          <View
            key={p.productId}
            style={styles.product}
            accessible
            accessibilityLabel={`${p.name} by ${p.brand}, ${usdc(p.price)}${p.sizes.length ? `, sizes ${p.sizes.join(", ")}` : ""}`}
          >
            <ProductImage product={p} />
            <View style={styles.productText}>
              <Text style={styles.productName} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={styles.productBrand} numberOfLines={1}>
                {p.brand} · {p.colors.join(" / ")}
              </Text>
              <Text style={styles.productPrice}>{usdc(p.price)}</Text>
            </View>
            {onChoose ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Choose ${p.name}`}
                onPress={() => onChoose(p)}
                style={({ pressed }) => [
                  styles.choose,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.chooseText}>Choose</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// A short question with tappable answers; only the latest one is live.
export function QuestionChips({
  question,
  options,
  onPick,
}: {
  question: string;
  options: readonly string[];
  onPick?: (option: string) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.question}>
      <Text style={styles.questionText}>{question}</Text>
      <View style={styles.chips}>
        {options.map((o) => (
          <Pressable
            key={o}
            accessibilityRole="button"
            accessibilityState={{ disabled: !onPick }}
            disabled={!onPick}
            onPress={() => onPick?.(o)}
            style={({ pressed }) => [
              styles.chip,
              !onPick && styles.chipOff,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipText, !onPick && styles.chipTextOff]}>
              {o}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// An order the agent prepared. Nothing is paid until you approve it.
export function OrderCard({
  product,
  size,
  amount,
  task,
  onOpen,
}: {
  product: ShopProduct;
  size: string | null;
  amount: string;
  task: TaskView | undefined;
  onOpen: () => void;
}) {
  const styles = useStyles();
  const waiting = task?.outcomeState === "AWAITING_OWNER";
  return (
    <ThreadCard>
      <View style={styles.orderHead}>
        <View style={styles.orderThumb}>
          <ProductImage product={product} />
        </View>
        <View style={styles.productText}>
          <Text style={styles.cardTitle}>{product.name}</Text>
          <Text style={styles.productBrand}>
            {product.brand}
            {size ? ` · Size ${size}` : ""}
          </Text>
        </View>
      </View>
      <CardLine label="Price" value={usdc(amount)} />
      <CardLine label="Shop" value="Mandate Test Shop" />
      <TaskStatus task={task} />
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [
          waiting ? styles.primaryAction : styles.secondaryAction,
          pressed && styles.pressed,
        ]}
      >
        <Text style={waiting ? styles.primaryText : styles.secondaryText}>
          {waiting ? "Review and approve" : "Open order"}
        </Text>
      </Pressable>
      <Text style={styles.fine}>Test shop – no goods ship.</Text>
    </ThreadCard>
  );
}

// A paid page check the agent prepared.
export function CheckCard({
  label,
  task,
  onOpen,
}: {
  label: string;
  task: TaskView | undefined;
  onOpen: () => void;
}) {
  const styles = useStyles();
  const waiting = task?.outcomeState === "AWAITING_OWNER";
  return (
    <ThreadCard>
      <Text style={styles.cardTitle}>{label}</Text>
      <TaskStatus task={task} />
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [
          waiting ? styles.primaryAction : styles.secondaryAction,
          pressed && styles.pressed,
        ]}
      >
        <Text style={waiting ? styles.primaryText : styles.secondaryText}>
          {waiting ? "Review and approve" : "Open check"}
        </Text>
      </Pressable>
    </ThreadCard>
  );
}

function TaskStatus({ task }: { task: TaskView | undefined }) {
  const styles = useStyles();
  const colors = useColors();
  if (!task)
    return (
      <View style={styles.status}>
        <ActivityIndicator size="small" color={colors.ink3} />
        <Text style={styles.statusText}>Reading the latest status…</Text>
      </View>
    );
  const live = canStop(task);
  return (
    <View style={styles.status} accessibilityLiveRegion="polite">
      {live ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Icon
          name={
            task.outcomeState === "COMPLETED"
              ? "check-circle"
              : "information-outline"
          }
          size={16}
          color={task.outcomeState === "COMPLETED" ? colors.good : colors.ink3}
        />
      )}
      <Text style={styles.statusText}>{agentLine(task)}</Text>
    </View>
  );
}

// A reply the agent or service could not finish, said plainly.
export function ErrorLine({ message }: { message: string }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Icon name="alert-circle-outline" size={18} color={colors.bad} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  working: { gap: space.xs },
  workingHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    alignSelf: "flex-start",
    minHeight: 32,
  },
  workingTitle: { ...type.small, color: colors.ink2, fontWeight: "600" },
  stepList: {
    gap: space.sm,
    marginLeft: 9,
    paddingLeft: space.md,
    paddingVertical: space.xs,
    borderLeftWidth: 1,
    borderLeftColor: colors.rule,
  },
  step: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  stepMark: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: { ...type.small, color: colors.ink, flex: 1 },
  stepDetail: { color: colors.ink3 },
  thinking: { flexDirection: "row", alignItems: "center", gap: space.sm },
  thinkingText: { ...type.small, color: colors.ink3 },
  products: { gap: space.sm },
  note: { ...type.small, color: colors.ink2 },
  productRow: { gap: space.md, paddingRight: space.xl },
  product: {
    width: 176,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.raised,
    overflow: "hidden",
  },
  image: { width: "100%", aspectRatio: 4 / 3, backgroundColor: colors.tile },
  imageFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  productText: { flex: 1, gap: 2, padding: space.md, paddingBottom: 0 },
  productName: { ...type.bodyStrong, color: colors.ink },
  productBrand: { ...type.small, color: colors.ink3 },
  productPrice: { ...type.bodyStrong, color: colors.ink, marginTop: space.xs },
  choose: {
    margin: space.md,
    minHeight: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryTint,
  },
  chooseText: { ...type.bodyStrong, color: colors.primary },
  question: { gap: space.sm },
  questionText: { ...type.body, color: colors.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: touchTarget - 8,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  chipOff: { borderColor: colors.rule, backgroundColor: "transparent" },
  chipText: { ...type.bodyStrong, color: colors.primary },
  chipTextOff: { color: colors.ink3 },
  orderHead: { flexDirection: "row", gap: space.md, alignItems: "center" },
  orderThumb: {
    width: 72,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  cardTitle: { ...type.heading, color: colors.ink },
  status: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  statusText: { ...type.small, color: colors.ink2, flex: 1 },
  primaryAction: {
    minHeight: touchTarget,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  primaryText: { ...type.bodyStrong, color: colors.onPrimary },
  secondaryAction: {
    minHeight: touchTarget - 8,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.rule,
  },
  secondaryText: { ...type.bodyStrong, color: colors.ink },
  fine: { ...type.small, color: colors.ink3 },
  error: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  errorText: { ...type.body, color: colors.bad, flex: 1 },
  pressed: { opacity: 0.8 },
}));
