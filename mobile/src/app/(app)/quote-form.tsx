/**
 * Send (or edit) my quote for a job request (FR-200). Params: `listingId`, optional `quoteId`
 * (edit), and the current values for editing. Amount typed in rupees, sent as paise.
 * Sending opens the chat with the buyer (the quote is posted there too).
 */
import { createQuoteSchema, QUOTE_MESSAGE_MAX, rupeesToPaise } from '@cc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText, Button, Notice, Screen, TextField } from '@/components/ui';
import { ApiError, describeError } from '@/lib/api/api-error';
import { chatKeys } from '@/lib/chat/chat-api';
import { paiseToRupeesText } from '@/lib/listings/format';
import { quoteKeys, quotesApi } from '@/lib/quotes/quotes-api';
import { useTheme } from '@/theme/use-theme';

type Field = 'amount' | 'message' | 'etaDate';

export default function QuoteFormScreen() {
  const { spacing } = useTheme();
  const client = useQueryClient();
  const params = useLocalSearchParams<{ listingId: string; quoteId?: string; amountPaise?: string; message?: string; etaDate?: string; title?: string }>();
  const editing = !!params.quoteId;
  const [amount, setAmount] = useState(params.amountPaise ? paiseToRupeesText(Number(params.amountPaise)) : '');
  const [message, setMessage] = useState(params.message ?? '');
  const [etaDate, setEtaDate] = useState(params.etaDate ?? '');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setFormError(null);
    const amountPaise = rupeesToPaise(amount);
    const body = { amountPaise: amountPaise ?? Number.NaN, message, etaDate: etaDate.trim() || null };
    const parsed = createQuoteSchema.safeParse(body);
    if (amountPaise === null || !parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      if (amountPaise === null) next.amount = 'Enter an amount in rupees, e.g. 2500';
      for (const issue of parsed.success ? [] : parsed.error.issues) {
        const key = issue.path[0] === 'amountPaise' ? 'amount' : (issue.path[0] as Field);
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setBusy(true);
    try {
      const quote = editing
        ? await quotesApi.update(params.quoteId!, parsed.data)
        : await quotesApi.create(params.listingId, parsed.data);
      await client.invalidateQueries({ queryKey: quoteKeys.all });
      await client.invalidateQueries({ queryKey: chatKeys.all });
      if (!editing && quote.conversationId) {
        router.replace({ pathname: '/chat/[id]', params: { id: quote.conversationId } });
      } else {
        router.back();
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'AUTH_EMAIL_NOT_VERIFIED') {
        setFormError('Verify your email before sending quotes.');
      } else {
        setFormError(describeError(error));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
        {params.title ? <AppText variant="heading">{params.title}</AppText> : null}
        <AppText color="textMuted">
          Your quote goes to the person who posted this job, together with your profile, rating and badges.
          You can edit or withdraw it until they accept.
        </AppText>
        {formError ? <Notice tone="danger" message={formError} /> : null}
        <TextField label="Your price (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" error={errors.amount} />
        <TextField
          label="Message"
          hint="How you will do it, what is included, your experience"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={5}
          maxLength={QUOTE_MESSAGE_MAX}
          style={{ minHeight: 120, textAlignVertical: 'top' }}
          error={errors.message}
        />
        <TextField label="Can finish by (optional)" placeholder="YYYY-MM-DD" value={etaDate} onChangeText={setEtaDate} maxLength={10} error={errors.etaDate} />
        <Button label={editing ? 'Save quote' : 'Send quote'} loading={busy} onPress={() => void submit()} />
      </View>
    </Screen>
  );
}
