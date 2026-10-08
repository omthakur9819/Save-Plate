/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#173b2d',
    tint: '#e2764d',
    background: '#faf8f2',
    foreground: '#173b2d',
    card: '#ffffff',
    cardForeground: '#173b2d',
    primary: '#e2764d',
    primaryForeground: '#ffffff',
    secondary: '#eef1e8',
    secondaryForeground: '#315644',
    muted: '#f1efe7',
    mutedForeground: '#7c877c',
    accent: '#e8efdf',
    accentForeground: '#315644',
    destructive: '#b94736',
    destructiveForeground: '#ffffff',
    border: '#e8e5db',
    input: '#e8e5db',
  },
  dark: {
    text: '#f4f0e6',
    tint: '#f28c61',
    background: '#15251d',
    foreground: '#f4f0e6',
    card: '#20352a',
    cardForeground: '#f4f0e6',
    primary: '#f28c61',
    primaryForeground: '#1c2b22',
    secondary: '#2c4335',
    secondaryForeground: '#dce8d7',
    muted: '#26392e',
    mutedForeground: '#a2b1a3',
    accent: '#304b38',
    accentForeground: '#dce8d7',
    destructive: '#d76656',
    destructiveForeground: '#ffffff',
    border: '#385042',
    input: '#385042',
  },
  radius: 18,
};

export default colors;
