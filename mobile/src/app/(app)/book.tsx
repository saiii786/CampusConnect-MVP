/**
 * Book a service offer (FR-400a). Params: listingId, title, pricingType, pricePaise.
 * Price: fixed → shown; hourly → number of hours; "ask for quote" → the amount agreed in chat.
 * The seller then accepts or declines; the order appears in Orders.
 */
import { formatPaise, MAX_BOOKING_HOURS, ORDER_REQUIREMENTS_MAX, rupeesToPaise, type PaymentMode } from '@cc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { PaymentModePicker } from '@/components/orders/payment-mode-picker';
import { AppText, Button, Notice, Screen, TextField } from '@/components/ui';
import { describeError } from '@/lib/api/api-error';
import { chatKeys } from '@/lib/chat/chat-api';
import { orderKeys, ordersApi } from '@/lib/orders/orders-api';
import { useTheme } from '@/theme/use-theme';

export default function BookScreen() {
  const { spacing } = useTheme();
  const client = useQueryClient();
  const p = useLocalSearchParams<{ listingId: string; title: string; pricingType: string; pricePaise?: string }>();
  const price = p.pricePaise ? Number(p.pricePaise) : null;
  const [hours, setHours] = useState('1');
  const [agreed, setAgreed] = useState('');
  const [requirements, setRequirements] = useState('');
  const [deadline, setDeadline] = useState('');
  const [mode, setMode] = useState<PaymentMode>('DIRECT');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hoursNumber = Number(hours);
  const total =
    p.pricingType === 'FIXED' ? price : p.pricingType === 'HOURLY' && price && Number.isInteger(hoursNumber) ? price * hoursNumber : rupeesToPaise(agreed);

  const submit = async () => {
    setError(null);
    if (p.pricingType === 'HOURLY' && (!Number.isInteger(hoursNumber) || hoursNumber < 1 || hoursNumber > MAX_BOOKING_HOURS)) {
      setError(`Enter whole hours between 1 and ${MAX_BOOKING_HOURS}`);
      return;
    }
    if (p.pricingType === 'QUOTE' && rupeesToPaise(agreed) === null) {
      setError('Enter the price you agreed with the seller, in rupees');
      return;
    }
    setBusy(true);
    try {
      const order = await ordersApi.book({
        listingId: p.listingId,
        paymentMode: mode,
        requirements: requirements.trim() || null,
        deadline: deadline.trim() || null,
        ...(p.pricingType === 'HOURLY' ? { hours: hoursNumber } : {}),
        ...(p.pricingType === 'QUOTE' ? { amountPaise: rupeesToPaise(agreed)! } : {}),
      });
      await client.invalidateQueries({ queryKey: orderKeys.all });
      void client.invalidateQueries({ queryKey: chatKeys.all });
      router.replace({ pathname: '/orders/[id]', params: { id: order.id } });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
        <AppText variant="heading">{p.title}</AppText>
        {p.pricingType === 'HOURLY' ? (
          <TextField label={`Hours (${price ? formatPaise(price) : ''}/hr)`} value={hours} onChangeText={setHours} keyboardType="number-pad" />
        ) : null}
        {p.pricingType === 'QUOTE' ? (
          <TextField label="Agreed price (₹)" hint="The amount you agreed with the seller in chat" value={agreed} onChangeText={setAgreed} keyboardType="decimal-pad" />
        ) : null}
        <AppText variant="heading" color="primary">
          Total: {total ? formatPaise(total) : '—'}
        </AppText>
        <TextField
          label="What do you need? (optional)"
          value={requirements}
          onChangeText={setRequirements}
          multiline
          numberOfLines={4}
          maxLength={ORDER_REQUIREMENTS_MAX}
          style={{ minHeight: 100, textAlignVertical: 'top' }}
        />
        <TextField label="Needed by (optional)" placeholder="YYYY-MM-DD" value={deadline} onChangeText={setDeadline} maxLength={10} />
        <PaymentModePicker value={mode} onChange={setMode} />
        {error ? <Notice tone="danger" message={error} /> : null}
        <Button label="Send booking request" loading={busy} onPress={() => void submit()} />
        <AppText variant="caption" color="textMuted">
          The seller will accept or decline. You can cancel until they accept.
        </AppText>
      </View>
    </Screen>
  );
}
