import { DarkTheme, DefaultTheme, useTheme as useThemeBase } from '@react-navigation/native';
import { Appearance, ColorSchemeName } from 'react-native';
import { ThemePreference } from './Context/SettingsProvider';

// Primitive palette: raw color values, each declared exactly once.
// The semantic tokens below alias these, so a value change happens in one place
// while every token stays independently themeable. Names describe hue + lightness
// (higher number = darker); they are deliberately not tied to any component.
const palette = {
  white: '#FFFFFF',
  black: '#000000',

  gray50: '#F5F5F7',
  gray100: '#EEF0F4',
  gray150: '#EEEEEE',
  gray200: '#E6E4E4',
  gray250: '#E5E5EA',
  gray300: '#D2D2D2',
  gray325: '#D1D1D6',
  gray350: '#D1D5DC',
  gray400: '#9AA0AA',
  gray450: '#99A1AF',
  gray480: '#8E8E93',
  gray500: '#81868E',
  gray600: '#787878',
  gray700: '#545454',
  gray800: '#3A3A3C',
  gray850: '#313030',
  gray900: '#202020',
  gray925: '#1C1C1E',
  gray950: '#0D0D0D',
  maroon900: '#5A4E4E',

  violet50: '#F6F5FD',
  violet100: '#E6E2FA',
  violet200: '#D0C0FAFF',
  violet500: '#8763EB',
  violet600: '#754CE8',
  violet850: '#473F71',
  violet900: '#1D1A2B',
  violet500Alpha: '#8763EB8F',
  indigo500: '#5856D6',

  blue500: '#0A84FF',
  teal500: '#37C0A1',
  green500: '#00A63E',
  orange400: '#F38C47',
  pink200: '#F8D2D2',
  red600: '#D0021B',
};

// Semantic color tokens. Each token declares BOTH schemes, so a token can never
// silently inherit its light value in dark mode — the type requires both.
//   pair(l, d)   different value per scheme
//   same(v)      deliberately identical in both
//   lightOnly(v) only a light value exists yet; dark is a TODO (todoDark), tracked for #3
type ColorToken = { light: string; dark: string; todoDark?: true };
const pair = (light: string, dark: string): ColorToken => ({ light, dark });
const same = (v: string): ColorToken => ({ light: v, dark: v });
const lightOnly = (v: string): ColorToken => ({ light: v, dark: v, todoDark: true });

const tokens = {
  brandingColor: pair(palette.white, palette.black),
  foregroundColor: pair('#0C2550', palette.white),
  secondButtonTextColor: same('#50555C'),
  buttonDisabledBackgroundColor: pair(palette.gray100, palette.gray800),
  inputBorderColor: same(palette.gray300),
  inputBackgroundColor: pair('#F5F5F5', '#262626'),
  alternativeTextColor: same(palette.gray400),
  alternativeTextColor2: pair(palette.violet600, palette.blue500),
  accentColor: same(palette.indigo500),
  toggleTrackOff: same(palette.gray350),
  buttonGrayBackgroundColor: same(palette.gray150),
  incomingBackgroundColor: same('#D2F8D6'),
  successColor: same(palette.teal500),
  warningColor: same('#F5A623'),
  placeholderTextColor: same(palette.gray500),
  hdborderColor: same('#68BBE1'),
  background: pair(palette.white, palette.gray950),
  lightButton: pair(palette.gray100, 'rgba(255,255,255,.1)'),
  lightBorder: pair('#EDEDED', palette.gray850),
  ballOutgoingExpired: pair('#ECF1F7', palette.gray900),
  modal: pair(palette.white, palette.gray900),
  formBorder: pair(palette.gray300, palette.gray900),
  darkGray: pair(palette.gray400, palette.gray800),
  scanLabel: pair(palette.gray400, 'rgba(255,255,255,.2)'),
  feeLabel: same(palette.violet200),
  labelText: pair(palette.gray500, palette.white),
  success: pair(palette.violet600, palette.gray900),
  successCheck: same(palette.green500),
  redBG: pair(palette.pink200, palette.maroon900),
  redText: pair(palette.red600, '#FC6D6D'),
  changeBackground: pair('#FDF2DA', palette.maroon900),
  changeText: same(palette.orange400),
  receiveBackground: pair('#D1F9D6', 'rgba(210,248,214,.2)'),
  navigationBarColor: pair(palette.white, palette.gray800),
  androidRippleColor: pair('#CCCCCC', '#444444'),
  backButtonIcon: pair(palette.black, palette.gray700),
  // Brand violet in both modes, matching master #123. Also the canonical token for the former
  // buttonBackgroundColor / mainColor / feeValue, which were identical in both schemes.
  primary: same(palette.violet600),

  // --- Revamp design tokens (Sync/scan UI) ---
  // Dedicated keys (not the React Navigation reserved primary/text/border) so DarkTheme can't recolor them.
  // Tokens using same() are intentionally identical in dark.
  brandPrimary: pair(palette.violet600, palette.violet500),
  statusPaused: same('#9792A6'),
  statusSuccess: pair('#55B685', '#66C799'),
  statusError: same(palette.red600),
  surfaceSubtle: pair(palette.violet50, palette.violet900), // banner / card background
  accentSubtle: pair(palette.violet100, '#2D264F'), // banner & card border, "check again" button bg, scanning icon ring
  checkAgainButtonColor: pair(palette.violet600, palette.white), // "check again" button icon + text
  progressCardBackground: pair(palette.violet50, '#1A1535'), // sync screen "Update Progress" / privacy card background
  progressCardBorder: pair(palette.violet100, '#25253A'), // sync screen "Update Progress" / privacy card border
  pausedIconColor: pair('#1A1A1A', '#F0F0F5'), // paused-state pause icon on the sync banner
  surfaceCaution: same('#FDFBF5'), // caution banner background (address-reuse warning)
  iconCaution: same('#F1AF63'), // caution banner icon (warm amber)
  errorBannerText: pair('#B24334', '#C54A3A'), // "can't connect" sync status icon glyph
  segmentTrack: same('#F8F8FA'), // pill toggle track background
  segmentSelectedBorder: same('#CFCFCF'), // selected pill border
  qrCardBg: same('#F9FAFB'), // QR code card background
  copyHint: same(palette.gray450), // "tap to copy" icon + label
  progressTrack: pair('#EAECF0', '#1A1535'),
  buttonBorder: same('#EBEBEB'),
  continueButtonBorder: pair('#EBEBEB', '#6B5CE7'), // brand-strong border shared by the "pause" and "continue" sync action buttons
  retryButtonBorder: pair('#EBEBEB', '#212121'), // retry button border ("can't connect" action button)
  textPrimary: pair('#1A1A1A', palette.white), // titles, primary copy
  textSecondary: same('#8E8E93'), // subtitles, privacy copy
  textMeta: same('#92929B'), // ETA / "%" meta text
  syncEtaIconColor: same('#C7C7CC'), // ETA clock icon on sync screen
  syncPercentColor: pair(palette.black, '#F0F0F5'), // sync screen percent-complete number
  syncPercentSignColor: pair('#92929B', '#8888AA'), // sync screen "%" sign next to the number
  textMuted: same('#7B7A7E'), // card row labels
  chevron: same('#C7C7CC'), // disclosure chevron
  white: same(palette.white),
  black: same(palette.black), // large emphasis numerals
  // SyncStatusIcon per-status ring/fill tints (glyph color = brandPrimary / status* above)
  syncOuterScanning: pair(palette.white, '#0D0D0D'), // scanning-state icon backing circle
  syncFillScanning: pair('#DCD2F9', '#3A3166'),
  syncRingPaused: pair('#E6E4E499', '#FFFFFF14'), // alpha baked in: 0.6 opacity light, 0.08 opacity dark
  syncFillPaused: pair('#F5F5F7', '#1A1A28'),
  syncOuterPaused: pair(palette.white, '#0E0E16'), // paused-state icon backing circle
  syncGlyphPaused: pair('#8E8E93', '#8888AA'), // paused-state pause glyph
  syncOuterDone: pair(palette.white, '#0D0D0D'), // done-state icon backing circle
  syncRingDone: pair('#E2FAEA', '#16301F'),
  syncFillDone: pair('#D2F9DC', '#1C3D28'),
  syncRingError: pair('#FDF1F2', '#330C09'),
  syncFillError: pair('#FBE9EB', '#3E0B0B'),
  syncOuterError: pair(palette.white, '#0D0D0D'), // error-state icon backing circle
  // Legacy / existing tokens (keep for compatibility)
  receiveBtnBackground: pair('#EAE4FB', '#110732'),
  bannerBackground: pair(palette.violet50, palette.violet900),
  payBtnDisabledBackground: pair('#00000052', '#FFFFFF52'),
  requestBtnBorderColor: pair(palette.violet600, palette.violet500Alpha),
  bannerBorderColor: pair(palette.violet100, '#2D264F'),
  scanBtnBorderColor: pair(palette.violet100, '#241F3B'),
  settingsBtnBackground: pair('#F6F7F9', '#141414'),
  settingsBtnIconColor: pair(palette.gray700, '#AAAAAA'),
  searchIconBackground: pair(palette.white, '#0D0D0D'),
  shieldIconBackground: pair('#FAF5FF', palette.violet900),
  shieldIconBorder: pair('#F3E8FF', '#181818'),
  shareAddrBorderColor: pair(palette.violet100, palette.violet500Alpha),
  shareAddrBackground: pair('transparent', palette.violet900),
  cardBackground: pair('#FDFCFE', '#1A1A1A'),

  // --- Send redesign tokens. Ones using lightOnly() still need real dark values (see todoDark, #3). ---
  fieldBackground: pair(palette.gray50, '#1E1E1E'), // Address / Note field background
  amountMeta: pair('#9B9BA5', '#AEAEB2'), // BTC unit, fiat estimate, slow/medium ETA
  amountPlaceholder: lightOnly('rgba(0,0,0,0.32)'), // AmountHero empty/placeholder digits
  scrim: lightOnly('rgba(10, 13, 19, 0.8)'), // Success bottom-sheet backdrop
  ctaDisabled: lightOnly(palette.gray450), // disabled primary button background
  feeCardBorder: lightOnly('#E6E6E8'), // unselected fee card border
  feeCardSelectedBorder: lightOnly('#B9BAF9'), // selected fee card border
  useMaxBorder: lightOnly('#E8E4FA'), // "Use Max" pill border
  useMaxText: lightOnly('#6E55E0'), // "Use Max" pill text
  copyButtonBorder: pair(palette.gray200, palette.gray800), // Confirm copy-button border
  divider: pair(palette.gray200, palette.gray850), // Confirm section dividers
  summaryBorder: pair(palette.gray200, palette.gray850), // SendDetails fee summary card border
  transactionCardBorder: pair(palette.gray200, palette.gray850),
  txIconHaloBorder: pair(palette.violet100, palette.violet850),
  incomingIconBackground: pair('#E7E6F5', '#322361'),
  outgoingIconBackground: pair(palette.gray50, '#161616'),
  outgoingIconBorder: pair('#D9D9D9', palette.violet850),

  // --- Settings screen tokens ---
  settingsCardBorder: pair('#F0F0F0', '#2C2C2E'),
  settingsCardBackground: pair('#F9F9FB', '#1C1C1E'),
  settingsRowTitle: pair('#101828', palette.white),
  settingsDescriptionText: pair('#3C3C43', palette.white),
  settingsDenominationIconColor: same(palette.gray600),
  // Fixed swatch colors for the Theme screen's Light/Dark preview cards — these must render
  // as literal light/dark regardless of the app's active theme, so they're same() not pair().
  themePreviewLightBg: same(palette.white),
  themePreviewBorderInactive: same(palette.gray250),
  themePreviewDarkBg: same(palette.gray925),
  themePreviewBarLight: same(palette.gray325),
  themePreviewBarDark: same(palette.gray800),
  themePreviewLabelInactive: same(palette.gray480),
  settingsDeleteWallet: pair('#E53935', '#FF453A'),
  settingsIconWrapperBg: pair(palette.white, '#2C2C2E'),
  settingsRipple: pair('rgba(0,0,0,0.06)', 'rgba(255,255,255,0.06)'),
  settingsAboutIconColor: same('#E7000B'),
  settingsGeneralIconColor: same('#3B80F9'),
  settingsToolsIconColor: same('#3B80F9'),
  settingsSecurityIconColor: same('#FF3B30'),
  settingsContactIconColor: same('#6366F1'),
  settingsNetworkIconColor: same('#00A63E'),
  settingsCurrencyIconColor: same('#F7931A'),
} satisfies Record<string, ColorToken>;

type Scheme = 'light' | 'dark';
const buildColors = (scheme: Scheme): Record<keyof typeof tokens, string> => {
  const out = {} as Record<keyof typeof tokens, string>;
  (Object.keys(tokens) as (keyof typeof tokens)[]).forEach(key => {
    out[key] = tokens[key][scheme];
  });
  return out;
};

export const ShroudDefaultTheme = {
  ...DefaultTheme,
  closeImage: require('../img/close.png'),
  barStyle: 'dark-content',
  colors: {
    ...DefaultTheme.colors,
    ...buildColors('light'),
  },
};

export type Theme = typeof ShroudDefaultTheme;

// Dark spreads the RN base + RN dark reserved keys first, then our dark values on top,
// exactly reproducing the previous inheritance order (e.g. `primary` stays RN's dark blue).
export const ShroudDarkTheme: Theme = {
  ...DarkTheme,
  closeImage: require('../img/close-white.png'),
  barStyle: 'light-content',
  colors: {
    ...DefaultTheme.colors,
    ...DarkTheme.colors,
    ...buildColors('dark'),
  },
};

// Casting theme value to get autocompletion
export const useTheme = (): Theme => useThemeBase() as Theme;

export const getEffectiveTheme = (themePreference: ThemePreference, colorScheme: ColorSchemeName): Theme => {
  const effectiveScheme = themePreference === 'system' ? colorScheme : themePreference;
  return effectiveScheme === 'dark' ? ShroudDarkTheme : ShroudDefaultTheme;
};

export class BlueCurrentTheme {
  static colors: Theme['colors'];
  static closeImage: Theme['closeImage'];

  static updateColorScheme(): void {
    const isColorSchemeDark = Appearance.getColorScheme() === 'dark';
    BlueCurrentTheme.colors = isColorSchemeDark ? ShroudDarkTheme.colors : ShroudDefaultTheme.colors;
    BlueCurrentTheme.closeImage = isColorSchemeDark ? ShroudDarkTheme.closeImage : ShroudDefaultTheme.closeImage;
  }
}

BlueCurrentTheme.updateColorScheme();

// Keep the static snapshot in sync when the OS appearance changes at runtime.
// Without this, BlueCurrentTheme.colors is frozen at import and consumers that
// read it go stale after a light/dark toggle. Consumers must read the value at
// render time (not bake it into a module-level StyleSheet) to observe the update.
Appearance.addChangeListener(() => BlueCurrentTheme.updateColorScheme());
