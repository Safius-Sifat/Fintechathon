import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "../../components/Icon";
import {
  radius,
  space,
  touchTarget,
  type,
  makeStyles,
  useColors,
} from "../../theme";
import {
  deleteConversation,
  updateConversation,
  type Conversation,
} from "../../wallet/api";
import { errorText } from "../../wallet/useAsync";
import { chatTitle, groupChats } from "../../state/chatThread";

// Your chats with the agent, from the left as in other agent apps. Deleting a
// chat hides it; orders, payments and receipts stay in Activity.
export function HistoryDrawer({
  open,
  chats,
  loading,
  error,
  current,
  onClose,
  onOpen,
  onNew,
  onChanged,
}: {
  open: boolean;
  chats: readonly Conversation[];
  loading: boolean;
  error: string | null;
  current: string | null;
  onClose: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  // Called after a rename, pin or delete, with the ID of a deleted chat.
  onChanged: (deleted?: string) => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panel = Math.min(width * 0.86, 360);
  const slide = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(open);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<Conversation | null>(null);

  useEffect(() => {
    if (open) setShown(true);
    Animated.timing(slide, {
      toValue: open ? 1 : 0,
      duration: open ? 240 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setShown(false);
    });
  }, [open, slide]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groupChats(
      q ? chats.filter((c) => chatTitle(c).toLowerCase().includes(q)) : chats,
    );
  }, [chats, query]);

  return (
    <Modal
      visible={shown}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.scrim, { opacity: slide }]}>
        <Pressable
          style={styles.fill}
          accessibilityRole="button"
          accessibilityLabel="Close chats"
          onPress={onClose}
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.panel,
          {
            width: panel,
            paddingTop: insets.top + space.md,
            paddingBottom: insets.bottom + space.md,
            transform: [
              {
                translateX: slide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-panel, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.search}>
          <Icon name="magnify" size={20} color={colors.ink3} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search chats"
            placeholderTextColor={colors.ink3}
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Search chats"
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery("")}
              hitSlop={8}
            >
              <Icon name="close-circle" size={18} color={colors.ink3} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onNew}
          style={({ pressed }) => [styles.newChat, pressed && styles.pressed]}
        >
          <Icon name="square-edit-outline" size={20} color={colors.primary} />
          <Text style={styles.newChatText}>New chat</Text>
        </Pressable>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        >
          {groups.map((g) => (
            <View key={g.title} style={styles.group}>
              <Text style={styles.groupTitle} accessibilityRole="header">
                {g.title}
              </Text>
              {g.chats.map((c) => (
                <Pressable
                  key={c.conversationId}
                  accessibilityRole="button"
                  accessibilityLabel={`${chatTitle(c)}${statusWords[c.status]}`}
                  accessibilityHint="Long press for rename, pin and delete"
                  accessibilityState={{
                    selected: c.conversationId === current,
                  }}
                  onPress={() => onOpen(c.conversationId)}
                  onLongPress={() => setMenu(c)}
                  style={({ pressed }) => [
                    styles.chat,
                    c.conversationId === current && styles.chatCurrent,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.chatTitle} numberOfLines={1}>
                    {chatTitle(c)}
                  </Text>
                  <StatusMark status={c.status} />
                </Pressable>
              ))}
            </View>
          ))}
          {!groups.length ? (
            <View style={styles.empty}>
              {loading ? (
                <ActivityIndicator color={colors.ink3} />
              ) : error ? (
                <Text style={styles.emptyText}>{error}</Text>
              ) : query ? (
                <Text style={styles.emptyText}>No chats match “{query}”.</Text>
              ) : (
                <>
                  <Icon name="chat-outline" size={32} color={colors.ink4} />
                  <Text style={styles.emptyTitle}>No chats yet</Text>
                  <Text style={styles.emptyText}>
                    Ask the agent to find something, and the chat appears here.
                  </Text>
                </>
              )}
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>
      {menu ? (
        <ChatMenu
          chat={menu}
          onClose={() => setMenu(null)}
          onChanged={(deleted) => {
            setMenu(null);
            onChanged(deleted);
          }}
        />
      ) : null}
    </Modal>
  );
}

const statusWords: Record<Conversation["status"], string> = {
  needs_you: ", needs you",
  working: ", agent working",
  done: ", order completed",
  idle: "",
};

function StatusMark({ status }: { status: Conversation["status"] }) {
  const styles = useStyles();
  const colors = useColors();
  if (status === "working")
    return <ActivityIndicator size="small" color={colors.primary} />;
  if (status === "needs_you") return <View style={styles.dot} />;
  if (status === "done")
    return <Icon name="check-circle" size={16} color={colors.good} />;
  return null;
}

// Rename, pin or delete one chat.
function ChatMenu({
  chat,
  onClose,
  onChanged,
}: {
  chat: Conversation;
  onClose: () => void;
  onChanged: (deleted?: string) => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(chat.title ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (work: () => Promise<void>, deleted?: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      onChanged(deleted);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = () =>
    Alert.alert(
      "Delete this chat?",
      "Orders and payments it started stay in Activity.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            act(
              () => deleteConversation(chat.conversationId),
              chat.conversationId,
            ),
        },
      ],
    );
  const options: [string, IconName, () => void, boolean?][] = [
    ["Rename", "pencil-outline", () => setRenaming(true)],
    [
      chat.pinned ? "Unpin" : "Pin",
      chat.pinned ? "pin-off-outline" : "pin-outline",
      () =>
        act(() =>
          updateConversation(chat.conversationId, { pinned: !chat.pinned }),
        ),
    ],
    ["Delete", "trash-can-outline", remove, true],
  ];
  return (
    <View style={styles.menuLayer}>
      <Pressable
        style={[styles.fill, styles.menuScrim]}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
        onPress={onClose}
      />
      <View
        style={[styles.menu, { paddingBottom: insets.bottom + space.lg }]}
        accessibilityViewIsModal
      >
        <Text style={styles.menuTitle} numberOfLines={1}>
          {chatTitle(chat)}
        </Text>
        {renaming ? (
          <View style={styles.rename}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              autoFocus
              maxLength={80}
              placeholder="Chat name"
              placeholderTextColor={colors.ink3}
              style={styles.renameInput}
              accessibilityLabel="Chat name"
              returnKeyType="done"
              onSubmitEditing={() =>
                title.trim() &&
                act(() =>
                  updateConversation(chat.conversationId, {
                    title: title.trim(),
                  }),
                )
              }
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy || !title.trim()}
              onPress={() =>
                act(() =>
                  updateConversation(chat.conversationId, {
                    title: title.trim(),
                  }),
                )
              }
              style={({ pressed }) => [
                styles.save,
                (!title.trim() || busy) && styles.saveOff,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>
        ) : (
          options.map(([label, icon, onPress, danger]) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              disabled={busy}
              onPress={onPress}
              style={({ pressed }) => [
                styles.option,
                pressed && styles.pressed,
              ]}
            >
              <Icon
                name={icon}
                size={22}
                color={danger ? colors.bad : colors.ink}
              />
              <Text style={[styles.optionText, danger && styles.danger]}>
                {label}
              </Text>
            </Pressable>
          ))
        )}
        {busy ? <ActivityIndicator color={colors.ink3} /> : null}
        {error ? <Text style={styles.menuError}>{error}</Text> : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  fill: { flex: 1 },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.ground,
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.tile,
  },
  searchInput: { ...type.body, flex: 1, color: colors.ink, paddingVertical: 8 },
  newChat: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: touchTarget,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  newChatText: { ...type.bodyStrong, color: colors.primary },
  list: { paddingBottom: space.xl, gap: space.lg },
  group: { gap: 2 },
  groupTitle: {
    ...type.label,
    color: colors.ink3,
    paddingHorizontal: space.md,
    paddingBottom: space.xs,
  },
  chat: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: touchTarget - 4,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  chatCurrent: { backgroundColor: colors.tile },
  chatTitle: { ...type.body, color: colors.ink, flex: 1 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  empty: {
    alignItems: "center",
    gap: space.sm,
    paddingTop: space.xxxl,
    paddingHorizontal: space.lg,
  },
  emptyTitle: { ...type.heading, color: colors.ink },
  emptyText: { ...type.small, color: colors.ink3, textAlign: "center" },
  menuLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  menuScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  menu: {
    backgroundColor: colors.raised,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.xs,
  },
  menuTitle: {
    ...type.heading,
    color: colors.ink,
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: touchTarget,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
  },
  optionText: { ...type.body, color: colors.ink },
  danger: { color: colors.bad },
  rename: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  renameInput: {
    ...type.body,
    flex: 1,
    minHeight: touchTarget,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.rule,
    color: colors.ink,
  },
  save: {
    minHeight: touchTarget,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  saveOff: { opacity: 0.5 },
  saveText: { ...type.bodyStrong, color: colors.onPrimary },
  menuError: { ...type.small, color: colors.bad, paddingHorizontal: space.sm },
  pressed: { opacity: 0.8 },
}));
