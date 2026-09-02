import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { IconProps } from './types';

const ShowPhraseEyeIcon: React.FC<IconProps> = ({ size = 17, color }) => (
  <Svg width={size} height={size} viewBox="0 0 17 17" fill="none">
    <Path
      d="M0.708984 8.50016C0.708984 8.50016 3.54232 2.8335 8.50065 2.8335C13.459 2.8335 16.2923 8.50016 16.2923 8.50016C16.2923 8.50016 13.459 14.1668 8.50065 14.1668C3.54232 14.1668 0.708984 8.50016 0.708984 8.50016Z"
      stroke={color}
      strokeWidth={1.41667}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M8.5 10.625C9.6736 10.625 10.625 9.6736 10.625 8.5C10.625 7.32639 9.6736 6.375 8.5 6.375C7.32639 6.375 6.375 7.32639 6.375 8.5C6.375 9.6736 7.32639 10.625 8.5 10.625Z"
      stroke={color}
      strokeWidth={1.41667}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default ShowPhraseEyeIcon;
