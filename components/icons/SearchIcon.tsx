import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface SearchIconProps {
  size?: number;
  /** Draws the glyph on a filled 48pt circle, as the track-payment banner does. Omit for a bare icon. */
  background?: string;
  stroke?: string;
}

const Glyph: React.FC<{ stroke: string }> = ({ stroke }) => (
  <>
    <Path
      d="M23.1609 29.8295C26.8415 29.8295 29.8252 26.8457 29.8252 23.1652C29.8252 19.4846 26.8415 16.5009 23.1609 16.5009C19.4803 16.5009 16.4966 19.4846 16.4966 23.1652C16.4966 26.8457 19.4803 29.8295 23.1609 29.8295Z"
      stroke={stroke}
      strokeWidth={1.66607}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M31.4912 31.4955L27.9092 27.9135" stroke={stroke} strokeWidth={1.66607} strokeLinecap="round" strokeLinejoin="round" />
  </>
);

const SearchIcon: React.FC<SearchIconProps> = ({ size = 20, background, stroke = '#754CE8' }) =>
  background ? (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Rect width="47.9965" height="47.9965" rx="23.9982" fill={background} />
      <Glyph stroke={stroke} />
    </Svg>
  ) : (
    // Artwork is authored on the 48pt canvas above. Cropping to the 20pt box the design
    // specs the icon at puts it at 1:1, so the strokes land at their native 1.66607 width.
    <Svg width={size} height={size} viewBox="14 14 20 20" fill="none">
      <Glyph stroke={stroke} />
    </Svg>
  );

export default SearchIcon;
