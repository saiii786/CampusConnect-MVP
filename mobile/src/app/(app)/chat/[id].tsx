/**
 * One conversation (FR-250…254): messages (newest at the bottom, older ones load on scroll),
 * send box, live updates, read receipts (marks read on open and on new messages), safety banner
 * (keep payments in the app), link to the listing and the other person, block/unblock.
 */
import { MESSAGE_MAX } from '@cc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { AppText, Button, ErrorState, LoadingState, Notice, Screen } from '@/components/ui';
import { describeError } from '@/lib/api/api-error';
import { useSession } from '@/lib/auth/session';
import { addMessageToCache, chatApi, chatKeys, useConversation, useMessages } from '@/lib/chat/chat-api';
import { joinConversation, leaveConversation } from '@/lib/realtime/realtime';
import { MIN_TOUCH_SIZE } from '@/theme/tokens';
import { formatShortTime } from '@/lib/chat/format';
import { useTheme } from '@/theme/use-theme';

export default function ChatScreen() {
  const { colors, radius, spacing, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((s) => s.user?.id);
  const client = useQueryClient();
  const conversation = useConversation(id);
  const messages = useMessages(id);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const lastSeen = useRef<string | null>(null);

  const items = messages.data?.pages.flatMap((p) => p.items) ?? [];
  const newestId = items[0]?.id ?? null;

  // Live events for this conversation while the screen is open.
  useEffect(() => {
    void joinConversation(id);
    return () => leaveConversation(id);
  }, [id]);

  // Mark as read when opened and whenever a new message arrives while open.
  useEffect(() => {
    if (!newestId || newestId === lastSeen.current) return;
    lastSeen.current = newestId;
    void chatApi.markRead(id).then(() => {
      void client.invalidateQueries({ queryKey: chatKeys.unread });
      void client.invalidateQueries({ queryKey: chatKeys.conversations });
    });
  }, [id, newestId, client]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const message = await chatApi.send(id, body);
      addMessageToCache(client, message);
      setText('');
      void client.invalidateQueries({ queryKey: chatKeys.conversations });
    } catch (error) {
      Alert.alert('Message not sent', describeError(error));
    } finally {
      setSending(false);
    }
  };

  const toggleBlock = () => {
    const c = conversation.data;
    if (!c) return;
    const action = c.blocked ? 'Unblock' : 'Block';
    Alert.alert(
      `${action} ${c.other.displayName}?`,
      c.blocked ? 'You will be able to message each other again.' : 'You will not be able to message, quote or order with each other.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          style: c.blocked ? 'default' : 'destructive',
          onPress: () =>
            void (c.blocked ? chatApi.unblock(c.other.id) : chatApi.block(c.other.id))
              .then(() => client.invalidateQueries({ queryKey: chatKeys.all }))
              .catch((e: unknown) => Alert.alert('Not changed', describeError(e))),
        },
      ],
    );
  };

  if (conversation.isPending) return <LoadingState />;
  if (conversation.isError) return <Screen><ErrorState error={conversation.error} onRetry={() => conversation.refetch()} /></Screen>;
  const c = conversation.data;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: c.other.displayName }} />
      <View style={{ padding: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderColor: colors.border }}>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          About: {c.listing.title}
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button label="Listing" variant="secondary" fullWidth={false} onPress={() => router.push({ pathname: '/listings/[id]', params: { id: c.listing.id } })} />
          <Button label="Profile" variant="secondary" fullWidth={false} onPress={() => router.push({ pathname: '/users/[id]', params: { id: c.other.id } })} />
          <Button label={c.blocked ? 'Unblock' : 'Block'} variant="ghost" fullWidth={false} onPress={toggleBlock} />
          <Button
            label="Report"
            variant="ghost"
            fullWidth={false}
            onPress={() => router.push({ pathname: '/report', params: { targetType: 'USER', targetId: c.other.id, label: `Report ${c.other.displayName}` } })}
          />
        </View>
      </View>

      <FlatList
        inverted
        data={items}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        onEndReached={() => {
          if (messages.hasNextPage && !messages.isFetchingNextPage) void messages.fetchNextPage();
        }}
        ListEmptyComponent={messages.isPending ? <LoadingState /> : <AppText color="textMuted">Say hello 👋</AppText>}
        ListFooterComponent={
          <View style={{ paddingBottom: spacing.md }}>
            <Notice
              tone="warning"
              message="For your safety, keep payments inside CampusConnect. Never share OTPs or bank passwords."
            />
          </View>
        }
        renderItem={({ item: m }) => {
          const mine = m.senderId === me;
          return (
            <Pressable
              disabled={mine}
              onLongPress={() =>
                Alert.alert('Report this message?', m.body.slice(0, 120), [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Report',
                    style: 'destructive',
                    onPress: () => router.push({ pathname: '/report', params: { targetType: 'MESSAGE', targetId: m.id, label: 'Report a message' } }),
                  },
                ])
              }
              accessibilityHint={mine ? undefined : 'Long press to report'}
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '82%',
                backgroundColor: mine ? colors.primary : colors.surface,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
              accessible
              accessibilityLabel={`${mine ? 'You' : c.other.displayName}: ${m.body}, ${formatShortTime(m.createdAt)}`}
            >
              <AppText style={{ color: mine ? colors.onPrimary : colors.text }} selectable>
                {m.body}
              </AppText>
              <AppText variant="caption" style={{ color: mine ? colors.onPrimary : colors.textMuted, opacity: 0.8, alignSelf: 'flex-end' }}>
                {formatShortTime(m.createdAt)}
              </AppText>
            </Pressable>
          );
        }}
      />

      {c.blocked ? (
        <View style={{ padding: spacing.md }}>
          <Notice message="Messaging is turned off because one of you blocked the other." />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderColor: colors.border, alignItems: 'flex-end' }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Write a message"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Message"
            multiline
            maxLength={MESSAGE_MAX}
            style={[
              typography.body,
              {
                flex: 1,
                minHeight: MIN_TOUCH_SIZE,
                maxHeight: 140,
                color: colors.text,
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              },
            ]}
          />
          <Button label="Send" fullWidth={false} loading={sending} disabled={!text.trim()} onPress={() => void send()} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
