/**
 * Withdraw (FR-454) — SIMULATED: the amount leaves the wallet, but no real transfer happens.
 */
import { formatPaise, rupeesToPaise, WITHDRAWAL_MIN_PAISE } from '@cc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { AppText, Button, Notice, Screen, TestModeBadge, TextField } from '@/components/ui';
import { describeError } from '@/lib/api/api-error';
import { useWallet, walletApi, walletKeys } from '@/lib/wallet/wallet-api';
import { useTheme } from '@/theme/use-theme';

export default function WithdrawScreen() {
  const { spacing } = useTheme();
  const client = useQueryClient();
  const wallet = useWallet();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    const amountPaise = rupeesToPaise(text);
    if (amountPaise === null || amountPaise < WITHDRAWAL_MIN_PAISE) {
      setError(`Enter at least ${formatPaise(WITHDRAWAL_MIN_PAISE)}`);
      return;
    }
    setBusy(true);
    try {
      await walletApi.withdraw(amountPaise);
      await client.invalidateQueries({ queryKey: walletKeys.all });
      Alert.alert('Withdrawal recorded', `${formatPaise(amountPaise)} — test mode, no real transfer.`);
      router.back();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
        <TestModeBadge />
        <AppText color="textMuted">
          In test mode a withdrawal is only recorded — no money is sent to a bank account.
          {wallet.data ? ` Available: ${formatPaise(wallet.data.balancePaise)}.` : ''}
        </AppText>
        <TextField label="Amount (₹)" value={text} onChangeText={setText} keyboardType="decimal-pad" />
        {error ? <Notice tone="danger" message={error} /> : null}
        <Button label="Withdraw (simulated)" loading={busy} onPress={() => void submit()} />
      </View>
    </Screen>
  );
}
