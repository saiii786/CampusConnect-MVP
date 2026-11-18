/**
 * Accept a quote (FR-202). Params: quoteId, sellerName, amountPaise, etaDate.
 * Creates the order; the job closes and other quotes are marked "not selected".
 */
import { formatPaise, ORDER_REQUIREMENTS_MAX, type PaymentMode } from '@cc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { PaymentModePicker } from '@/components/orders/payment-mode-picker';
import { AppText, Button, Notice, Screen, TextField } from '@/components/ui';
import { describeError } from '@/lib/api/api-error';
import { listingKeys } from '@/lib/listings/listings-api';
import { orderKeys, ordersApi } from '@/lib/orders/orders-api';
import { quoteKeys } from '@/lib/quotes/quotes-api';
import { useTheme } from '@/theme/use-theme';

export default function AcceptQuoteScreen() {
  const { spacing } = useTheme();
  const client = useQueryClient();
  const p = useLocalSearchParams<{ quoteId: string; sellerName: string; amountPaise: string; etaDate?: string }>();
  const [requirements, setRequirements] = useState('');
  const [deadline, setDeadline] = useState(p.etaDate ?? '');
  const [mode, setMode] = useState<PaymentMode>('DIRECT');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const order = await ordersApi.acceptQuote(p.quoteId, {
        paymentMode: mode,
        requirements: requirements.trim() || null,
        deadline: deadline.trim() || null,
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: orderKeys.all }),
        client.invalidateQueries({ queryKey: quoteKeys.all }),
        client.invalidateQueries({ queryKey: listingKeys.all }),
      ]);
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
        <AppText variant="heading">
          Hire {p.sellerName} for {formatPaise(Number(p.amountPaise))}
        </AppText>
        <AppText color="textMuted">Your job will close and the other quotes will be marked as not selected.</AppText>
        <TextField
          label="Anything else the seller should know? (optional)"
          value={requirements}
          onChangeText={setRequirements}
          multiline
          numberOfLines={3}
          maxLength={ORDER_REQUIREMENTS_MAX}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
        <TextField label="Needed by (optional)" placeholder="YYYY-MM-DD" value={deadline} onChangeText={setDeadline} maxLength={10} />
        <PaymentModePicker value={mode} onChange={setMode} />
        {error ? <Notice tone="danger" message={error} /> : null}
        <Button label="Accept quote" loading={busy} onPress={() => void submit()} />
      </View>
    </Screen>
  );
}
