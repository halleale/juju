import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, maxContentWidth } from '@/theme';

export function Display({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.display, style]} />;
}

export function Body({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.body, style]} />;
}

export function Mono({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.mono, style]} />;
}

export function SectionLabel({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text accessibilityRole="header" style={[styles.sectionLabel, style]}>
      {children}
    </Text>
  );
}

/** Full-height, phone-width column with safe-area padding. */
export function Screen({ children, footer, header, gap = 24, scroll = true }: { children: ReactNode; footer?: ReactNode; header?: ReactNode; gap?: number; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, 20) + 12;
  return (
    <View style={styles.page}>
      <View style={styles.column}>
        {header ? <View style={{ paddingTop: top, paddingHorizontal: 20 }}>{header}</View> : null}
        {scroll ? (
          <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { gap, paddingTop: header ? 4 : top }]}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.content, { gap, paddingTop: header ? 4 : top }]}>{children}</View>
        )}
        {footer}
      </View>
    </View>
  );
}

/** Bottom action bar, padded for the home indicator. */
export function Footer({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }, style]}>{children}</View>;
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.chip, on ? styles.chipOn : styles.chipOff]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function Switch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={[styles.switch, value ? styles.switchOn : styles.switchOff]}>
      <View style={[styles.knob, { backgroundColor: value ? colors.bg : colors.muted }]} />
    </Pressable>
  );
}

export function PrimaryButton({ label, onPress, disabled, style }: { label: string; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} style={({ pressed }) => [styles.primary, (pressed || disabled) && { opacity: disabled ? 0.4 : 0.85 }, style]}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: maxContentWidth },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  display: { fontFamily: fonts.display, color: colors.text, textTransform: 'uppercase', fontSize: 34, lineHeight: 34 },
  body: { fontFamily: fonts.sans, color: colors.text, fontSize: 15 },
  mono: { fontFamily: fonts.mono, color: colors.text, fontSize: 15 },
  sectionLabel: { fontFamily: fonts.sansSemi, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted },
  footer: { paddingTop: 16, paddingHorizontal: 20, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.divider, gap: 10 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, justifyContent: 'center' },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  chipOff: { borderColor: colors.border, backgroundColor: colors.surface },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text },
  chipTextOn: { fontFamily: fonts.sansSemi, color: colors.onAccent },
  switch: { width: 52, height: 32, borderRadius: 16, padding: 3, flexDirection: 'row' },
  switchOn: { backgroundColor: colors.accent, justifyContent: 'flex-end' },
  switchOff: { backgroundColor: colors.border, justifyContent: 'flex-start' },
  knob: { width: 26, height: 26, borderRadius: 13 },
  primary: { height: 54, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.onAccent },
});
