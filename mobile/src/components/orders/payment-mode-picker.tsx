/**
 * Choose how an order is paid (FR-403): directly (cash/UPI outside the app, on completion) or
 * escrow (in-app test-mode wallet, held until approval). `ESCROW_AVAILABLE` can switch escrow off.
 */
import type { PaymentMode } from '@cc/shared';
import { View } from 'react-native';
import { AppText, Segmented } from '@/components/ui';
import { ESCROW_AVAILABLE } from '@/lib/orders/orders-api';
import { useTheme } from '@/theme/use-theme';

export function PaymentModePicker({ value, onChange }: { value: PaymentMode; onChange: (mode: PaymentMode) => void }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Segmented
        label="How will you pay?"
        options={[
          { value: 'DIRECT', label: 'Pay directly' },
          { value: 'ESCROW', label: ESCROW_AVAILABLE ? 'Wallet (safer)' : 'Wallet (soon)' },
        ]}
        value={value}
        onChange={(mode) => {
          if (mode === 'ESCROW' && !ESCROW_AVAILABLE) return;
          onChange(mode);
        }}
      />
      <AppText variant="caption" color="textMuted">
        {value === 'DIRECT'
          ? 'You pay the seller yourself (cash or UPI) when the work is done. CampusConnect does not hold the money.'
          : 'Your money is held safely in the app and released to the seller only when you approve the work.'}
      </AppText>
    </View>
  );
}
