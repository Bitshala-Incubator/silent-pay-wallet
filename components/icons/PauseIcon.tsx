import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { IconProps } from './types';

const PauseIcon: React.FC<IconProps> = ({ color = '#1A1A1A', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <Path
      d="M10.8334 15.8333V4.16663H15.8334V15.8333H10.8334ZM4.16675 15.8333V4.16663H9.16675V15.8333H4.16675ZM12.5001 14.1666H14.1667V5.83329H12.5001V14.1666ZM5.83341 14.1666H7.50008V5.83329H5.83341V14.1666Z"
      fill={color}
    />
  </Svg>
);

export default PauseIcon;
