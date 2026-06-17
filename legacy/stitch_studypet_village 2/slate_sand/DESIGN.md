---
name: Slate & Sand
colors:
  surface: '#faf9fa'
  surface-dim: '#dbdada'
  surface-bright: '#faf9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f4'
  surface-container: '#efedee'
  surface-container-high: '#e9e8e9'
  surface-container-highest: '#e3e2e3'
  on-surface: '#1b1c1d'
  on-surface-variant: '#43474c'
  inverse-surface: '#303031'
  inverse-on-surface: '#f2f0f1'
  outline: '#73777c'
  outline-variant: '#c3c7cc'
  surface-tint: '#4b6172'
  primary: '#4b6172'
  on-primary: '#ffffff'
  primary-container: '#aec5d9'
  on-primary-container: '#3c5263'
  inverse-primary: '#b2c9dd'
  secondary: '#575f67'
  on-secondary: '#ffffff'
  secondary-container: '#dbe3ec'
  on-secondary-container: '#5d656d'
  tertiary: '#76593c'
  on-tertiary: '#ffffff'
  tertiary-container: '#e1bb98'
  on-tertiary-container: '#654a2e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cee5fa'
  primary-fixed-dim: '#b2c9dd'
  on-primary-fixed: '#051e2c'
  on-primary-fixed-variant: '#33495a'
  secondary-fixed: '#dbe3ec'
  secondary-fixed-dim: '#bfc7d0'
  on-secondary-fixed: '#151c23'
  on-secondary-fixed-variant: '#40484f'
  tertiary-fixed: '#ffdcbe'
  tertiary-fixed-dim: '#e6bf9c'
  on-tertiary-fixed: '#2b1702'
  on-tertiary-fixed-variant: '#5c4127'
  background: '#faf9fa'
  on-background: '#1b1c1d'
  surface-variant: '#e3e2e3'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.5px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

# Design System: Slate & Sand

## Brand & Style
The brand identity has shifted from a high-energy, vibrant aesthetic to a professional, calm, and sophisticated tone. It utilizes a "Corporate Modern" style that prioritizes clarity, reliability, and executive-level polish. The palette moves away from aggressive oranges to muted blues and earth tones, evoking a sense of stability and architectural precision. The UI should feel airy and composed, utilizing generous white space and a refined, subtle color application.

## Colors
The color strategy employs a "fidelity" variant, ensuring the UI stays true to the sophisticated cool-grey and slate tones of the primary palette.

*   **Primary (#647a8c):** A muted slate blue used for core actions and structural emphasis.
*   **Secondary (#707880):** A neutral steel grey for supporting UI elements and icons.
*   **Tertiary (#e1bb98):** A warm sand tone used sparingly for highlights or to soften the cool primary palette.
*   **Neutral (#777778):** A balanced grey for text and borders, ensuring high legibility and a cohesive look.

## Typography
The system has transitioned to **Inter** for all typographic roles. Inter provides a high degree of legibility and a neutral, modern character that complements the corporate aesthetic. 

*   **Headlines:** Use Inter with a semi-bold weight (600) to create a clear hierarchy.
*   **Body:** Optimized for long-form reading with a balanced 1.5x line height.
*   **Labels:** Use medium weights and subtle letter spacing for functional clarity at small sizes.

## Layout & Spacing
The layout follows a 12-column fluid grid system on desktop and a 4-column system on mobile. A strict 8px spacing rhythm (Base 2) is maintained across all components. Gutters are fixed at 16px to ensure a tight, professional information density. Margins scale from 16px on mobile devices to 32px or more on larger screens to prevent content from touching the viewport edges.

## Elevation & Depth
Depth is communicated through tonal layering and soft, ambient shadows. Instead of heavy outlines, the system uses "surface-container" tiers where different shades of neutral grey define separate functional areas. When shadows are required for floating elements (like modals or dropdowns), they should be highly diffused, using a low-opacity slate tint rather than pure black to maintain the soft, modern feel.

## Shapes
The design system has moved from sharp, 90-degree corners to a more approachable **Rounded** aesthetic. 
*   **Base components:** 0.5rem (8px) corner radius.
*   **Large containers:** 1rem (16px) corner radius.
*   **Prominent sections:** 1.5rem (24px) corner radius.

This change softens the corporate look, making the interface feel more contemporary and user-friendly.

## Components
*   **Buttons:** Feature 8px rounded corners and use the Primary Slate (#647a8c) for main actions. Secondary buttons use a subtle outline or neutral background.
*   **Inputs:** Use a 1px border in the Secondary color with an 8px radius. Active states are highlighted with a soft Primary-colored glow.
*   **Cards:** Elevated by soft shadows rather than borders, utilizing the Rounded-LG (16px) corner radius.
*   **Chips & Tags:** Fully pill-shaped or Rounded-MD, often using the Tertiary sand color (#e1bb98) for status or highlight indicators.