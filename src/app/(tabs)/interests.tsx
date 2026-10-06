import { StyleSheet, Text, View } from 'react-native';

import { InterestsForm } from '@/components/interests-form';
import { Display, Screen } from '@/components/ui';
import { colors, fonts } from '@/theme';

export default function Interests() {
  return (
    <Screen gap={28}>
      <View style={{ gap: 8 }}>
        <Display>Interests</Display>
        <Text style={s.lede}>Changes apply to your feed and alerts right away.</Text>
      </View>
      <InterestsForm />
    </Screen>
  );
}

const s = StyleSheet.create({
  lede: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.muted },
});
