import React from 'react';
import Svg, { Rect, Mask, Defs } from 'react-native-svg';

interface ScanIconProps {
  color?: string;
  width?: number;
  height?: number;
}

const ScanIcon: React.FC<ScanIconProps> = ({ 
  color = 'white', 
  width = 40, 
  height = 36 
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 31 30" fill="none">
      <Defs>
        <Mask id="path-14-inside-1_5568_10466" fill="white">
          <Rect x="6.5" y="6" width="6" height="6" rx="1"/>
        </Mask>
        <Mask id="path-15-inside-2_5568_10466" fill="white">
          <Rect x="6.5" y="18" width="6" height="6" rx="1"/>
        </Mask>
        <Mask id="path-16-inside-3_5568_10466" fill="white">
          <Rect x="18.5" y="6" width="6" height="6" rx="1"/>
        </Mask>
      </Defs>
      
      <Rect x="15" y="14.5" width="1" height="1" fill={color} stroke={color}/>
      <Rect x="15" y="10.5" width="1" height="1" fill={color} stroke={color}/>
      <Rect x="11" y="14.5" width="1" height="1" fill={color} stroke={color}/>
      <Rect x="7" y="14.5" width="1" height="1" fill={color} stroke={color}/>
      <Rect x="15" y="6.5" width="1" height="1" fill={color} stroke={color}/>
      <Rect x="15" y="18.5" width="1" height="1" fill={color} stroke={color}/>
      <Rect x="15" y="22.5" width="1" height="1" fill={color} stroke={color}/>
      <Rect x="19" y="14.5" width="1" height="1" fill={color} stroke={color}/>
      <Rect x="19" y="18.5" width="1" height="1" fill={color} stroke={color}/>
      <Rect x="19" y="22.5" width="1" height="1" fill={color} stroke={color}/>
      <Rect x="23" y="14.5" width="1" height="1" fill={color} stroke={color}/>
      <Rect x="23" y="18.5" width="1" height="1" fill={color} stroke={color}/>
      <Rect x="23" y="22.5" width="1" height="1" fill={color} stroke={color}/>
      
      <Rect 
        x="6.5" 
        y="6" 
        width="6" 
        height="6" 
        rx="1" 
        stroke={color} 
        strokeWidth="4" 
        mask="url(#path-14-inside-1_5568_10466)"
      />
      <Rect 
        x="6.5" 
        y="18" 
        width="6" 
        height="6" 
        rx="1" 
        stroke={color} 
        strokeWidth="4" 
        mask="url(#path-15-inside-2_5568_10466)"
      />
      <Rect 
        x="18.5" 
        y="6" 
        width="6" 
        height="6" 
        rx="1" 
        stroke={color} 
        strokeWidth="4" 
        mask="url(#path-16-inside-3_5568_10466)"
      />
    </Svg>
  );
};

export default ScanIcon;
