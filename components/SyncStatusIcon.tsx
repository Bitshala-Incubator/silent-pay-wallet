import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from './themes';

export const PauseIcon = ({ color = 'white', size = 32 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="22.7139 22.7139 19.8333 19.8333" fill="none">
    <Path
      d="M34.0472 42.5472V22.7139H42.5472V42.5472H34.0472ZM22.7139 42.5472V22.7139H31.2139V42.5472H22.7139ZM36.8805 39.7139H39.7139V25.5472H36.8805V39.7139ZM25.5472 39.7139H28.3805V25.5472H25.5472V39.7139Z"
      fill={color}
    />
  </Svg>
);

export const PlayIcon = ({ color = 'white', size = 32 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Path
      d="M24.5334 16.6667L12.0001 24.5067L10.6667 25.3333V8L24.5334 16.6667ZM22.0001 16.6667L12.0001 10.4V22.9333L22.0001 16.6667Z"
      fill={color}
    />
  </Svg>
);

export type SyncStatusIconType = 'scanning' | 'paused' | 'done' | 'error';

const TICK_PATH =
  'M7.95832 12.625L15.0208 5.5625C15.1875 5.39583 15.3819 5.3125 15.6042 5.3125C15.8264 5.3125 16.0208 5.39583 16.1875 5.5625C16.3542 5.72917 16.4375 5.92722 16.4375 6.15667C16.4375 6.38611 16.3542 6.58389 16.1875 6.75L8.54165 14.4167C8.37499 14.5833 8.18054 14.6667 7.95832 14.6667C7.7361 14.6667 7.54165 14.5833 7.37499 14.4167L3.79165 10.8333C3.62499 10.6667 3.54499 10.4689 3.55165 10.24C3.55832 10.0111 3.64527 9.81306 3.81249 9.64583C3.97971 9.47861 4.17777 9.39528 4.40665 9.39583C4.63554 9.39639 4.83332 9.47972 4.99999 9.64583L7.95832 12.625Z';

interface SyncStatusIconProps {
  status: SyncStatusIconType;
  size?: number;
}

const SyncStatusIcon: React.FC<SyncStatusIconProps> = ({ status, size = 66 }) => {
  const { colors } = useTheme();
  // outer = backing circle fill, ring = outer ring + inner disc stroke, fill = inner disc fill, glyph = the symbol
  const iconColors = {
    scanning: { outer: colors.syncOuterScanning, ring: colors.accentSubtle, fill: colors.syncFillScanning, glyph: colors.brandPrimary },
    paused: { outer: colors.syncOuterPaused, ring: colors.syncRingPaused, fill: colors.syncFillPaused, glyph: colors.syncGlyphPaused },
    done: { outer: colors.syncOuterDone, ring: colors.syncRingDone, fill: colors.syncFillDone, glyph: colors.statusSuccess },
    error: { outer: colors.syncOuterError, ring: colors.syncRingError, fill: colors.syncFillError, glyph: colors.errorBannerText },
  };
  const c = iconColors[status];
  return (
    <Svg width={size} height={size} viewBox="0 0 66 66" fill="none">
      {status === 'paused' && (
        <>
          <Circle cx="32.9998" cy="32.9998" r="32.9998" fill={c.outer} />
          <Circle cx="32.9998" cy="32.9998" r="32.4998" stroke={c.ring} />
          <Rect x="53.1099" y="53.1098" width="42" height="42" rx="21" transform="rotate(180 53.1099 53.1098)" fill={c.fill} />
          <Rect x="52.6099" y="52.6098" width="41" height="41" rx="20.5" transform="rotate(180 52.6099 52.6098)" stroke={c.ring} />
          <Path
            d="M33.5267 42.0264V22.1931H42.0267V42.0264H33.5267ZM22.1934 42.0264V22.1931H30.6934V42.0264H22.1934ZM36.36 39.1931H39.1934V25.0264H36.36V39.1931ZM25.0267 39.1931H27.86V25.0264H25.0267V39.1931Z"
            fill={c.glyph}
          />
        </>
      )}

      {status === 'done' && (
        <>
          <Circle cx="32.9998" cy="32.9998" r="32.2464" fill={c.outer} stroke={c.ring} strokeWidth="1.50691" />
          <Rect
            x="54.3393"
            y="54.3392"
            width="42.4759"
            height="42.4759"
            rx="21.238"
            transform="rotate(180 54.3393 54.3392)"
            fill={c.fill}
          />
          <Rect
            x="54.3393"
            y="54.3392"
            width="42.4759"
            height="42.4759"
            rx="21.238"
            transform="rotate(180 54.3393 54.3392)"
            stroke={c.ring}
            strokeWidth="1.50691"
          />
          <Path d={TICK_PATH} fill={c.glyph} transform="matrix(1.85 0 0 1.85 14.5 14.5)" />
        </>
      )}

      {status === 'scanning' && (
        <>
          <Circle cx="32.9998" cy="32.9998" r="32.2464" fill={c.outer} stroke={c.ring} strokeWidth="1.50691" />
          <Rect
            x="54.8503"
            y="54.8502"
            width="42.9869"
            height="42.9869"
            rx="21.4935"
            transform="rotate(180 54.8503 54.8502)"
            fill={c.fill}
          />
          <Rect
            x="54.8503"
            y="54.8502"
            width="42.9869"
            height="42.9869"
            rx="21.4935"
            transform="rotate(180 54.8503 54.8502)"
            stroke={c.ring}
            strokeWidth="1.50691"
          />
          <Path
            d="M45.728 35.4056V33.3422C45.728 26.5058 40.1719 20.9622 33.3196 20.9622C31.4556 20.9599 29.615 21.3781 27.9349 22.1857C26.2548 22.9932 24.7785 24.1693 23.6159 25.6264M20.948 31.3044V33.3678C20.948 40.2118 26.5013 45.7512 33.3563 45.7512C35.2151 45.7485 37.0498 45.3311 38.7268 44.5295C40.4039 43.7279 41.8809 42.5622 43.0503 41.1175"
            stroke={c.glyph}
            strokeWidth="2.21577"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M17.8459 33.3567L20.8926 30.3101L24.0778 33.3567M48.8668 33.3567L45.8201 36.4034L42.6349 33.3567"
            stroke={c.glyph}
            strokeWidth="2.21577"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {status === 'error' && (
        <>
          <Circle cx="32.9998" cy="32.9998" r="32.2464" fill={c.outer} stroke={c.ring} strokeWidth="1.50691" />
          <Rect
            x="53.3979"
            y="53.3978"
            width="41.5345"
            height="41.5345"
            rx="20.7673"
            transform="rotate(180 53.3979 53.3978)"
            fill={c.fill}
          />
          <Rect
            x="53.3979"
            y="53.3978"
            width="41.5345"
            height="41.5345"
            rx="20.7673"
            transform="rotate(180 53.3979 53.3978)"
            stroke={c.ring}
            strokeWidth="1.50691"
          />
          <Path
            d="M32.6308 41.4816C37.5191 41.4816 41.4818 37.5188 41.4818 32.6306C41.4818 27.7423 37.5191 23.7795 32.6308 23.7795C27.7425 23.7795 23.7798 27.7423 23.7798 32.6306C23.7798 37.5188 27.7425 41.4816 32.6308 41.4816Z"
            stroke={c.glyph}
            strokeWidth="1.66607"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M32.6306 36.1709V32.6305" stroke={c.glyph} strokeWidth="1.66607" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M32.6306 29.0901H32.6389" stroke={c.glyph} strokeWidth="1.66607" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </Svg>
  );
};

export default SyncStatusIcon;
