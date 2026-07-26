import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { IconProps } from './types';

const ClipboardIcon: React.FC<IconProps> = ({ color = '#754CE8', size = 14 }) => (
  <Svg width={size} height={size} viewBox="12 9 14 14" fill="none">
    <Path
      d="M24.3233 14H18.3233C17.5869 14 16.99 14.597 16.99 15.3333V21.3333C16.99 22.0697 17.5869 22.6667 18.3233 22.6667H24.3233C25.0597 22.6667 25.6567 22.0697 25.6567 21.3333V15.3333C25.6567 14.597 25.0597 14 24.3233 14Z"
      stroke={color}
      strokeWidth={1.33333}
    />
    <Path
      d="M14.3234 18.0007H13.6567C13.3031 18.0007 12.9639 17.8602 12.7139 17.6101C12.4638 17.3601 12.3234 17.0209 12.3234 16.6673V10.6673C12.3234 10.3137 12.4638 9.97456 12.7139 9.72451C12.9639 9.47446 13.3031 9.33398 13.6567 9.33398H19.6567C20.0103 9.33398 20.3495 9.47446 20.5995 9.72451C20.8496 9.97456 20.99 10.3137 20.99 10.6673V11.334"
      stroke={color}
      strokeWidth={1.33333}
    />
  </Svg>
);

export default ClipboardIcon;
