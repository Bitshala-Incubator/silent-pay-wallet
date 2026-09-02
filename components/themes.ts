import { DarkTheme, DefaultTheme, useTheme as useThemeBase } from '@react-navigation/native';
import { Appearance, ColorSchemeName } from 'react-native';
import { ThemePreference } from './Context/SettingsProvider';

// Primitive palette: raw color values, each declared exactly once.
// The semantic tokens below alias these, so a value change happens in one place
// while every token stays independently themeable. Names describe hue + lightness
// (higher number = darker); they are deliberately not tied to any component.
const palette = {
  white: '#FFFFFF',
  whiteAlpha08: '#FFFFFF14',
  black: '#000000',

  gray50: '#F5F5F7',
  gray75: '#F0F0F5',
  gray100: '#EEF0F4',
  gray150: '#EEEEEE',
  gray200: '#E6E4E4',
  gray250: '#E5E5EA',
  gray300: '#D2D2D2',
  gray325: '#D1D1D6',
  gray350: '#D1D5DC',
  gray375: '#C7C7CC',
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
  maroon900: '#5A4E4E',
  brown900: '#2E2518',

  // Blue-violet tinted neutrals used by the dark scheme (distinct from the pure grays above).
  slate400: '#8888AA',
  slate880: '#25253A',
  slate890: '#1A1A28',
  slate950: '#0E0E16',

  violet50: '#F6F5FD',
  violet100: '#E6E2FA',
  violet150: '#DCD2F9',
  violet150Alpha: '#DCD2F999',
  violet200: '#D0C0FAFF',
  violet500: '#8763EB',
  violet600: '#754CE8',
  violet600Alpha: '#754CE866',
  violet850: '#473F71',
  violet900: '#1D1A2B',
  violet920: '#1A1535',
  violet500Alpha: '#8763EB8F',
  indigo500: '#5856D6',

  blue500: '#0A84FF',
  teal500: '#37C0A1',
  green400: '#66C799',
  green500: '#00A63E',
  green900: '#1A2E22',
  orange400: '#F38C47',
  pink200: '#F8D2D2',
  red500: '#EF4444',
  red550: '#B24334',
  red600: '#D0021B',
  red950: '#2E1A1A',
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

// React Navigation's reserved `card` key paints the native header; without it dark headers keep
// RN's own #121212 and read as a lighter strip above the #0E0E16 screen. It has to track
// `background` exactly, so both keys share one token rather than repeating the pair().
const background = pair(palette.white, palette.slate950);

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
  background,
  card: background,
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
  statusPaused: pair('#9792A6', palette.slate400),
  statusSuccess: pair('#55B685', palette.green400),
  statusError: pair(palette.red550, palette.red500),
  errorAccent: same(palette.red500), // vivid red badge fill (recovery-phrase verify), distinct from statusError's softer border tone
  verifyCorrectFill: pair('#EBF5ED', palette.green900), // correct-answer pill fill (recovery-phrase verify)
  verifyIncorrectFill: pair('#FCD3CA', palette.maroon900), // incorrect-answer pill fill (recovery-phrase verify)
  surfaceSubtle: pair(palette.violet50, palette.violet920), // banner / card background
  accentSubtle: pair(palette.violet100, palette.slate880), // banner & card border, "check again" button bg, scanning icon ring
  accentSubtleDisabled: pair(palette.violet150Alpha, palette.violet850), // disabled bg for accentSubtle/brandPrimary "soft" buttons
  brandPrimaryDisabled: pair(palette.violet600Alpha, palette.gray400), // disabled text for accentSubtle/brandPrimary "soft" buttons
  surfaceCaution: pair('#FDFBF5', palette.brown900), // caution banner background (address-reuse warning)
  // Same values as surfaceCaution today, but a separate token: caution and error are different
  // states, so a tweak to the amber caution surface must not silently restyle the error banner.
  surfaceError: pair('#FDFBF5', palette.brown900), // scan-error banner background
  iconCaution: same('#F1AF63'), // caution banner icon (warm amber)
  segmentTrack: pair('#FDFCFE', '#0E0E16'), // pill toggle track background
  segmentTrackBorder: pair(palette.violet100, '#25253A'), // pill toggle track border
  segmentSelectedBorder: pair(palette.violet100, '#3D3D3D'), // selected pill border
  segmentSelectedBackground: pair(palette.white, palette.slate890), // selected pill fill, lighter than segmentTrack
  copyHint: same(palette.gray450), // "tap to copy" icon + label
  progressTrack: pair('#EAECF0', palette.violet920),
  // Hairline rim on the filled brand button; in dark the design draws it in the brand color itself.
  buttonBorder: pair('#EBEBEB', palette.violet500),
  // Light keeps five distinct greys below; dark deliberately collapses every secondary/meta/
  // muted/chevron role (and statusPaused above) onto slate400 - the single text/secondary value
  // the Figma dark collection defines. Intentional, not unfinished placeholders.
  textPrimary: pair('#1A1A1A', palette.gray375), // titles, primary copy
  textSecondary: pair('#8E8E93', palette.slate400), // subtitles, privacy copy
  textMeta: pair('#92929B', palette.slate400), // ETA / "%" meta text
  textMuted: pair('#7B7A7E', palette.slate400), // card row labels
  textEmphasis: pair(palette.black, palette.gray75), // large display numerals (sync percentage)
  chevron: pair(palette.gray375, palette.slate400), // disclosure chevron
  textBright: pair('#1A1A1A', '#E5E5E5'), // selected tab label, address text — stays crisp in dark mode instead of collapsing like textPrimary
  segmentLabelInactive: pair(palette.gray480, palette.slate400), // unselected pill segment label
  white: same(palette.white),
  black: same(palette.black), // legacy pure black; text sites should migrate to textEmphasis
  // SyncStatusIcon per-status ring/fill tints (glyph color = brandPrimary / status* above)
  syncFillScanning: pair('#DCD2F9', palette.slate880),
  syncRingPaused: pair('#EEEEF1', palette.whiteAlpha08),
  syncFillPaused: pair('#E4E2E8', palette.slate890),
  syncRingDone: pair('#E2FAEA', palette.slate880),
  syncFillDone: pair('#D2F9DC', palette.green900),
  syncRingError: pair('#FDF1F2', palette.red500),
  syncFillError: pair('#FBE9EB', palette.red950),
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
  settingsCheckmark: pair(palette.violet600, palette.violet500), // mirrors brandPrimary's light/dark split for contrast on dark backgrounds
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

// Dark spreads the RN base + RN dark reserved keys first, then our dark values on top, so our
// tokens (e.g. `primary`, always violet600) win over RN's own dark-scheme defaults for every key
// we define. RN's reserved `text`/`border`/`notification` aren't in `tokens` and still fall
// through to DarkTheme.colors, but nothing in the app currently reads them.
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
