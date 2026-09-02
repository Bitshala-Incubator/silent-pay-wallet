import React from 'react';
import Svg, { Rect } from 'react-native-svg';
import { IconProps } from './types';

const CheckboxUncheckedIcon: React.FC<IconProps> = ({ size = 22, color }) => (
  <Svg width={size} height={(size * 23) / 22} viewBox="0 0 22 23" fill="none">
    <Rect x={1} y={2} width={20} height={20} rx={5} fill="none" stroke={color} strokeWidth={2} />
  </Svg>
);

export default CheckboxUncheckedIcon;
