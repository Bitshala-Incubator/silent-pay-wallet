import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface InfoBadgeIconProps {
  size?: number;
  background?: string;
  glyphColor?: string;
}

const InfoBadgeIcon: React.FC<InfoBadgeIconProps> = ({ size = 28, background = '#DBEAFE', glyphColor = '#155DFC' }) => (
  <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <Path
      d="M0 13.8339C0 6.19367 6.19367 0 13.8339 0C21.4742 0 27.6679 6.19367 27.6679 13.8339C27.6679 21.4742 21.4742 27.6679 13.8339 27.6679C6.19367 27.6679 0 21.4742 0 13.8339Z"
      fill={background}
    />
    <Path
      d="M13.8314 19.8257C17.0142 19.8257 19.5943 17.2456 19.5943 14.0628C19.5943 10.88 17.0142 8.29987 13.8314 8.29987C10.6486 8.29987 8.06848 10.88 8.06848 14.0628C8.06848 17.2456 10.6486 19.8257 13.8314 19.8257Z"
      stroke={glyphColor}
      strokeWidth={1.15258}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M13.8314 11.7576V14.0628" stroke={glyphColor} strokeWidth={1.15258} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M13.8314 16.368H13.8372" stroke={glyphColor} strokeWidth={1.15258} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default InfoBadgeIcon;
