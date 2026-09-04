import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { IconProps } from './types';

interface CheckmarkIconProps extends IconProps {
  /** Use 'filled' for the compact filled glyph (address validation, contacts). Defaults to the stroked style. */
  variant?: 'stroke' | 'filled';
}

const CheckmarkIcon: React.FC<CheckmarkIconProps> = ({ color, size = 24, variant = 'stroke' }) => {
  if (variant === 'filled') {
    return (
      <Svg width={size} height={size} viewBox="-3 -4 16 16" fill="none">
        <Path
          d="M3.30529 5.48438L8.60216 0.1875C8.72716 0.0625001 8.873 0 9.03966 0C9.20633 0 9.35216 0.0625001 9.47716 0.1875C9.60216 0.3125 9.66466 0.461042 9.66466 0.633125C9.66466 0.805208 9.60216 0.953542 9.47716 1.07813L3.74279 6.82812C3.61779 6.95312 3.47196 7.01562 3.30529 7.01562C3.13862 7.01562 2.99279 6.95312 2.86779 6.82812L0.180289 4.14062C0.0552885 4.01562 -0.00471154 3.86729 0.000288461 3.69563C0.00528846 3.52396 0.0704966 3.37542 0.195913 3.25C0.32133 3.12458 0.469872 3.06208 0.641539 3.0625C0.813205 3.06292 0.961538 3.12542 1.08654 3.25L3.30529 5.48438Z"
          fill={color}
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12L10 17L19 8" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

export default CheckmarkIcon;
