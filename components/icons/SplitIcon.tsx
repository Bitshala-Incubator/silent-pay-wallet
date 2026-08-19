import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { IconProps } from './types';

const SplitIcon: React.FC<IconProps> = ({ color = '#754CE8', size = 19 }) => (
  <Svg width={(size * 15) / 17} height={size} viewBox="0 0 15 17" fill="none">
    <Path
      d="M3.06121 1.88953L4.95075 0H0V4.95075L1.88953 3.06121L6.601 7.77267V16.5107H8.25124V7.77267C8.25124 7.33536 8.07797 6.91454 7.76442 6.60925L3.05296 1.89779L3.06121 1.88953ZM11.791 1.88953L8.49053 5.19003L9.66221 6.36171L12.9627 3.06121L14.8522 4.95075V0.0412562L9.90149 0L11.791 1.88953Z"
      fill={color}
    />
  </Svg>
);

export default SplitIcon;
