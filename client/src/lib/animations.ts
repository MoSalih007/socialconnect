import type { Variants } from 'framer-motion';

// PAGE TRANSITIONS
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.18, ease: 'easeIn' },
  },
};

// STAGGERED LISTS
export const listVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

// MODAL
export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.93, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.26, ease: [0.34, 1.56, 0.64, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 8,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

// LIKE HEART BURST
export const likeVariants: Variants = {
  idle: { scale: 1 },
  liked: {
    scale: [1, 1.4, 0.85, 1.15, 1],
    transition: { duration: 0.45, times: [0, 0.2, 0.45, 0.7, 1] },
  },
  unliked: {
    scale: [1, 0.82, 1],
    transition: { duration: 0.22 },
  },
};

// DOUBLE-TAP HEART OVERLAY
export const doubleTapHeartVariants: Variants = {
  hidden: { scale: 0, opacity: 0, rotate: -15 },
  visible: {
    scale: [0, 1.5, 1.2, 1],
    opacity: [0, 1, 1, 0],
    rotate: [-15, 0, 0, 5],
    transition: { duration: 0.85, times: [0, 0.25, 0.6, 1] },
  },
};

// DROPDOWN MENU
export const dropdownVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: -8, transformOrigin: 'top right' },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.16, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    y: -4,
    transition: { duration: 0.12, ease: 'easeIn' },
  },
};

// STORY VIEWER
export const storyViewerVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.22, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 1.02, transition: { duration: 0.16, ease: 'easeIn' } },
};

// PROFILE HEADER
export const profileAvatarVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, type: 'spring', stiffness: 280, damping: 22 },
  },
};

export const profileInfoVariants: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: 'easeOut', delay: 0.1 },
  },
};

// PROFILE GRID
export const gridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.2 },
  },
};

export const gridItemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.88 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

// NOTIFICATION BADGE
export const badgeVariants: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 520, damping: 18 },
  },
  exit: { scale: 0, opacity: 0, transition: { duration: 0.15 } },
};

// MESSAGE BUBBLES
export const messageSentVariants: Variants = {
  hidden: { opacity: 0, x: 18, scale: 0.93 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.24, ease: 'easeOut' },
  },
};

export const messageReceivedVariants: Variants = {
  hidden: { opacity: 0, x: -18, scale: 0.93 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.24, ease: 'easeOut' },
  },
};

// AUTH FORMS
export const authCardVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export const authLogoVariants: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, type: 'spring', stiffness: 260, damping: 20 },
  },
};

export const formFieldStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

export const formFieldVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

// ============ NEW ANIMATION VARIANTS ============

// STAGGER FADE IN — for cards/sections entering viewport
export const staggerFadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

export const staggerFadeInChild: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
};

// SPRING POP — for buttons, toggles, interactive elements
export const springPop: Variants = {
  idle: { scale: 1 },
  pop: {
    scale: [1, 1.15, 0.95, 1.05, 1],
    transition: { duration: 0.4, times: [0, 0.2, 0.5, 0.75, 1] },
  },
};

// SLIDE IN FROM BOTTOM — for mobile sheets, pickers
export const slideInFromBottom: Variants = {
  hidden: { y: '100%', opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', damping: 30, stiffness: 400 },
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

// PULSE ONCE — for notification badges arriving
export const pulseOnce: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: [0, 1.3, 1],
    opacity: [0, 1, 1],
    transition: { duration: 0.5, times: [0, 0.5, 1], ease: 'easeOut' },
  },
};

// COUNTER FLIP — for animated number changes
export const counterFlip: Variants = {
  initial: { y: 10, opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
  exit: {
    y: -10,
    opacity: 0,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

// SETTINGS SECTION ENTRY
export const settingsCardVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
};