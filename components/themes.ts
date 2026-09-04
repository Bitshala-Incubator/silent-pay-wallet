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
  whiteAlpha32: '#FFFFFF52',
  black: '#000000',
  blackAlpha32: '#00000052',
  blackAlpha40: '#00000066',

  gray50: '#F5F5F7',
  gray75: '#F0F0F5',
  gray100: '#EEF0F4',
  gray150: '#EEEEEE',
  gray175: '#E5E7EB',
  gray200: '#E6E4E4',
  gray200Alpha: '#E6E4E499',
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
  navy900: '#101828',
  maroon900: '#5A4E4E',
  brown900: '#2E2518',

  // Blue-violet tinted neutrals used by the dark scheme (distinct from the pure grays above).
  slate400: '#8888AA',
  slate880: '#25253A',
  slate885: '#1E1E2E',
  slate890: '#1A1A28',
  slate950: '#0E0E16',

  violet25: '#FDFCFE',
  violet50: '#F6F5FD',
  violet100: '#E6E2FA',
  violet150: '#D7C8F7',
  violet150Alpha: '#DCD2F999',
  violet175: '#D7C8F7',
  violet200: '#D0C0FAFF',
  violet500: '#8763EB',
  violet525: '#6B5CE7',
  violet600: '#754CE8',
  violet600Alpha: '#754CE866',
  violet850: '#473F71',
  violet900: '#1D1A2B',
  violet920: '#1A1535',
  violet500Alpha: '#6B5CE78F',
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
type ColorToken = { light: string; dark: string };
const pair = (light: string, dark: string): ColorToken => ({ light, dark });
const same = (v: string): ColorToken => ({ light: v, dark: v });

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
  chevron: pair(palette.gray480, palette.slate400), // disclosure chevron (icon/secondary)
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
  payBtnDisabledBackground: pair(palette.blackAlpha32, palette.whiteAlpha32),
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
  cardBackground: pair(palette.violet25, '#1A1A1A'),

  // --- Send redesign tokens ---
  fieldBackground: pair(palette.gray50, palette.slate890), // Address / Note field background (bg/secondary)
  amountMeta: pair(palette.gray480, palette.slate400), // BTC unit, fiat estimate, slow/medium ETA (text/muted)
  // text/disabled. Dark shares its value with bg/disabled, so the empty 48px "0" and the disabled
  // fee row sit at 1.17:1 on bg/primary — that is deliberate in the design: the ghost digit is
  // meant to recede and "Tap amount to edit" carries the affordance.
  textDisabled: pair(palette.gray375, palette.slate885), // empty amount digits, disabled fee row
  // shadow/overlay: a flat 40% black scrim in both schemes. In dark the sheet (bg/primary) and the
  // screen behind it are the same color, so the sheet's edge is carried by its top radius, not contrast.
  scrim: same(palette.blackAlpha40), // Success bottom-sheet backdrop
  // surface/brand + icon/brand + border/brand-strong. One value in the dark collection, and
  // deliberately NOT brandPrimary: retuning the violet500 primitive would move all 49
  // brandPrimary call sites, several of which are text.
  brandStrong: pair(palette.violet600, palette.violet525),
  ctaDisabled: pair(palette.gray480, palette.slate885), // disabled primary button background (bg/disabled)
  // border/default. Every hairline edge in the send flow is this one token: unselected fee cards,
  // the "Use Max" pill, Confirm's section dividers, the disabled fee summary card.
  borderDefault: pair(palette.gray200Alpha, palette.whiteAlpha08),
  // bg/brand-subtle. Faintest brand tint; the disabled fee summary card fill is its only user today.
  surfaceBrandSubtle: pair(palette.violet25, palette.slate950),
  // text/brand. Brand-tinted *text*: "Use Max" pill, amount hints, Confirm total. Distinct from
  // brandStrong, which fills surfaces — this one has to stay readable *on* the background.
  textBrand: pair(palette.violet600, palette.violet175),
  sheetBackIcon: pair(palette.gray700, palette.slate400), // bottom-sheet header back chevron
  dashedBorder: pair('#E7E7E7', palette.whiteAlpha08), // "Save as Contact" affordance border (border/default)
  // "to <contact>" chip. Unfilled, so only its border and label need tokens.
  contactChipBorder: pair('#EAECF0', palette.whiteAlpha08),
  contactChipText: pair('#344054', palette.gray375),
  // "Saved as <name>" receipt shown in place of the save affordance for a beat after an inline save.
  contactSavedSurface: pair('#EDFBF1', palette.green900),
  contactSavedAccent: pair('#0F7A38', palette.green400), // its border, check and label — one green, three uses
  copyButtonBorder: pair(palette.gray200, palette.gray800), // Confirm copy-button border
  transactionCardBorder: pair(palette.gray200, palette.slate880),
  searchFieldBorder: pair(palette.gray175, palette.slate885), // SearchField border (border/input)
  searchFieldIcon: pair(palette.gray450, palette.slate400), // SearchField magnifier stroke
  searchFieldPlaceholder: pair('rgba(16, 24, 40, 0.5)', palette.slate400), // SearchField hint (light: primary copy at 50%; dark: text/muted)
  txIconHaloBorder: pair(palette.violet100, palette.violet850),
  incomingIconBackground: pair('#E7E6F5', '#322361'),
  outgoingIconBackground: pair(palette.gray50, '#161616'),
  outgoingIconBorder: pair('#D9D9D9', palette.violet850),

  // --- Settings screen tokens ---
  settingsCardBorder: pair('#F0F0F0', '#2C2C2E'),
  settingsCardBackground: pair('#F9F9FB', '#1C1C1E'),
  settingsRowTitle: pair(palette.navy900, palette.white),
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

  emptyStateTitle: pair('#0A0A0A', palette.gray75),
  tabDivider: pair('#EAECF0', '#FFFFFF14'), // hairline rule under the whole tab strip (border/default)
  tabInactiveText: pair('#667085', palette.slate400), // unselected tab label

  // --- Contact detail tokens ---
  // Destructive button (spec 8e): unfilled — bg/primary carries it and the red is border + label
  // only. Light still tints; see the note on aligning it to #FFFFFF / #B24334.
  removeSurface: pair('#FBE1DF', palette.slate950), // Remove Contact button background
  removeBorder: pair('#FFC9C9', palette.red500), // Remove Contact button border
  removeText: pair('#E7000B', palette.red500), // Remove Contact button label + trash glyph
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

// shadow/sm from the design system: a hairline lift off the page, not a drop shadow.
// Not theme-dependent, so it belongs in a static sheet at every call site. Kept here because
// it was previously reimplemented per-component with different offsets and colors.
export const shadowSm = {
  shadowColor: palette.navy900,
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 3,
  elevation: 2,
} as const;

// TextInput caret + selection tint. Spread onto any TextInput so the caret follows the wallet's
// brand instead of the platform default: <TextInput {...caretProps(colors)} />
export const caretProps = (colors: Theme['colors']) => ({
  selectionColor: colors.brandPrimary,
  cursorColor: colors.brandPrimary,
});

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
