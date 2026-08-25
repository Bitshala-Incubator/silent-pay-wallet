import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { IconProps } from './types';

const RefreshIcon: React.FC<IconProps> = ({ color = 'white', size = 32 }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Path
      d="M23.875 17.388V15.9911C23.875 11.3632 20.1138 7.61036 15.475 7.61036C14.2131 7.60881 12.9671 7.89191 11.8297 8.43859C10.6924 8.98527 9.69299 9.78145 8.90595 10.7679M7.09985 14.6116V16.0085C7.09985 20.6416 10.8592 24.3916 15.4999 24.3916C16.7582 24.3898 18.0002 24.1072 19.1355 23.5646C20.2708 23.0219 21.2707 22.2328 22.0624 21.2547"
      stroke={color}
      strokeWidth={2.21577}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M4.99976 16.001L7.06226 13.9385L9.21851 16.001M25.9998 16.001L23.9373 18.0635L21.781 16.001"
      stroke={color}
      strokeWidth={2.21577}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default RefreshIcon;
