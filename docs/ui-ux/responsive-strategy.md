# FitSphere / GymBuddy — Responsive & Breakpoint Strategy

## 1. Breakpoint Grid

The application layout responds seamlessly across mobile, tablet, and widescreen desktop:

| Device Category | Viewport Width | Navigation Mode | Main Content Wrapper |
| :--- | :--- | :--- | :--- |
| **Small Mobile** | $320\text{px} - 375\text{px}$ | Mobile Bottom Nav + Bottom Sheet | `margin-left: 0`, safe padding |
| **Standard Mobile** | $375\text{px} - 430\text{px}$ | Mobile Bottom Nav + Bottom Sheet | `margin-left: 0`, bottom nav clearance |
| **Tablet** | $768\text{px} - 1023\text{px}$ | Mobile Bottom Nav + Responsive Grids | Two-column wrapping, `margin-left: 0` |
| **Desktop** | $1024\text{px} - 1440\text{px}$ | Fixed 275px Left Sidebar | `margin-left: 275px`, `max-width: 1200px` |
| **Wide Desktop** | $\ge 1440\text{px}$ | Fixed 275px Left Sidebar | `margin-left: 275px`, centered container |

---

## 2. Safe Areas & Tap Targets

- All interactive controls adhere to $\ge 44\text{px}$ touch targets on mobile.
- Support for `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` to accommodate notch and dynamic island hardware on iOS and edge-to-edge navigation on Android.
- Zero horizontal overflow (`overflow-x: hidden` guarded on shell level).
- No dual-scrollbar containers or nested window scrolling traps.
