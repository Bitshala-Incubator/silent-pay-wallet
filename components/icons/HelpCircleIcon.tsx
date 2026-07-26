import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { IconProps } from './types';

const HelpCircleIcon: React.FC<IconProps> = ({ color = '#E17100', size = 20 }) => (
  <Svg width={size} height={size} viewBox="20 18 20 20" fill="none">
    <Path
      d="M30.5313 36.7674C35.132 36.7674 38.8617 33.0378 38.8617 28.4371C38.8617 23.8363 35.132 20.1067 30.5313 20.1067C25.9306 20.1067 22.2009 23.8363 22.2009 28.4371C22.2009 33.0378 25.9306 36.7674 30.5313 36.7674Z"
      stroke={color}
      strokeWidth={1.66607}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M28.1072 25.9379C28.303 25.3812 28.6896 24.9117 29.1984 24.6127C29.7072 24.3136 30.3055 24.2043 30.8872 24.3041C31.4689 24.4039 31.9965 24.7063 32.3766 25.1578C32.7566 25.6093 32.9647 26.1808 32.9638 26.771C32.9638 28.437 30.4647 29.2701 30.4647 29.2701"
      stroke={color}
      strokeWidth={1.66607}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M30.5312 32.6022H30.5396" stroke={color} strokeWidth={1.66607} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default HelpCircleIcon;
