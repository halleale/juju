import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, maxContentWidth } from '@/theme';
import { BarsIcon, BellIcon, PersonIcon, TrendIcon } from './icons';

const TABS: Record<string, { label: string; Icon: typeof TrendIcon }> = {
  picks: { label: 'Picks', Icon: TrendIcon },
  alerts: { label: 'Alerts', Icon: BellIcon },
  tracker: { label: 'Tracker', Icon: BarsIcon },
  interests: { label: 'Interests', Icon: PersonIcon },
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
      <View accessibilityRole="tablist" style={s.row}>
        {state.routes.map((route, i) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === i;
          const color = focused ? colors.accent : colors.muted;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              aria-selected={focused}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={s.tab}>
              <tab.Icon color={color} />
              <Text style={[s.label, { color, fontFamily: focused ? fonts.sansSemi : fonts.sansMedium }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { paddingTop: 8, paddingHorizontal: 8, backgroundColor: colors.nav, borderTopWidth: 1, borderTopColor: colors.divider, alignItems: 'center' },
  row: { flexDirection: 'row', width: '100%', maxWidth: maxContentWidth },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 6, minHeight: 44 },
  label: { fontSize: 11 },
});
