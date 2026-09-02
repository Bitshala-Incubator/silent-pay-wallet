import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { IconProps } from './types';

const CheckboxCheckedIcon: React.FC<IconProps> = ({ size = 22, color }) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path
      d="M0 6C0 2.68629 2.68629 0 6 0H16C19.3137 0 22 2.68629 22 6V16C22 19.3137 19.3137 22 16 22H6C2.68629 22 0 19.3137 0 16V6Z"
      fill={color}
    />
    <Path d="M15.3327 7.75L9.37435 13.7083L6.66602 11" stroke="white" strokeWidth={1.35417} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default CheckboxCheckedIcon;
