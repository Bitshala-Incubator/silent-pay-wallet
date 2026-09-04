import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { IconProps } from './types';

const CloseIcon: React.FC<IconProps> = ({ color, size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5.42 5.42L18.58 18.58M18.58 5.42L5.42 18.58" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default CloseIcon;
