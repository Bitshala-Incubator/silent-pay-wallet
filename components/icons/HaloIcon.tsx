import React from 'react';
import Svg, { Path } from 'react-native-svg';

const HALO =
  'M45.5771 0.5C70.4727 0.5 90.655 20.6817 90.6553 45.5771C90.6553 70.4728 70.4728 90.6553 45.5771 90.6553C20.6817 90.655 0.5 70.4727 0.5 45.5771C0.500252 20.6818 20.6818 0.500252 45.5771 0.5Z';
const BADGE =
  'M59.8193 76.9106C59.8193 67.4713 67.4713 59.8193 76.9106 59.8193C86.3498 59.8193 94.0018 67.4713 94.0018 76.9106C94.0018 86.3498 86.3498 94.0018 76.9106 94.0018C67.4713 94.0018 59.8193 86.3498 59.8193 76.9106Z';

export interface HaloIconProps {
  size?: number;
  background?: string;
  borderColor?: string;
  accent?: string;
}

interface Props extends HaloIconProps {
  /** The glyph, drawn in the 94x94 halo's coordinate space. */
  children: React.ReactNode;
  /** The download badge in the lower right. Only for medallions that mean "receive". */
  badge?: boolean;
}

/**
 * The 94pt empty-state medallion: tinted disc and hairline ring, with the glyph as its only child.
 * The receive badge is opt-in, so an empty state that has nothing to do with receiving does not
 * inherit a download chevron.
 */
const HaloIcon: React.FC<Props> = ({
  size = 94,
  background = '#FAF5FF',
  borderColor = '#F3E8FF',
  accent = '#754CE8',
  badge = false,
  children,
}) => (
  <Svg width={size} height={size} viewBox="0 0 94 94" fill="none">
    <Path d={HALO} fill={background} />
    <Path d={HALO} stroke={borderColor} />
    {children}
    {badge && (
      <>
        <Path d={BADGE} fill={accent} />
        <Path d="M76.9111 71.9257V81.8955" stroke="white" strokeWidth={1.42427} strokeLinecap="round" strokeLinejoin="round" />
        <Path
          d="M81.8957 76.9106L76.9107 81.8956L71.9258 76.9106"
          stroke="white"
          strokeWidth={1.42427}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    )}
  </Svg>
);

export default HaloIcon;
