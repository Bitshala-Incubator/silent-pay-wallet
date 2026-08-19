import React from 'react';
import Svg, { Rect, Path } from 'react-native-svg';

interface ShieldCheckIconProps {
  size?: number;
  background?: string;
  accent?: string;
}

const ShieldCheckIcon: React.FC<ShieldCheckIconProps> = ({ size = 21, background = '#F6F5FD', accent = '#754CE8' }) => (
  <Svg width={size} height={size} viewBox="0 0 21 21" fill="none">
    <Rect width="20.0231" height="20.0231" rx="10.0115" fill={background} />
    <Path
      d="M14.6752 10.5947C14.6752 13.5106 12.6341 14.9685 10.2081 15.8141C10.081 15.8572 9.94303 15.8551 9.81733 15.8083C7.38548 14.9685 5.34436 13.5106 5.34436 10.5947V6.51242C5.34436 6.35775 5.4058 6.20942 5.51517 6.10005C5.62454 5.99068 5.77287 5.92924 5.92754 5.92924C7.09389 5.92924 8.55184 5.22943 9.56657 4.343C9.69012 4.23744 9.84728 4.17944 10.0098 4.17944C10.1723 4.17944 10.3294 4.23744 10.453 4.343C11.4736 5.23526 12.9257 5.92924 14.092 5.92924C14.2467 5.92924 14.395 5.99068 14.5044 6.10005C14.6138 6.20942 14.6752 6.35775 14.6752 6.51242V10.5947Z"
      stroke={accent}
      strokeWidth={1.16636}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M8.26025 10.0116L9.42661 11.1779L11.7593 8.84521"
      stroke={accent}
      strokeWidth={1.16636}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default ShieldCheckIcon;
