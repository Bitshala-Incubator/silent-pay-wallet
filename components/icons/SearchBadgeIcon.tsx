import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface SearchBadgeIconProps {
  size?: number;
  gradientStart?: string;
  gradientEnd?: string;
  iconColor?: string;
}

const SearchBadgeIcon: React.FC<SearchBadgeIconProps> = ({
  size = 96,
  gradientStart = '#F3F4F6',
  gradientEnd = '#E5E7EB',
  iconColor = '#64748B',
}) => (
  <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
    <Defs>
      <LinearGradient id="searchBadgeGradient" x1="0" y1="0" x2="95.9929" y2="95.9929" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={gradientStart} />
        <Stop offset="1" stopColor={gradientEnd} />
      </LinearGradient>
    </Defs>
    <Path
      d="M0 47.9965C0 21.4887 21.4887 0 47.9965 0C74.5042 0 95.9929 21.4887 95.9929 47.9965C95.9929 74.5042 74.5042 95.9929 47.9965 95.9929C21.4887 95.9929 0 74.5042 0 47.9965Z"
      fill="url(#searchBadgeGradient)"
    />
    <Path
      d="M46.3075 59.8195C53.77 59.8195 59.8196 53.77 59.8196 46.3074C59.8196 38.8449 53.77 32.7953 46.3075 32.7953C38.845 32.7953 32.7954 38.8449 32.7954 46.3074C32.7954 53.77 38.845 59.8195 46.3075 59.8195Z"
      stroke={iconColor}
      strokeWidth={3.37802}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M63.1978 63.1976L55.9351 55.9348" stroke={iconColor} strokeWidth={3.37802} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default SearchBadgeIcon;
