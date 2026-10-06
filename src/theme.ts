import { Platform } from 'react-native';

export const colors = {
  bg: '#0D1015',
  surface: '#161A21',
  raised: '#1E232C',
  border: '#2A303B',
  cardBorder: '#222832',
  nav: '#11151B',
  divider: '#1E232C',
  text: '#F2F4F7',
  secondary: '#C9D0DA',
  muted: '#9AA3B2',
  faint: '#7D8695',
  dim: '#5B6474',
  accent: '#C8F25A',
  onAccent: '#0D1015',
  accentSoft: '#26300F',
  accentTint: '#1A2012',
  caution: '#FF9F43',
  cautionSoft: '#3A2410',
} as const;

export const fonts = {
  display: 'BarlowCondensed_700Bold',
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemi: 'IBMPlexSans_600SemiBold',
  sansBold: 'IBMPlexSans_700Bold',
  mono: 'IBMPlexMono_500Medium',
} as const;

/** Phone-width column; the web build centers this on wide screens. */
export const maxContentWidth = 480;

export const isWeb = Platform.OS === 'web';
