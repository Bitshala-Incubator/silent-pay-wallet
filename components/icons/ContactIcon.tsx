import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { IconProps } from './types';

const ContactIcon: React.FC<IconProps> = ({ size = 24, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 21C18 18.8783 17.1571 16.8434 15.6569 15.3431C14.1566 13.8429 12.1217 13 10 13C7.87827 13 5.84344 13.8429 4.34315 15.3431C2.84285 16.8434 2 18.8783 2 21"
      stroke={color}
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M10 13C12.7614 13 15 10.7614 15 8C15 5.23858 12.7614 3 10 3C7.23858 3 5 5.23858 5 8C5 10.7614 7.23858 13 10 13Z"
      stroke={color}
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M22.0003 20C22.0003 16.63 20.0003 13.5 18.0003 12C18.6577 11.5067 19.1834 10.859 19.5309 10.1142C19.8783 9.3694 20.0368 8.55042 19.9923 7.72975C19.9478 6.90908 19.7017 6.11204 19.2758 5.40915C18.8498 4.70626 18.2572 4.11921 17.5503 3.69995"
      stroke={color}
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default ContactIcon;
