/**
 * RecuirtPro — Motion Design System
 *
 * Single source of truth for all animation values.
 * Rule: animate only `transform` and `opacity` — never width/height/top/left.
 * Every variant must work correctly when `useReducedMotion()` returns true.
 */
import { type Variants, type Transition } from 'framer-motion';

export { useReducedMotion } from 'framer-motion';

// ── Timing scale ──────────────────────────────────────────────────────────────
export const dur = {
  fast:   0.15,  // micro-interactions: button press, tooltip
  base:   0.25,  // standard: panel open, tab switch
  slow:   0.40,  // larger: modal, page section
  xslow:  0.60,  // milestone moments: hire, offer accepted
} as const;

// ── Easing ────────────────────────────────────────────────────────────────────
export const ease = {
  standard: [0.4, 0, 0.2, 1] as [number,number,number,number],
  enter:    [0.0, 0, 0.2, 1] as [number,number,number,number],
  exit:     [0.4, 0, 1.0, 1] as [number,number,number,number],
} as const;

// ── Spring presets ───────────────────────────────────────────────────────────
export const spring = {
  settle:  { type: 'spring', stiffness: 420, damping: 30 } as Transition,
  bouncy:  { type: 'spring', stiffness: 320, damping: 22 } as Transition,
  stiff:   { type: 'spring', stiffness: 500, damping: 40 } as Transition,
  gentle:  { type: 'spring', stiffness: 220, damping: 28 } as Transition,
  badge:   { type: 'spring', stiffness: 600, damping: 28 } as Transition,
} as const;

// ── Common transitions ────────────────────────────────────────────────────────
export const t = {
  fast:    { duration: dur.fast,   ease: ease.standard } as Transition,
  base:    { duration: dur.base,   ease: ease.enter    } as Transition,
  slow:    { duration: dur.slow,   ease: ease.enter    } as Transition,
  exit:    { duration: dur.fast,   ease: ease.exit     } as Transition,
} as const;

// ── Utility: instant variant for reduced-motion ───────────────────────────────
export function instant<V extends Variants>(variants: V): V {
  return Object.fromEntries(
    Object.entries(variants).map(([k, v]) => [
      k,
      typeof v === 'object' && v !== null
        ? { ...v, transition: { duration: 0 } }
        : v,
    ])
  ) as V;
}

// ── Standard variants ─────────────────────────────────────────────────────────

export const fadeVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: t.base },
  exit:    { opacity: 0, transition: t.exit },
};

export const slideUpVariants: Variants = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: t.base },
  exit:    { opacity: 0, y: 4,  transition: t.exit },
};

export const slideDownVariants: Variants = {
  hidden:  { opacity: 0, y: -6 },
  visible: { opacity: 1, y: 0, transition: t.fast },
  exit:    { opacity: 0, y: -4, transition: t.exit },
};

export const scaleVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.93 },
  visible: { opacity: 1, scale: 1,    transition: spring.settle },
  exit:    { opacity: 0, scale: 0.96, transition: t.exit },
};

// Modal / drawer
export const modalVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.95, y: 8  },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: spring.settle },
  exit:    { opacity: 0, scale: 0.97, y: 4,  transition: t.fast },
};

export const drawerVariants: Variants = {
  hidden:  { opacity: 0, x: '100%' },
  visible: { opacity: 1, x: 0,       transition: spring.settle },
  exit:    { opacity: 0, x: '100%',  transition: t.base },
};

export const backdropVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: t.base },
  exit:    { opacity: 0, transition: t.fast },
};

// Page transitions (route changes)
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: t.base },
  exit:    { opacity: 0,       transition: t.exit },
};

// Stagger container + item
export const staggerContainer = (staggerSecs = 0.06): Variants => ({
  hidden:  {},
  visible: { transition: { staggerChildren: staggerSecs, delayChildren: 0.04 } },
});

export const staggerItem: Variants = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: t.base },
};

// Kanban card drag physics
export const kanbanCardVariants: Variants = {
  idle:     { scale: 1,    rotate: 0,   boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  dragging: { scale: 1.04, rotate: 1.5, boxShadow: '0 20px 40px rgba(0,0,0,0.18)', transition: spring.stiff },
};

// Column drop target
export const columnDropVariants: Variants = {
  idle:  { borderColor: '#e2e2ec', backgroundColor: 'rgb(248 248 252)' },
  over:  { borderColor: '#6366f1', backgroundColor: 'rgb(238 242 255)', transition: t.fast },
};

// Count badge bump when value changes
export const badgeBump: Variants = {
  rest: { scale: 1 },
  bump: { scale: 1.35, transition: spring.badge },
};

// Score ring draw-in (used for AI score rings)
export const scoreRingVariants = (score: number) => ({
  hidden:  { pathLength: 0,          opacity: 0 },
  visible: { pathLength: score / 100, opacity: 1, transition: { pathLength: { duration: dur.slow, ease: ease.enter }, opacity: { duration: dur.fast } } },
});

// Recommendation badge spring-in
export const recommendationBadge: Variants = {
  hidden:  { opacity: 0, scale: 0.5 },
  visible: { opacity: 1, scale: 1, transition: spring.bouncy },
};
