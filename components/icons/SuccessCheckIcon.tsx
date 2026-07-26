import React from 'react';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Filter,
  FeFlood,
  FeColorMatrix,
  FeMorphology,
  FeOffset,
  FeGaussianBlur,
  FeComposite,
  FeBlend,
} from 'react-native-svg';

interface SuccessCheckIconProps {
  size?: number;
  gradientStart?: string;
  gradientEnd?: string;
  checkColor?: string;
}

const SuccessCheckIcon: React.FC<SuccessCheckIconProps> = ({
  size = 120,
  gradientStart = '#DCFCE7',
  gradientEnd = '#D0FAE5',
  checkColor = '#00A63E',
}) => (
  <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
    <Defs>
      <LinearGradient id="successCheckGradient" x1="12" y1="2" x2="107.993" y2="97.9929" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={gradientStart} />
        <Stop offset="1" stopColor={gradientEnd} />
      </LinearGradient>
      <Filter id="successCheckShadow" x="0" y="0" width="119.993" height="119.993" filterUnits="userSpaceOnUse">
        <FeFlood floodOpacity={0} result="BackgroundImageFix" />
        <FeColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
        <FeMorphology radius={4} operator="erode" in="SourceAlpha" result="effect1_dropShadow" />
        <FeOffset dy={4} />
        <FeGaussianBlur stdDeviation={3} />
        <FeComposite in2="hardAlpha" operator="out" />
        <FeColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0.788235 0 0 0 0 0.313726 0 0 0 0.2 0" />
        <FeBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
        <FeColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
        <FeMorphology radius={3} operator="erode" in="SourceAlpha" result="effect2_dropShadow" />
        <FeOffset dy={10} />
        <FeGaussianBlur stdDeviation={7.5} />
        <FeComposite in2="hardAlpha" operator="out" />
        <FeColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0.788235 0 0 0 0 0.313726 0 0 0 0.2 0" />
        <FeBlend mode="normal" in2="effect1_dropShadow" result="effect2_dropShadow" />
        <FeBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow" result="shape" />
      </Filter>
    </Defs>
    <Path
      d="M12 49.9965C12 23.4887 33.4887 2 59.9965 2C86.5042 2 107.993 23.4887 107.993 49.9965C107.993 76.5042 86.5042 97.9929 59.9965 97.9929C33.4887 97.9929 12 76.5042 12 49.9965Z"
      fill="url(#successCheckGradient)"
      filter="url(#successCheckShadow)"
    />
    <Path
      d="M71.3471 41.4834L55.7398 57.0907L48.6455 49.9965"
      stroke={checkColor}
      strokeWidth={4.25655}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default SuccessCheckIcon;
