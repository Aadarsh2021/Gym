# FitSphere / GymBuddy — Design System & Theme Architecture

## 1. Palette Specification

The visual design system is built for a high-performance consumer athletic experience, rejecting clinical, hospital, and enterprise-ERP appearances.

### Dark Graphite (Default Dark Mode)
- **Canvas Base**: `#0B0D10`
- **Secondary Surfaces**: `#111419`
- **Cards & Elevators**: `#171A1F` / `#1E2229`
- **Borders**: `#252A31` / `#303640`
- **Primary Accent**: `#4F8CFF` (Electric Blue)
- **Primary Hover/Active**: `#6AA1FF` / `#3D78E6`
- **Status Semantics**:
  - Success / Active Check-in: `#10B981` (Restrained Emerald)
  - Warnings / Milestones: `#D6A84F` (Restrained Gold)
  - Danger / Safety SOS: `#EF4444` (Restrained Crimson)

### Light Athletic Mode (`html[data-theme="light"]`)
- **Canvas Base**: `#F8F9FA`
- **Surface Elevation**: `#FFFFFF`
- **Typography Primary**: `#111827` (Deep Slate)
- **Typography Secondary**: `#4B5563` (Muted Slate)
- **Dividers & Borders**: `#E2E4E8`
- **Primary Accent**: `#2B6BE6`
- **Design Intent**: Crisp, high-contrast, modern athletic feel without clinical or generic bootstrap aesthetics.

---

## 2. Reusable Primitives & CSS Tokens

- `.card`: Standard rounded container with `var(--bg-surface)` and `var(--border-subtle)`.
- `.card-elevated`: Floating card with subtle depth shadow.
- `.card-gym-command`: High-contrast gradient command banner with electric blue border for active integrated club status.
- `.card-external-badge`: Minimal neutral graphite chip indicating commercial gym mode.
- `.mobile-sheet-backdrop` & `.mobile-sheet-content`: Smooth iOS/Android drawer animation for the mobile 5th-slot "More" menu.
- `.badge`: Semantic status indicators for membership (`active`, `pending`, `frozen`) and streaks.
