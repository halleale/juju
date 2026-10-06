import Svg, { Circle, Path } from 'react-native-svg';

type IconProps = { size?: number; color: string; strokeWidth?: number };

function make(paths: (c: string) => React.ReactNode, defaultStroke = 2) {
  return function Icon({ size = 22, color, strokeWidth = defaultStroke }: IconProps) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {paths(color)}
      </Svg>
    );
  };
}

export const TrendIcon = make(() => (
  <>
    <Path d="M3 17l6-6 4 4 8-8" />
    <Path d="M15 7h6v6" />
  </>
));
export const TrendLineIcon = make(() => <Path d="M3 17l6-6 4 4 8-8" />, 2.2);
export const BellIcon = make(() => (
  <>
    <Path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9" />
    <Path d="M10.3 21a1.94 1.94 0 003.4 0" />
  </>
));
export const BarsIcon = make(() => <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />);
export const PersonIcon = make(() => (
  <>
    <Circle cx="12" cy="8" r="4" />
    <Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </>
));
export const ArrowUpRightIcon = make(() => <Path d="M7 17L17 7M9 7h8v8" />, 2.2);
export const InfoIcon = make(() => (
  <>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 8v4M12 16h.01" />
  </>
), 2.2);
export const CheckIcon = make(() => <Path d="M20 6L9 17l-5-5" />, 2.2);
export const PlusIcon = make(() => <Path d="M12 5v14M5 12h14" />, 3);
export const MinusIcon = make(() => <Path d="M5 12h14" />, 3);
export const BackIcon = make(() => <Path d="M15 18l-6-6 6-6" />, 2.2);
export const SearchIcon = make(() => (
  <>
    <Circle cx="11" cy="11" r="7" />
    <Path d="M20 20l-3.5-3.5" />
  </>
));
export const CloseIcon = make(() => <Path d="M6 6l12 12M18 6L6 18" />, 2.4);

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke="#C8F25A" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 18l6-6 4 4 9-10" />
      <Path d="M16 6h6v6" />
    </Svg>
  );
}
