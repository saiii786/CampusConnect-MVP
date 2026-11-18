/**
 * Order detail (FR-401…409): status, amount, payment mode, the other person, requirements,
 * on-site codes (buyer sees them; seller enters them), the buttons the state machine allows for
 * me right now, and the timeline. Some actions ask for input: a reason (report a problem), a
 * note (ask for changes) or the finish code (mark done on an on-site job).
 */
import { formatPaise, type OrderDetailDto, type UserOrderAction } from '@cc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { AppText, Avatar, Button, Chip, ErrorState, LoadingState, Notice, Screen, TestModeBadge, TextField } from '@/components/ui';
import { ApiError, describeError } from '@/lib/api/api-error';
import { orderKeys, ordersApi, useOrder } from '@/lib/orders/orders-api';
import { walletKeys } from '@/lib/wallet/wallet-api';
import { ACTION_ORDER, DESTRUCTIVE_ACTIONS, isActiveStatus, ORDER_ACTION_LABEL, ORDER_STATUS_LABEL, timelineText } from '@/lib/orders/format';
import { useTheme } from '@/theme/use-theme';

/** Actions that need text from the user before calling the API. */
const NEEDS_INPUT: Partial<Record<UserOrderAction, { label: string; hint: string; field: 'reason' | 'note' }>> = {
  dispute: { label: 'What went wrong?', hint: 'At least 10 characters. An admin will review it.', field: 'reason' },
  'request-changes': { label: 'What should be changed?', hint: 'Be specific so the seller can fix it.', field: 'note' },
};

export default function OrderDetailScreen() {
  const { colors, radius, spacing } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const query = useOrder(id);
  const [pending, setPending] = useState<UserOrderAction | null>(null);
  const [input, setInput] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const done = (order: OrderDetailDto) => {
    client.setQueryData(orderKeys.detail(id), order);
    void client.invalidateQueries({ queryKey: orderKeys.all });
    setPending(null);
    setInput('');
    setCode('');
  };

  const run = async (action: UserOrderAction, body: Record<string, string> = {}) => {
    setBusy(true);
    try {
      done(await ordersApi.act(id, action, body));
      if (action === 'fund' || action === 'approve' || action === 'cancel') void client.invalidateQueries({ queryKey: walletKeys.all });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'WALLET_INSUFFICIENT_FUNDS') {
        Alert.alert('Not enough money', 'Add test money to your wallet, then pay again.', [
          { text: 'Later', style: 'cancel' },
          { text: 'Add money', onPress: () => router.push('/add-money') },
        ]);
      } else {
        Alert.alert('Not done', describeError(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const enterStartCode = async () => {
    setBusy(true);
    try {
      done(await ordersApi.start(id, code));
    } catch (e) {
      Alert.alert('Not started', describeError(e));
    } finally {
      setBusy(false);
    }
  };

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <Screen><ErrorState error={query.error} onRetry={() => query.refetch()} /></Screen>;
  const o = query.data;
  const onsiteSubmit = o.onsite.required && o.availableActions.includes('submit');

  const press = (action: UserOrderAction) => {
    if (NEEDS_INPUT[action] || (action === 'submit' && onsiteSubmit)) {
      setPending(action);
      return;
    }
    Alert.alert(`${ORDER_ACTION_LABEL[action]}?`, undefined, [
      { text: 'Not now', style: 'cancel' },
      { text: ORDER_ACTION_LABEL[action], style: DESTRUCTIVE_ACTIONS.has(action) ? 'destructive' : 'default', onPress: () => void run(action) },
    ]);
  };

  const actions = ACTION_ORDER.filter((a) => o.availableActions.includes(a));
  const inputSpec = pending ? NEEDS_INPUT[pending] : undefined;

  return (
    <Screen>
      <View style={{ gap: spacing.sm }}>
        {o.paymentMode === 'ESCROW' ? <TestModeBadge /> : null}
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Chip label={ORDER_STATUS_LABEL[o.status]} tone={isActiveStatus(o.status) ? 'primary' : 'neutral'} />
          <Chip label={o.paymentMode === 'DIRECT' ? 'Pay directly' : 'Wallet / escrow'} />
          {o.onsite.required ? <Chip label="On-site" /> : null}
        </View>
        <AppText variant="title">{o.title}</AppText>
        <AppText variant="heading" color="primary">
          {formatPaise(o.amountPaise)}
        </AppText>
        {o.deadline ? <AppText color="textMuted">Needed by {o.deadline}</AppText> : null}
        {o.requirements ? <AppText>{o.requirements}</AppText> : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface }}>
        <Avatar name={o.other.displayName} url={o.other.avatarUrl} size={44} />
        <View style={{ flex: 1 }}>
          <AppText variant="caption" color="textMuted">
            {o.role === 'BUYER' ? 'Seller' : 'Buyer'}
          </AppText>
          <AppText variant="label">{o.other.displayName}</AppText>
        </View>
        {o.conversationId ? (
          <Button label="Chat" variant="secondary" fullWidth={false} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: o.conversationId! } })} />
        ) : null}
      </View>

      {o.status === 'SUBMITTED' && o.role === 'BUYER' && o.autoApproveAt ? (
        <Notice
          tone="warning"
          message={`The seller marked the work as done. Approve it or ask for changes (${o.maxChangeRequests - o.changeRequests} left). If you do nothing, it is approved automatically on ${new Date(o.autoApproveAt).toLocaleDateString('en-IN')}.`}
        />
      ) : null}
      {o.status === 'AWAITING_PAYMENT' && o.role === 'BUYER' ? (
        <Notice tone="warning" message={`Pay ${formatPaise(o.amountPaise)} into escrow to start. The seller is paid only when you approve the work.`} />
      ) : null}
      {o.status === 'AWAITING_PAYMENT' && o.role === 'SELLER' ? (
        <Notice message="Waiting for the buyer to pay into escrow. Start working once the order is In progress." />
      ) : null}
      {o.paymentMode === 'DIRECT' && o.status === 'COMPLETED' && o.role === 'BUYER' ? (
        <Notice message={`Remember to pay ${o.other.displayName} ${formatPaise(o.amountPaise)} directly, as agreed.`} />
      ) : null}
      {o.dispute ? (
        <Notice tone="danger" title="Problem reported" message={`${o.dispute.raisedByMe ? 'You' : 'The other person'} reported: "${o.dispute.reason}". An admin will review it.`} />
      ) : null}

      {o.onsite.startCode ? (
        <Notice title={`Start code: ${o.onsite.startCode}`} message="Give this code to the seller only when they arrive. They enter it to start the job." />
      ) : null}
      {o.onsite.finishCode ? (
        <Notice title={`Finish code: ${o.onsite.finishCode}`} message="Give this code to the seller only when the work is finished to your satisfaction." />
      ) : null}
      {o.onsite.canStart ? (
        <View style={{ gap: spacing.sm }}>
          <TextField label="Start code from the buyer" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={4} />
          <Button label="Start the job" loading={busy} disabled={code.length !== 4} onPress={() => void enterStartCode()} />
        </View>
      ) : null}

      {pending ? (
        <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface }}>
          <AppText variant="label">{ORDER_ACTION_LABEL[pending]}</AppText>
          {inputSpec ? (
            <TextField label={inputSpec.label} hint={inputSpec.hint} value={input} onChangeText={setInput} multiline numberOfLines={3} maxLength={1000} />
          ) : null}
          {pending === 'submit' && onsiteSubmit ? (
            <TextField label="Finish code from the buyer" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={4} />
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              label="Confirm"
              fullWidth={false}
              loading={busy}
              onPress={() =>
                void run(pending, {
                  ...(inputSpec && input.trim() ? { [inputSpec.field]: input.trim() } : {}),
                  ...(pending === 'submit' && onsiteSubmit ? { code } : {}),
                })
              }
            />
            <Button label="Back" variant="ghost" fullWidth={false} onPress={() => setPending(null)} />
          </View>
        </View>
      ) : actions.length ? (
        <View style={{ gap: spacing.sm }}>
          {actions.map((a) => (
            <Button
              key={a}
              label={ORDER_ACTION_LABEL[a]}
              variant={DESTRUCTIVE_ACTIONS.has(a) ? 'ghost' : a === actions[0] ? 'primary' : 'secondary'}
              loading={busy}
              onPress={() => press(a)}
            />
          ))}
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading">Timeline</AppText>
        {o.timeline.map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <AppText color="primary">•</AppText>
            <View style={{ flex: 1 }}>
              <AppText>{timelineText(e.action, e.actorRole, o.role)}</AppText>
              {e.note ? <AppText color="textMuted">“{e.note}”</AppText> : null}
              <AppText variant="caption" color="textMuted">
                {new Date(e.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </AppText>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}
