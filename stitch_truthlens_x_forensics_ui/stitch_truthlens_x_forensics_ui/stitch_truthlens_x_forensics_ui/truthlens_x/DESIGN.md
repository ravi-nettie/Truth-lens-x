---
name: TruthLens X
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daef'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8fd'
  surface-container-highest: '#dce2f7'
  on-surface: '#141b2b'
  on-surface-variant: '#434655'
  inverse-surface: '#293040'
  inverse-on-surface: '#edf0ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#505f79'
  on-secondary: '#ffffff'
  secondary-container: '#d0e0ff'
  on-secondary-container: '#54637d'
  tertiary: '#46566c'
  on-tertiary: '#ffffff'
  tertiary-container: '#5e6e85'
  on-tertiary-container: '#e9f0ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#d5e3ff'
  secondary-fixed-dim: '#b7c7e5'
  on-secondary-fixed: '#0b1c32'
  on-secondary-fixed-variant: '#384760'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f9f9ff'
  on-background: '#141b2b'
  surface-variant: '#dce2f7'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
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
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-lg: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers a high-trust, utilitarian, and uncompromisingly precise interface engineered for digital forensics investigators, legal analysts, and enterprise cybersecurity responders. The brand evokes technical authority, meticulous accuracy, and cognitive clarity under critical pressure.

The visual style is **Utilitarian Corporate Modern**: crisp structural geometry, high-density data legibility, structured contrast, and purposeful containment. Aesthetic flourishes are deliberately restrained to eliminate noise, ensuring evidence integrity, timeline analyses, and forensic telemetries remain the focal point.

## Colors

The palette establishes an unambiguous hierarchy between navigation structure, analytical workspace, and evidentiary status indicators.

- **Primary Canvas (`#FFFFFF`):** High-clarity workspace ensuring continuous readability across high-density data grids, evidentiary logs, and telemetry trees.
- **Structural Nav Surface (`#14243B`):** Deep navy anchoring navigation sidebars, workspace switchers, and persistent control rails to provide clear visual separation from investigative data.
- **Brand Primary (`#2563EB`):** High-precision blue reserved for confirmed interactive pathways, focus rings, primary action triggers, and active data filters.
- **Typography:** Primary text (`#111827`) provides decisive optical contrast for critical data values, hash fingerprints, and system strings. Secondary text (`#64748B`) governs labels, metadata, timestamps, and column descriptors.
- **Structural Dividers (`#E2E8F0`):** Strict, hairline borders framing evidentiary cards, table cells, and panel docks.
- **Forensic Status Tones:**
  - *Error / Tampered:* Surface `#FDEBEC`, Text `#DC2626`.
  - *Warning / Flagged:* Surface `#FFF5E6`, Text `#D97706`.
  - *Info / Verified:* Surface `#EFF6FF`, Text `#2563EB`.
  - *Evidence Tag / Neutral Badge:* Surface `#DBEAFE`, Text `#1D4ED8`.

## Typography

Inter serves as the sole type system, leveraging tabular figures for structured data alignment. 

- **System Metrics:** All data tables, raw byte outputs, hex views, and SHA/MD5 signatures must adopt tabular lining (`font-feature-settings: 'tnum' 1, 'cv05' 1`) to preserve vertical decimal alignments.
- **Hierarchy:** Headline styles are reserved for case identifiers, panel titles, and top-level evidence boards. Body-md (14px) is the baseline standard for investigation notes, telemetry logs, and table content.
- **Labels:** Micro-metadata, evidence chips, and audit tags utilize `label-sm` with slight uppercase tracking to distinguish technical metadata from readable prose.

## Layout & Spacing

The layout operates on a fluid, panel-oriented dock architecture structured around a compact 4px/8px incremental grid.

- **Workspace Layout:** A persistent 260px dark navigation sidebar (`#14243B`) sits flush left, accompanied by a flexible dual- or triple-pane investigative workbench: Case Directory (280px–360px collapsible), Main Analysis Grid/Canvas (fluid flex), and Evidence Inspector/Properties Dock (340px fixed or collapsible).
- **Grid & Gutters:** Grid panes utilize consistent `1rem` (16px) gutters on standard desktop views, expanding to `1.5rem` on ultra-wide monitoring displays.
- **Responsive Adaptations:**
  - *Desktop (>=1280px):* Full 3-pane inspection layout with split-screen hex and metadata review.
  - *Tablet (768px–1279px):* Inspector converts to an overlay drawer; sidebar collapses into an icon-only quick rail (64px).
  - *Mobile (<768px):* Single active view stack with modal-based evidence filtering and linear timeline flows.

## Elevation & Depth

Visual hierarchy is constructed primarily through **low-contrast structural outlines and layered flat surfaces**, avoiding heavy or soft decorative drop-shadows that distract from complex datasets.

- **Base Work Surface:** Pure `#FFFFFF` anchored by `#E2E8F0` hairline borders (1px solid).
- **Secondary Surfaces & Toolbars:** Subtle slate shifts (`#F8FAFC` to `#F1F5F9`) define table headers, filter bars, and card headers without introducing elevation jumps.
- **Modals & Popovers:** Low-opacity, technical ambient shadows (`0 4px 12px rgba(15, 23, 42, 0.08)`) combined with a crisp 1px `#E2E8F0` border to maintain edge definition against the pure white canvas.
- **Active Focus & Selection:** Indicated via a 1px solid `#2563EB` border accompanied by an outer non-diffused 2px ring (`rgba(37, 99, 235, 0.2)`).

## Shapes

The design system employs a **Soft (Level 1)** corner radius model to reflect rigorous, surgical software engineering.

- **Containers & Surfaces:** Modals, analytic cards, and panel wrappers utilize `0.5rem` (`rounded-lg`).
- **Interactive Controls:** Buttons, inputs, search omnibars, and data cells use `0.25rem` (`rounded`).
- **Pills & Status Indicators:** Badges, tags, and status dots leverage `9999px` full-radius pills to differentiate analytical status indicators from actionable inputs.

## Components

### Buttons
- **Primary:** Filled `#2563EB`, text `#FFFFFF`, 0.25rem radius, height 36px (compact 32px for data tables). Hover: `#1D4ED8`. Active: `#1E40AF`.
- **Secondary:** Surface `#FFFFFF`, border 1px solid `#E2E8F0`, text `#111827`. Hover: `#F8FAFC`, border `#CBD5E1`.
- **Destructive / Override:** Surface `#DC2626`, text `#FFFFFF`. Hover: `#B91C1C`.
- **Ghost / Tool Rail:** Borderless, text `#64748B`. Hover: `#F1F5F9`, text `#111827`.

### Status Pills & Evidence Badges
- **Error / Chain-of-Custody Break:** Surface `#FDEBEC`, text `#DC2626`, border 1px solid `rgba(220, 38, 38, 0.2)`.
- **Warning / Unverified Heuristic:** Surface `#FFF5E6`, text `#D97706`, border 1px solid `rgba(217, 119, 6, 0.2)`.
- **Info / Chain Verified:** Surface `#EFF6FF`, text `#2563EB`, border 1px solid `rgba(37, 99, 235, 0.2)`.
- **Evidence Tag:** Surface `#DBEAFE`, text `#1D4ED8`, font-size `11px`, font-weight 600.

### Input Fields & Query Bars
- **Default State:** Background `#FFFFFF`, 1px border `#E2E8F0`, padding 8px 12px, font-size 14px, placeholder `#64748B`.
- **Focus State:** Border `#2563EB`, outline 2px solid `rgba(37, 99, 235, 0.2)`.
- **Forensic Query Omnibar:** Extended search variant containing query syntax tokens, keyboard shortcut hints (`Ctrl+K`), and inline regex validation badges.

### Checkboxes & Selection Controls
- **Checkboxes:** 16x16px, 1px border `#CBD5E1`, 2px radius. Selected: `#2563EB` fill with white checkmark. Indeterminate: filled `#2563EB` with centered dash.
- **Radio Buttons:** 16x16px circle, 1px border `#CBD5E1`. Selected: 4px centered `#2563EB` core.

### Cards & Data Panels
- **Structure:** Flat `#FFFFFF` fill, 1px solid `#E2E8F0` perimeter border, header pane with `#F8FAFC` background and bottom divider.
- **Padding:** 16px internal padding for analytical metrics; zero-padding layouts for full-bleed data tables.

### Domain-Specific Components
- **Hex View / Raw Data Grid:** Split-column mono display (`0.75rem` font, tabular figures) alternating byte pairs with responsive offset headers and ASCII interpretation margins.
- **Timeline Breadcrumbs:** Segmented bar indicators marking chronological ingestion, acquisition, processing, verification, and archival stages.