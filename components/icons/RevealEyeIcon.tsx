import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { IconProps } from './types';

const RevealEyeIcon: React.FC<IconProps> = ({ size = 24, color = 'white' }) => (
  <Svg width={size} height={size} viewBox="0 0 52 52" fill="none">
    <Path
      d="M15.916 25.9998C15.916 25.9998 19.5827 18.6665 25.9993 18.6665C32.416 18.6665 36.0827 25.9998 36.0827 25.9998C36.0827 25.9998 32.416 33.3332 25.9993 33.3332C19.5827 33.3332 15.916 25.9998 15.916 25.9998Z"
      stroke={color}
      strokeWidth={1.83333}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M26 28.75C27.5188 28.75 28.75 27.5188 28.75 26C28.75 24.4812 27.5188 23.25 26 23.25C24.4812 23.25 23.25 24.4812 23.25 26C23.25 27.5188 24.4812 28.75 26 28.75Z"
      stroke={color}
      strokeWidth={1.83333}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default RevealEyeIcon;
