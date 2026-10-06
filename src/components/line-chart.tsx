import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/theme';

/** Sparkline of a line or price over time. Oldest point on the left. */
export function LineChart({ points, height = 80, label }: { points: number[]; height?: number; label: string }) {
  const [width, setWidth] = useState(0);
  const pad = 6;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const y = (v: number) => (max === min ? height / 2 : pad + ((max - v) / (max - min)) * (height - pad * 2));
  const x = (i: number) => pad + (i / Math.max(points.length - 1, 1)) * (width - pad * 2);
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const last = points.length - 1;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }} accessible accessibilityRole="image" accessibilityLabel={label}>
      {width > 0 && (
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
          <Path d={`M0 ${height / 4}H${width}M0 ${(height * 3) / 4}H${width}`} stroke={colors.cardBorder} strokeWidth={1} />
          <Path d={d} stroke={colors.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={x(last)} cy={y(points[last])} r={4.5} fill={colors.accent} />
        </Svg>
      )}
    </View>
  );
}
