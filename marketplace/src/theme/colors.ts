// ValueSkins Design System - Material 3 Inspired
// Unified color palette across all pages

export const COLORS = {
  // Primary
  primary: '#675b64',
  primaryContainer: '#f8e7f2',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#736670',
  primaryFixed: '#efdee9',
  primaryFixedDim: '#d2c2cd',

  // Secondary
  secondary: '#625b70',
  secondaryContainer: '#e8def7',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#686176',
  secondaryFixed: '#e8def7',
  secondaryFixedDim: '#ccc2db',

  // Tertiary
  tertiary: '#5d5f5f',
  tertiaryContainer: '#ececec',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#696a6b',
  tertiaryFixed: '#e2e2e2',
  tertiaryFixedDim: '#c6c6c7',

  // Background
  background: '#fff7fb',
  onBackground: '#1e1a1e',
  surface: '#fff7fb',
  surfaceBright: '#fff7fb',
  surfaceDim: '#e1d7dd',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#fbf1f7',
  surfaceContainer: '#f5ebf1',
  surfaceContainerHigh: '#efe6eb',
  surfaceContainerHighest: '#e9e0e6',
  onSurface: '#1e1a1e',
  onSurfaceVariant: '#4b4549',
  inverseSurface: '#342f33',
  inverseOnSurface: '#f8eef4',

  // Outline
  outline: '#7d757a',
  outlineVariant: '#cec4c9',

  // Error
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  onErrorContainer: '#93000a',

  // Semantic
  success: '#86efac',
  accent: '#38bdf8',
  warning: '#fbbf24',

  // Text variants
  text: '#1e1a1e',
  textMuted: '#4b4549',
  textVariant: '#94a3b8',

  // Utility
  transparent: 'transparent',
  white: '#ffffff',
  black: '#000000',
};

// Legacy color names for backwards compatibility
export const C = {
  bg: COLORS.background,
  surface: COLORS.surface,
  primary: COLORS.primary,
  primaryContainer: COLORS.primaryContainer,
  secondary: COLORS.secondary,
  outline: COLORS.outline,
  outlineVariant: COLORS.outlineVariant,
  onSurface: COLORS.onSurface,
  onSurfaceVariant: COLORS.onSurfaceVariant,
  textMuted: COLORS.textMuted,
  textSecondary: COLORS.textMuted, // Alias for backwards compatibility
  accent: COLORS.accent,
  success: COLORS.success,
  error: COLORS.error,
  warning: COLORS.warning,
  text: COLORS.text,
  border: `rgba(148, 163, 184, 0.18)`,
  borderLight: `rgba(207, 197, 225, 0.2)`,
};

export default COLORS;
