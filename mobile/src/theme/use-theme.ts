/** Current theme (light/dark follows the phone's system setting). */
import { useColorScheme } from '@/hooks/use-color-scheme';
import { palette, radius, spacing, typography, type Colors } from './tokens';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: Colors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
}

export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: palette[scheme], spacing, radius, typography };
}
