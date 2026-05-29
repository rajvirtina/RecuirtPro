# RecuirtPro — Motion Design Specification

## 1. Timing Scale

| Token    | Value  | Use Case                                    |
| -------- | ------ | ------------------------------------------- |
| `fast`   | 150ms  | Micro-interactions: button press, tooltip   |
| `base`   | 250ms  | Standard: panel open, tab switch, fade      |
| `slow`   | 400ms  | Larger transitions: modal, chart draw-in    |
| `xslow`  | 600ms  | Milestone moments: confetti, celebration    |

## 2. Easing Curves (One Family)

| Token      | Value                          | When to Use                 |
| ---------- | ------------------------------ | --------------------------- |
| `standard` | `cubic-bezier(0.4, 0, 0.2, 1)`| General movement            |
| `enter`    | `cubic-bezier(0.0, 0, 0.2, 1)`| Things appearing/entering   |
| `exit`     | `cubic-bezier(0.4, 0, 1.0, 1)`| Things leaving/dismissing   |

## 3. Spring Presets

| Preset   | Stiffness | Damping | Use Case                                 |
| -------- | --------- | ------- | ---------------------------------------- |
| `settle` | 420       | 30      | Default spring (modal, card settle)      |
| `bouncy` | 320       | 22      | Playful (badge appear, chip pop-in)      |
| `stiff`  | 500       | 40      | Snappy (button tap, drag release)        |
| `gentle` | 220       | 28      | Subtle (hover lift, slow reveal)         |
| `badge`  | 600       | 28      | Badge bump on count change               |

## 4. Motion Rules — Do / Don't

### DO:
- ✅ Animate ONLY `transform` and `opacity` (GPU-composited)
- ✅ Use `will-change: transform` on frequently animated elements
- ✅ Stagger items at 60ms intervals (max 6–8 items)
- ✅ Keep total animation under 300ms for interactions
- ✅ Use `AnimatePresence` for enter/exit transitions
- ✅ Provide `layout` animations for reflow (Kanban cards, lists)
- ✅ Use `useReducedMotion()` and skip animations when true
- ✅ Reserve confetti for genuine milestones (hire, offer accepted)

### DON'T:
- ❌ Animate `width`, `height`, `top`, `left`, `margin`, `padding`
- ❌ Use animation duration > 450ms for interactions
- ❌ Stack multiple animations that fight for attention
- ❌ Use parallax, large rotations, or spinning (vestibular risk)
- ❌ Delay content visibility > 400ms (perceived slowness)
- ❌ Animate on scroll without `once: true` (causes re-triggers)
- ❌ Use confetti on routine actions

## 5. Component Motion Checklist

### Buttons
- Hover: `scale(1.02)` + `brightness(1.05)` — spring.stiff
- Active/tap: `scale(0.97)` — spring.stiff
- Loading: SVG spinner rotates at 0.8s/revolution
- Success: checkmark icon scales in with spring.bouncy

### Inputs
- Focus ring: CSS `transition-all 150ms`
- Error message: `AnimatePresence` slide-down (y: -4 → 0, h: 0 → auto)
- Error clear: fade out in 150ms

### Modals / Drawers
- Enter: `scale(0.95)` + `opacity(0)` → `scale(1)` + `opacity(1)` — spring.settle
- Exit: `scale(0.97)` + `opacity(0)` — 150ms ease-exit
- Backdrop: fade 250ms with `backdrop-blur-sm`
- Drawers: slide from right with spring.settle

### Cards
- Hover: `translateY(-2px)` + shadow grows — spring.gentle
- Click/tap: `scale(0.99)` — spring.stiff
- Entry: stagger with 60ms delay, `opacity(0)` + `y(10px)` → visible

### Toasts (Sonner)
- Enter: slide down from top + scale(0.95 → 1)
- Exit: slide up + fade
- Stack: 4 max visible, others opacity-reduced

### Lists / Tables
- Skeleton shimmer while loading (1.6s linear infinite)
- Row add/remove: `@formkit/auto-animate` (200ms ease-out)
- Stagger rows on initial load: 60ms per item

### Kanban Cards
- Drag lift: `scale(1.04)` + `rotate(1.5deg)` + shadow grows — spring.stiff
- Drop: spring settle into place
- Other cards: layout animation to make room (auto-animate)
- Column badge: bump (scale 1→1.35→1) on count change

### Tooltips
- Enter: fade + `y(4px)` → `y(0)` after 300ms hover delay
- Exit: instant fade (150ms)

### Charts
- Bar charts: grow from 0 height (400ms ease-enter)
- Line charts: clip-path reveal left-to-right (400ms)
- Donut/Radar: fade + scale-in (250ms)
- On filter change: re-animate with cross-fade

## 6. Reduced-Motion Variants

When `prefers-reduced-motion: reduce` is active:

| Normal Behavior               | Reduced-Motion Fallback    |
| ----------------------------- | -------------------------- |
| Slide + fade entry            | Instant appear (no motion) |
| Spring animations             | Instant snap               |
| Stagger delays                | All appear simultaneously  |
| Skeleton shimmer              | Static gray placeholder    |
| Confetti burst                | Simple text flash          |
| Kanban drag lift/settle       | Instant move               |
| Chart draw-in                 | Static render              |
| Waveform animation            | Static bars                |

Implementation: Every Framer Motion component checks `useReducedMotion()` and passes `undefined` to animation props when reduced. CSS layer uses:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## 7. Performance Budget

- Total animation JS (Framer Motion): ~34KB gzipped
- Target: 0 layout-triggering animations
- Lighthouse Performance: must not regress below 90
- Max simultaneous animating elements: 12
- Use `layout` prop sparingly (only Kanban cards, lists)

## 8. File Organization

```
src/lib/motion.ts          — All tokens, variants, springs, utilities
src/components/ui/         — Animated UI primitives
src/hooks/useScrollReveal  — Scroll-triggered reveal hook
```
