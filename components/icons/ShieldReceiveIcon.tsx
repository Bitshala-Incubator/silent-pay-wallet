import React from 'react';
import { Path } from 'react-native-svg';

import HaloIcon, { HaloIconProps } from './HaloIcon';

const ShieldReceiveIcon: React.FC<HaloIconProps> = props => (
  <HaloIcon {...props} badge>
    <Path
      d="M60.7693 47.4765C60.7693 56.9712 54.123 61.7186 46.2234 64.4721C45.8098 64.6122 45.3604 64.6055 44.9511 64.4531C37.0325 61.7186 30.3862 56.9712 30.3862 47.4765V34.1839C30.3862 33.6803 30.5863 33.1973 30.9424 32.8412C31.2985 32.485 31.7815 32.285 32.2852 32.285C36.0831 32.285 40.8304 30.0062 44.1346 27.1198C44.5369 26.7761 45.0486 26.5873 45.5778 26.5873C46.1069 26.5873 46.6187 26.7761 47.021 27.1198C50.3441 30.0252 55.0725 32.285 58.8704 32.285C59.374 32.285 59.857 32.485 60.2131 32.8412C60.5693 33.1973 60.7693 33.6803 60.7693 34.1839V47.4765Z"
      stroke={props.accent ?? '#754CE8'}
      strokeWidth="3.79789"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </HaloIcon>
);

export default ShieldReceiveIcon;
