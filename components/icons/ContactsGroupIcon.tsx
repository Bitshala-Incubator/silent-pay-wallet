import React from 'react';
import { Path } from 'react-native-svg';

import HaloIcon, { HaloIconProps } from './HaloIcon';

// lucide "users-round" glyph (24x24) scaled 1.875x and centered in the 94x94 halo,
// matching the Figma frame's icon inset (8.33%/12.5%) exactly.
const ContactsGroupIcon: React.FC<HaloIconProps> = props => {
  const accent = props.accent ?? '#754CE8';
  return (
    <HaloIcon {...props}>
      <Path d="M58.25 63.875a15 15 0 0 0-30 0" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M52.625 39.5a9.375 9.375 0 1 1-18.75 0 9.375 9.375 0 0 1 18.75 0Z"
        stroke={accent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M65.75 62c0-6.31875-3.75-12.1875-7.5-15a9.375 9.375 0 0 0-.84375-15.5625"
        stroke={accent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </HaloIcon>
  );
};

export default ContactsGroupIcon;
