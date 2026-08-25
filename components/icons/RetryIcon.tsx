import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { IconProps } from './types';

const RetryIcon: React.FC<IconProps> = ({ color = '#F0F0F5', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20.375 13.387V11.9902C20.375 7.36219 16.6138 3.60938 11.975 3.60938C10.7131 3.60783 9.46708 3.89093 8.32973 4.43761C7.19238 4.98429 6.19299 5.78047 5.40595 6.76688M3.59985 10.6106V12.0075C3.59985 16.6406 7.35923 20.3906 11.9999 20.3906C13.2582 20.3888 14.5002 20.1063 15.6355 19.5636C16.7708 19.0209 17.7707 18.2318 18.5624 17.2538"
      stroke={color}
      strokeWidth={1.67}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M1.49976 12L3.56226 9.9375L5.71851 12M22.4998 12L20.4373 14.0625L18.281 12"
      stroke={color}
      strokeWidth={1.67}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default RetryIcon;
