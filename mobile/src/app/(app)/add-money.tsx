/**
 * Add money (FR-451): choose an amount → the gateway's checkout opens in the in-app browser
 * (Razorpay test mode, or the development fake page) → the app asks the server to verify
 * (when the app comes back to the foreground and every few seconds) until the payment is
 * PAID / FAILED / EXPIRED. The server confirms with the gateway itself — the app never decides.
 */
import { formatPaise, rupeesToPaise, TOPUP_MAX_PAISE, TOPUP_MIN_PAISE, type TopupDto } from '@cc/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { AppText, Button, Notice, Screen, TestModeBadge, TextField } from '@/components/ui';
import { describeError } from '@/lib/api/api-error';
import { resolveMediaUrl } from '@/lib/api/media-url';
import { walletApi, walletKeys } from '@/lib/wallet/wallet-api';
import { useTheme } from '@/theme/use-theme';

const PRESETS = [200_00, 500_00, 1_000_00, 2_000_00];
const POLL_MS = 3000;
const POLL_FOR_MS = 3 * 60 * 1000;

export default function AddMoneyScreen() {
  const { spacing } = useTheme();
  const client = useQueryClient();
  const [text, setText] = useState('500');
  const [topup, setTopup] = useState<TopupDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(0);

  const finished = topup && topup.status !== 'CREATED';

  // While waiting: verify on return to the app and every few seconds (Android does not tell us when the tab closes).
  useEffect(() => {
    if (!topup || topup.status !== 'CREATED') return;
    const check = () => {
      void walletApi
        .verifyTopup(topup.id)
        .then((t) => {
          setTopup(t);
          if (t.status === 'PAID') void client.invalidateQueries({ queryKey: walletKeys.all });
        })
        .catch(() => undefined);
    };
    const timer = setInterval(() => {
      if (Date.now() - started.current > POLL_FOR_MS) clearInterval(timer);
      else check();
    }, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [topup, client]);

  const start = async () => {
    setError(null);
    const amountPaise = rupeesToPaise(text);
    if (amountPaise === null || amountPaise < TOPUP_MIN_PAISE || amountPaise > TOPUP_MAX_PAISE) {
      setError(`Enter an amount between ${formatPaise(TOPUP_MIN_PAISE)} and ${formatPaise(TOPUP_MAX_PAISE)}`);
      return;
    }
    setBusy(true);
    try {
      const t = await walletApi.createTopup({ amountPaise });
      setTopup(t);
      started.current = Date.now();
      await WebBrowser.openBrowserAsync(resolveMediaUrl(t.checkoutUrl));
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
        {!topup ? (
          <>
            <AppText color="textMuted">
              Test money only. With Razorpay test mode use the test card / UPI shown on the payment page — nothing is charged.
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {PRESETS.map((p) => (
                <Button key={p} label={formatPaise(p)} variant="secondary" fullWidth={false} onPress={() => setText(String(p / 100))} />
              ))}
            </View>
            <TextField label="Amount (₹)" value={text} onChangeText={setText} keyboardType="decimal-pad" />
            {error ? <Notice tone="danger" message={error} /> : null}
            <Button label="Continue to payment" loading={busy} onPress={() => void start()} />
          </>
        ) : !finished ? (
          <>
            <Notice title="Waiting for payment…" message="Finish the payment in the browser, then come back here. This updates by itself." />
            <Button label="Open the payment page again" variant="secondary" onPress={() => void WebBrowser.openBrowserAsync(resolveMediaUrl(topup.checkoutUrl))} />
            <Button
              label="I've paid — check now"
              loading={busy}
              onPress={() => {
                setBusy(true);
                setError(null);
                void walletApi
                  .verifyTopup(topup.id)
                  .then(setTopup)
                  .catch((e: unknown) => setError(describeError(e)))
                  .finally(() => setBusy(false));
              }}
            />
            {error ? <Notice tone="danger" message={error} /> : null}
          </>
        ) : topup.status === 'PAID' ? (
          <>
            <Notice tone="success" title={`${formatPaise(topup.amountPaise)} added`} message="Your wallet has been updated." />
            <Button label="Back to wallet" onPress={() => router.back()} />
          </>
        ) : (
          <>
            <Notice tone="danger" title="Payment not completed" message={`The payment ${topup.status === 'EXPIRED' ? 'expired' : 'was cancelled or failed'}. No money was added.`} />
            <Button label="Try again" onPress={() => setTopup(null)} />
          </>
        )}
      </View>
    </Screen>
  );
}
