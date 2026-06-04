# Vélin · 尺素 — UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current "土 emoji + 浅色背景" UI with the iOS 18 Premium design shown in `docs/design-proposal/prototype.html` — glass morphism, dynamic per-character color, refined typography, no emojis — branded as **Vélin · 尺素**.

**Architecture:**
- Build a design-system foundation first (CSS tokens, character theme palette, motion + glass utilities).
- Build 10 presentational components in `src/components/velin/` (single responsibility, CSS modules).
- Rewrite 4 screens to consume the new components.
- Add 1 new screen (CharacterDetail) and 1 modal (SearchModal).
- Each visual task references a class in `docs/design-proposal/prototype.html` as the design source of truth.

**Tech Stack:**
- React 19 + Vite 8 + TypeScript 6 (existing)
- Plain CSS + CSS Modules per file (matches existing `Home.css` / `Chat.css` pattern)
- react-router-dom 7 (existing)
- **No new UI library or CSS framework** — keep bundle small

**Reference design (do not change during implementation):**
- `docs/design-proposal/prototype.html` — 4-screen iPhone 17 Pro mockup (393 × 852 CSS px)
- `docs/design-proposal/naming.md` — Vélin · 尺素 naming rationale
- `docs/design-proposal/ui-research.md` — what we borrowed from 星野AI / LINE, what to avoid
- `docs/design-proposal/design-rationale.md` — design notes

**Out of scope (do NOT touch in this plan):**
- Backend (`backend/`)
- Database migrations
- Auth flow
- Real avatar upload (use initials placeholder; existing upload still works in `CharacterEdit`)

---

## File Structure

```
frontend/src/
├── styles/                          # NEW — design system
│   ├── tokens.css                   # CSS custom properties (colors, spacing, typography, motion)
│   ├── motion.css                   # Keyframes + transition utilities
│   └── glass.css                    # Glass morphism utility classes
├── theme/                           # NEW — character theme palette
│   └── characterThemes.ts           # 4 character theme objects (colors + glow)
├── components/
│   ├── velin/                       # NEW — all new components live here
│   │   ├── Avatar/
│   │   │   ├── Avatar.tsx
│   │   │   ├── Avatar.module.css
│   │   │   └── index.ts
│   │   ├── CharacterCard/
│   │   │   ├── CharacterCard.tsx
│   │   │   ├── CharacterCard.module.css
│   │   │   └── index.ts
│   │   ├── ChatBubble/
│   │   │   ├── ChatBubble.tsx
│   │   │   ├── ChatBubble.module.css
│   │   │   └── index.ts
│   │   ├── ChatHeader/
│   │   │   ├── ChatHeader.tsx
│   │   │   ├── ChatHeader.module.css
│   │   │   └── index.ts
│   │   ├── ChatInput/
│   │   │   ├── ChatInput.tsx
│   │   │   ├── ChatInput.module.css
│   │   │   └── index.ts
│   │   ├── SearchPill/
│   │   │   ├── SearchPill.tsx
│   │   │   ├── SearchPill.module.css
│   │   │   └── index.ts
│   │   ├── SearchModal/             # Plan C full-screen search
│   │   │   ├── SearchModal.tsx
│   │   │   ├── SearchModal.module.css
│   │   │   └── index.ts
│   │   ├── StatRing/
│   │   │   ├── StatRing.tsx
│   │   │   ├── StatRing.module.css
│   │   │   └── index.ts
│   │   ├── StatCount/               # 珍藏 big number variant
│   │   │   ├── StatCount.tsx
│   │   │   ├── StatCount.module.css
│   │   │   └── index.ts
│   │   ├── MemoryCard/
│   │   │   ├── MemoryCard.tsx
│   │   │   ├── MemoryCard.module.css
│   │   │   └── index.ts
│   │   ├── TabBar/
│   │   │   ├── TabBar.tsx
│   │   │   ├── TabBar.module.css
│   │   │   └── index.ts
│   │   └── Wordmark/                # Vélin · 尺素 brand mark
│   │       ├── Wordmark.tsx
│   │       ├── Wordmark.module.css
│   │       └── index.ts
│   └── AppShell/                    # NEW — page layout + persistent tab bar
│       ├── AppShell.tsx
│       ├── AppShell.module.css
│       └── index.ts
├── pages/
│   ├── Home.tsx                     # REWRITE — uses CharacterCard + SearchPill + TabBar
│   ├── Home.css                     # REPLACE
│   ├── Chat.tsx                     # REWRITE — uses ChatBubble + ChatHeader + ChatInput
│   ├── Chat.css                     # REPLACE
│   ├── GroupChat.tsx                # REWRITE — uses shared chat components + per-character theme
│   ├── GroupChat.css                # REPLACE
│   ├── CharacterDetail.tsx          # NEW — hero + 2 rings + count + memory cards
│   ├── CharacterDetail.module.css   # NEW
│   └── ... (other pages UNCHANGED in this plan)
├── index.css                        # REPLACE — imports design system
└── App.tsx                          # MODIFY — wrap main routes in AppShell, add /character/:id detail route
```

**Components that are REPLACED (delete after new version is verified):**
- `components/AppHeader.tsx` → replaced by `velin/Wordmark` + inline page headers
- `components/MessageBubble.tsx` → replaced by `velin/ChatBubble`
- `components/AffinityMeter.tsx` → replaced by `velin/StatRing` + `velin/StatCount`

**Components KEPT (no changes):**
- `components/RequireAuth.tsx`
- `components/DifficultySelector.tsx`
- `components/IntimateModeToggle.tsx`
- `components/ExtraRow.tsx`
- `components/MemoryRow.tsx`
- `components/UnlockCelebration.tsx`

---

## Phase 1: Design System Foundation

### Task 1.1: Create CSS tokens

**Files:**
- Create: `frontend/src/styles/tokens.css`

- [ ] **Step 1: Write tokens.css**

```css
/* Vélin · 尺素 — Design tokens
   iOS 18 Premium aesthetic: dark canvas, glass surfaces, refined typography.
   Source of truth for every color / spacing / type / motion value in the app. */

:root {
  /* ============ Surfaces (dark canvas) ============ */
  --canvas: #16161a;
  --canvas-2: #1c1c21;
  --canvas-3: #23232a;

  /* ============ Glass surfaces ============ */
  --glass-1: rgba(255, 255, 255, 0.04);
  --glass-2: rgba(255, 255, 255, 0.06);
  --glass-3: rgba(255, 255, 255, 0.09);
  --hair: rgba(255, 255, 255, 0.06);
  --hair-2: rgba(255, 255, 255, 0.10);

  /* ============ Text ============ */
  --text: #ededef;
  --text-2: #b8b8c0;
  --text-mute: #8a8a92;
  --text-dim: #5e5e66;

  /* ============ Accent / brand ============ */
  --accent: #ededef;            /* primary CTA is white-on-glass, not a colored pill */
  --accent-glow: rgba(255, 255, 255, 0.20);

  /* ============ Status ============ */
  --online: #4ade80;            /* subtle green for online dot */
  --unread: #ff453a;            /* unread badge */
  --danger: #ff453a;

  /* ============ Spacing (8pt grid) ============ */
  --s-1: 4px;
  --s-2: 8px;
  --s-3: 12px;
  --s-4: 16px;
  --s-5: 20px;
  --s-6: 24px;
  --s-7: 32px;
  --s-8: 40px;
  --s-9: 56px;

  /* ============ Radii ============ */
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 16px;
  --r-xl: 22px;
  --r-2xl: 28px;
  --r-pill: 999px;

  /* ============ Typography ============ */
  --font-sans: "Inter", "SF Pro Display", "SF Pro Text", "PingFang SC",
               "Helvetica Neue", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-display: "Inter", "SF Pro Display", "PingFang SC", system-ui, sans-serif;

  /* Size scale (iOS 18 HIG inspired) */
  --t-display: 36px;            /* large title */
  --t-title: 22px;
  --t-headline: 17px;
  --t-body: 15px;
  --t-callout: 14.5px;
  --t-sub: 13px;
  --t-caption: 11px;
  --t-micro: 10px;

  /* Letter-spacing */
  --track-tight: -0.03em;
  --track-normal: -0.01em;
  --track-loose: 0.04em;
  --track-caps: 0.06em;

  /* ============ Motion ============ */
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.5, 1.5, 0.6, 1);
  --dur-quick: 120ms;
  --dur-base: 200ms;
  --dur-slow: 400ms;

  /* ============ Z-index ============ */
  --z-bg: 0;
  --z-content: 10;
  --z-tabbar: 20;
  --z-header: 30;
  --z-modal: 100;
}

/* ============ Character themes (dynamic per character)
   Components consume these via the data-theme attribute on a wrapper
   element.  See theme/characterThemes.ts for the source-of-truth mapping. */
[data-theme="a"] { --a-1: #87a98f; --a-2: #b3cdb8; --a-grad: linear-gradient(135deg, #87a98f 0%, #4a7560 100%); }
[data-theme="b"] { --b-1: #c5d4e0; --b-2: #dfe9f0; --b-grad: linear-gradient(135deg, #c5d4e0 0%, #8aa1b6 100%); }
[data-theme="c"] { --c-1: #c5b5d0; --c-2: #d8c9e2; --c-grad: linear-gradient(135deg, #c5b5d0 0%, #8a78a3 100%); }
[data-theme="d"] { --d-1: #e8d9c0; --d-2: #f0e4cf; --d-grad: linear-gradient(135deg, #e8d9c0 0%, #b8a587 100%); }
[data-theme="user"] { --user-1: #3a3a44; --user-2: #2a2a32; --user-grad: linear-gradient(135deg, #3a3a44 0%, #25252d 100%); }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/styles/tokens.css
git commit -m "feat(velin): add design tokens (colors, spacing, typography, motion)"
```

---

### Task 1.2: Create motion utilities

**Files:**
- Create: `frontend/src/styles/motion.css`

- [ ] **Step 1: Write motion.css**

```css
/* Vélin · 尺素 — Motion utilities
   One keyframe (ambient bob) + transition tokens.
   Restraint is the principle — only use where the prototype uses it. */

@keyframes velin-fade-up {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes velin-bob {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(8px, -6px) scale(1.05); }
}

.velin-fade-up {
  animation: velin-fade-up 0.9s var(--ease) both;
}

.velin-bob {
  animation: velin-bob 16s var(--ease) infinite;
}

@media (prefers-reduced-motion: reduce) {
  .velin-fade-up, .velin-bob { animation: none; }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/styles/motion.css
git commit -m "feat(velin): add motion utilities (fade-up + ambient bob)"
```

---

### Task 1.3: Create glass utility classes

**Files:**
- Create: `frontend/src/styles/glass.css`

- [ ] **Step 1: Write glass.css**

```css
/* Vélin · 尺素 — Glass utility classes
   Apply to any panel / card / chrome that should feel like frosted glass. */

.glass {
  background: var(--glass-1);
  border: 1px solid var(--hair);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}

.glass-strong {
  background: var(--glass-3);
  border: 1px solid var(--hair-2);
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
}

.glass-tabbar {
  background: rgba(22, 22, 26, 0.72);
  border-top: 1px solid var(--hair);
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
}

.glass-header {
  background: rgba(22, 22, 26, 0.55);
  border-bottom: 1px solid var(--hair);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/styles/glass.css
git commit -m "feat(velin): add glass utility classes"
```

---

### Task 1.4: Replace index.css to wire up the design system

**Files:**
- Modify: `frontend/src/index.css` (replace entire contents)

- [ ] **Step 1: Replace index.css**

```css
@import "./styles/tokens.css";
@import "./styles/motion.css";
@import "./styles/glass.css";

/* Vélin · 尺素 — Global baseline */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; }
body {
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  background: var(--canvas);
  color: var(--text);
  font-size: var(--t-body);
  font-feature-settings: "cv11", "ss01", "ss03";
  letter-spacing: var(--track-normal);
  overflow-x: hidden;
}
button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
img, svg { display: block; max-width: 100%; }
a { color: inherit; text-decoration: none; }
input, textarea { font: inherit; color: inherit; background: none; border: 0; outline: 0; }

/* Mobile app shell — never scroll the body, pages manage their own scroll */
#root {
  max-width: 480px;
  margin: 0 auto;
  position: relative;
  overflow: hidden;
}
```

- [ ] **Step 2: Verify TypeScript still compiles**

Run: `cd frontend && npx tsc -b`
Expected: 0 errors (no .ts changes, just CSS)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(velin): wire up design system in index.css"
```

---

### Task 1.5: Create character theme mapping

**Files:**
- Create: `frontend/src/theme/characterThemes.ts`

- [ ] **Step 1: Write characterThemes.ts**

```ts
// Vélin · 尺素 — Character theme palette
// Maps character names to the data-theme attribute used by CSS variables.
// 'user' is the only theme that is not a character — it's the human's avatar.

export type ThemeKey = 'a' | 'b' | 'c' | 'd' | 'user';

export const CHARACTER_THEMES: Record<string, ThemeKey> = {
  '林默': 'a',     // forest green
  '顾夜寒': 'b',   // ice blue
  '玄清': 'c',     // deep purple
  '空白角色': 'd', // warm cream
  '苏晚': 'd',     // warm cream (示例)
};

export const USER_THEME: ThemeKey = 'user';

export function themeFor(name: string): ThemeKey {
  return CHARACTER_THEMES[name] ?? 'd';
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc -b`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/theme/characterThemes.ts
git commit -m "feat(velin): add character theme mapping"
```

---

## Phase 2: Shared Components

All components live in `frontend/src/components/velin/<Name>/` with `<Name>.tsx`, `<Name>.module.css`, and `index.ts`. Each component takes props and is fully self-contained — no implicit dependencies on app state.

### Task 2.1: Avatar component

**Files:**
- Create: `frontend/src/components/velin/Avatar/Avatar.tsx`
- Create: `frontend/src/components/velin/Avatar/Avatar.module.css`
- Create: `frontend/src/components/velin/Avatar/index.ts`

- [ ] **Step 1: Write Avatar.module.css**

```css
/* Mirrors .avatar / .avatar.user / .avatar.<theme> in prototype.html */

.root {
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text);
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
}

.ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, var(--ring-from, transparent), var(--ring-to, transparent) 70%);
  opacity: 0.9;
  pointer-events: none;
}

.label {
  position: relative;
  z-index: 1;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
}

.size-sm { width: 30px; height: 30px; font-size: 11px; }
.size-md { width: 40px; height: 40px; font-size: 13px; }
.size-lg { width: 52px; height: 52px; font-size: 17px; }
.size-xl { width: 86px; height: 86px; font-size: 30px; }

.theme-a { background: var(--a-grad); }
.theme-b { background: var(--b-grad); }
.theme-c { background: var(--c-grad); }
.theme-d { background: var(--d-grad); }
.theme-user {
  background: var(--user-grad);
  color: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.theme-a .ring { --ring-from: var(--a-2); --ring-to: rgba(135, 169, 143, 0.1); }
.theme-b .ring { --ring-from: var(--b-2); --ring-to: rgba(197, 212, 224, 0.1); }
.theme-c .ring { --ring-from: var(--c-2); --ring-to: rgba(197, 181, 208, 0.1); }
.theme-d .ring { --ring-from: var(--d-2); --ring-to: rgba(232, 217, 192, 0.1); }
```

- [ ] **Step 2: Write Avatar.tsx**

```tsx
import { CSSProperties } from 'react';
import styles from './Avatar.module.css';

type Size = 'sm' | 'md' | 'lg' | 'xl';
type Theme = 'a' | 'b' | 'c' | 'd' | 'user';

interface AvatarProps {
  theme: Theme;
  label: string;            // 1–2 chars (Chinese first character or "我")
  size?: Size;
  showRing?: boolean;       // default true; false for inline use
  style?: CSSProperties;
  onClick?: () => void;
  ariaLabel?: string;
}

export default function Avatar({
  theme,
  label,
  size = 'md',
  showRing = true,
  style,
  onClick,
  ariaLabel,
}: AvatarProps) {
  const sizeClass = {
    sm: styles['size-sm'],
    md: styles['size-md'],
    lg: styles['size-lg'],
    xl: styles['size-xl'],
  }[size];
  const themeClass = styles[`theme-${theme}`];

  return (
    <div
      className={[styles.root, sizeClass, themeClass].filter(Boolean).join(' ')}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={ariaLabel}
    >
      {showRing && <span className={styles.ring} aria-hidden="true" />}
      <span className={styles.label}>{label}</span>
    </div>
  );
}
```

- [ ] **Step 3: Write index.ts**

```ts
export { default } from './Avatar';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/velin/Avatar
git commit -m "feat(velin): add Avatar component (5 themes × 4 sizes)"
```

---

### Task 2.2: CharacterCard component

**Files:**
- Create: `frontend/src/components/velin/CharacterCard/CharacterCard.tsx`
- Create: `frontend/src/components/velin/CharacterCard/CharacterCard.module.css`
- Create: `frontend/src/components/velin/CharacterCard/index.ts`

- [ ] **Step 1: Write CharacterCard.module.css**

```css
/* Mirrors .character-card in prototype.html (Home screen) */
.root {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3);
  border-radius: var(--r-lg);
  background: var(--glass-1);
  border: 1px solid var(--hair);
  margin-bottom: var(--s-2);
  position: relative;
  overflow: hidden;
  transition: background var(--dur-quick) var(--ease);
  cursor: pointer;
}
.root:active {
  background: var(--glass-2);
}
.root::before {
  content: "";
  position: absolute;
  left: 0; top: 16px; bottom: 16px;
  width: 2px;
  border-radius: 2px;
  background: var(--accent);
  opacity: 0.7;
}
.theme-a::before { background: var(--a-2); }
.theme-b::before { background: var(--b-2); }
.theme-c::before { background: var(--c-2); }
.theme-d::before { background: var(--d-2); }

.meta {
  flex: 1;
  min-width: 0;
}
.top {
  display: flex;
  align-items: baseline;
  gap: var(--s-2);
  margin-bottom: 2px;
}
.name {
  font-size: var(--t-headline);
  font-weight: 600;
  color: var(--text);
  letter-spacing: var(--track-tight);
}
.tag {
  font-size: var(--t-micro);
  color: var(--text-dim);
  padding: 2px 6px;
  border-radius: var(--r-sm);
  background: var(--glass-1);
  border: 1px solid var(--hair);
  letter-spacing: var(--track-loose);
}
.time {
  margin-left: auto;
  font-size: var(--t-caption);
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}
.bottom {
  display: flex;
  align-items: center;
  gap: var(--s-2);
}
.preview {
  flex: 1;
  font-size: var(--t-sub);
  color: var(--text-mute);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.unread {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--r-pill);
  background: var(--unread);
  color: white;
  font-size: var(--t-micro);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 2: Write CharacterCard.tsx**

```tsx
import { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../Avatar';
import styles from './CharacterCard.module.css';
import { ThemeKey, themeFor } from '../../../theme/characterThemes';

interface CharacterCardProps {
  id: string;
  name: string;
  tagline?: string;          // optional secondary tag chip
  preview: string;           // last message preview
  time: string;              // formatted time string ("14:32" / "昨天" / "周一")
  unread?: number;           // unread count, 0 hides the badge
  online?: boolean;          // show green dot
  style?: CSSProperties;
}

export default function CharacterCard({
  id, name, tagline, preview, time, unread = 0, online = false, style,
}: CharacterCardProps) {
  const navigate = useNavigate();
  const theme: ThemeKey = themeFor(name);
  const firstChar = name.charAt(0);

  return (
    <div
      className={[styles.root, styles[`theme-${theme}`]].join(' ')}
      style={style}
      onClick={() => navigate(`/chat/${id}`)}
      role="button"
    >
      <Avatar theme={theme} label={firstChar} size="lg" />
      <div className={styles.meta}>
        <div className={styles.top}>
          <span className={styles.name}>{name}</span>
          {tagline && <span className={styles.tag}>{tagline}</span>}
          <span className={styles.time}>{time}</span>
        </div>
        <div className={styles.bottom}>
          <span className={styles.preview}>{preview}</span>
          {unread > 0 && <span className={styles.unread}>{unread}</span>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write index.ts**

```ts
export { default } from './CharacterCard';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/velin/CharacterCard
git commit -m "feat(velin): add CharacterCard component"
```

---

### Task 2.3: SearchPill component

**Files:**
- Create: `frontend/src/components/velin/SearchPill/SearchPill.tsx`
- Create: `frontend/src/components/velin/SearchPill/SearchPill.module.css`
- Create: `frontend/src/components/velin/SearchPill/index.ts`

- [ ] **Step 1: Write SearchPill.module.css**

```css
/* Mirrors .search-pill in prototype.html */
.root {
  height: 34px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  background: var(--glass-1);
  border: 1px solid var(--hair);
  border-radius: var(--r-pill);
  color: var(--text-mute);
  font-size: 12.5px;
  letter-spacing: 0.01em;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--dur-base) var(--ease);
}
.root:hover, .root:focus-visible {
  background: var(--glass-2);
  outline: none;
}
.icon { color: var(--text-dim); flex-shrink: 0; }
.label { color: var(--text-dim); }
```

- [ ] **Step 2: Write SearchPill.tsx**

```tsx
import styles from './SearchPill.module.css';

interface SearchPillProps {
  onClick: () => void;       // opens SearchModal
  label?: string;            // default "搜索"
}

export default function SearchPill({ onClick, label = '搜索' }: SearchPillProps) {
  return (
    <button className={styles.root} onClick={onClick} aria-label="搜索">
      <svg className={styles.icon} width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
```

- [ ] **Step 3: Write index.ts**

```ts
export { default } from './SearchPill';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/velin/SearchPill
git commit -m "feat(velin): add SearchPill component (Plan C entry)"
```

---

### Task 2.4: ChatBubble component

**Files:**
- Create: `frontend/src/components/velin/ChatBubble/ChatBubble.tsx`
- Create: `frontend/src/components/velin/ChatBubble/ChatBubble.module.css`
- Create: `frontend/src/components/velin/ChatBubble/index.ts`

- [ ] **Step 1: Write ChatBubble.module.css**

```css
/* Mirrors .msg-row.them / .msg-row.me / .msg-bubble in prototype.html */
.row {
  display: flex;
  gap: var(--s-2);
  align-items: flex-end;
  max-width: 100%;
}
.them { align-self: flex-start; max-width: 86%; }
.me   { align-self: flex-end; max-width: 86%; flex-direction: row-reverse; }

.bubble {
  padding: 10px 14px;
  border-radius: 20px;
  font-size: var(--t-callout);
  line-height: 1.45;
  letter-spacing: var(--track-normal);
  color: var(--text);
  position: relative;
  word-break: break-word;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.them .bubble {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--hair);
  border-bottom-left-radius: 6px;
}
.me .bubble {
  background: linear-gradient(135deg, var(--a-1) 0%, #4a7560 100%);
  border: 1px solid rgba(135, 169, 143, 0.30);
  border-bottom-right-radius: 6px;
  color: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8px 24px -12px rgba(45, 90, 74, 0.6);
}
/* Per-theme me-bubble tinting (used in group chat) */
.me.theme-b .bubble {
  background: linear-gradient(135deg, var(--b-1) 0%, #8aa1b6 100%);
  border-color: rgba(197, 212, 224, 0.30);
  box-shadow: 0 8px 24px -12px rgba(70, 100, 130, 0.6);
}
.me.theme-c .bubble {
  background: linear-gradient(135deg, var(--c-1) 0%, #8a78a3 100%);
  border-color: rgba(197, 181, 208, 0.30);
  box-shadow: 0 8px 24px -12px rgba(110, 90, 140, 0.6);
}
.me.theme-d .bubble {
  background: linear-gradient(135deg, var(--d-1) 0%, #b8a587 100%);
  border-color: rgba(232, 217, 192, 0.30);
  box-shadow: 0 8px 24px -12px rgba(150, 130, 100, 0.6);
}

.stamp {
  font-size: var(--t-micro);
  color: var(--text-dim);
  margin: 0 4px 4px;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}
.me .stamp { text-align: right; }
```

- [ ] **Step 2: Write ChatBubble.tsx**

```tsx
import { ReactNode } from 'react';
import styles from './ChatBubble.module.css';

type Sender = 'them' | 'me';
type Theme = 'a' | 'b' | 'c' | 'd';

interface ChatBubbleProps {
  sender: Sender;
  theme?: Theme;        // defaults to 'a' for private chat me-bubble
  avatar?: ReactNode;   // optional avatar (used for them in private; never for me)
  stamp?: string;       // optional timestamp below bubble
  children: ReactNode;
}

export default function ChatBubble({ sender, theme = 'a', avatar, stamp, children }: ChatBubbleProps) {
  const rowClass = [styles.row, styles[sender], sender === 'me' ? styles[`theme-${theme}`] : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rowClass}>
      {avatar}
      <div>
        <div className={styles.bubble}>{children}</div>
        {stamp && <div className={styles.stamp}>{stamp}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write index.ts**

```ts
export { default } from './ChatBubble';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/velin/ChatBubble
git commit -m "feat(velin): add ChatBubble component (them/me, 4 themes)"
```

---

### Task 2.5: ChatHeader component

**Files:**
- Create: `frontend/src/components/velin/ChatHeader/ChatHeader.tsx`
- Create: `frontend/src/components/velin/ChatHeader/ChatHeader.module.css`
- Create: `frontend/src/components/velin/ChatHeader/index.ts`

- [ ] **Step 1: Write ChatHeader.module.css**

```css
/* Mirrors .chat-header in prototype.html */
.root {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: 10px var(--s-4);
  min-height: 52px;
}
.btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  background: rgba(0, 0, 0, 0.32);
  border: 1px solid rgba(255, 255, 255, 0.12);
  flex-shrink: 0;
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: var(--t-headline);
  font-weight: 600;
  color: var(--text);
  letter-spacing: var(--track-tight);
  line-height: 1.1;
}
.status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--t-micro);
  color: var(--text-mute);
  margin-top: 2px;
}
.dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--online);
  box-shadow: 0 0 6px var(--online);
}
.avatar-stack {
  position: relative;
  width: 40px; height: 30px;
  flex-shrink: 0;
}
.avatar-stack > * { position: absolute; }
.avatar-stack > *:first-child { left: 0; top: 0; }
.avatar-stack > *:last-child { right: 0; bottom: 0; }
```

- [ ] **Step 2: Write ChatHeader.tsx**

```tsx
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ChatHeader.module.css';

interface ChatHeaderProps {
  title: string;
  subtitle?: string;     // e.g., "在线 · 3 分钟前对话" or "图书馆 · 午后"
  live?: boolean;        // show green online dot
  showBack?: boolean;    // default true
  onBack?: () => void;
  right?: ReactNode;     // optional right-side action (e.g., a more button)
  avatars?: ReactNode[]; // optional 2-element stack (group chat)
}

export default function ChatHeader({
  title, subtitle, live, showBack = true, onBack, right, avatars,
}: ChatHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className={styles.root}>
      {showBack && (
        <button
          className={styles.btn}
          aria-label="返回"
          onClick={() => (onBack ? onBack() : navigate(-1))}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      {avatars && avatars.length > 0 && (
        <div className={styles['avatar-stack']}>
          {avatars.slice(0, 2)}
        </div>
      )}
      <div className={styles.info}>
        <div className={styles.name}>{title}</div>
        {subtitle && (
          <div className={styles.status}>
            {live && <span className={styles.dot} aria-hidden="true" />}
            <span>{subtitle}</span>
          </div>
        )}
      </div>
      {right ?? (
        <button className={styles.btn} aria-label="更多">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5" cy="12" r="1.2" />
            <circle cx="12" cy="12" r="1.2" />
            <circle cx="19" cy="12" r="1.2" />
          </svg>
        </button>
      )}
    </header>
  );
}
```

- [ ] **Step 3: Write index.ts**

```ts
export { default } from './ChatHeader';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/velin/ChatHeader
git commit -m "feat(velin): add ChatHeader component"
```

---

### Task 2.6: ChatInput component

**Files:**
- Create: `frontend/src/components/velin/ChatInput/ChatInput.tsx`
- Create: `frontend/src/components/velin/ChatInput/ChatInput.module.css`
- Create: `frontend/src/components/velin/ChatInput/index.ts`

- [ ] **Step 1: Write ChatInput.module.css**

```css
/* Mirrors .chat-input in prototype.html */
.root {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: var(--s-2) var(--s-3);
  min-height: 56px;
}
.icon-btn {
  width: 36px; height: 36px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-2);
  background: var(--glass-1);
  border: 1px solid var(--hair);
  flex-shrink: 0;
}
.field {
  flex: 1;
  min-width: 0;
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  background: var(--glass-1);
  border: 1px solid var(--hair);
  border-radius: var(--r-pill);
  color: var(--text-mute);
  font-size: var(--t-sub);
  cursor: text;
}
.field-input {
  width: 100%;
  height: 100%;
  font-size: var(--t-sub);
  color: var(--text);
}
.field-input::placeholder { color: var(--text-mute); }
.send {
  background: linear-gradient(135deg, var(--accent) 0%, #c0c0c8 100%);
  color: var(--canvas);
  border-color: transparent;
}
```

- [ ] **Step 2: Write ChatInput.tsx**

```tsx
import { KeyboardEvent, useState } from 'react';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  onSend: (text: string) => void;
  onPlus?: () => void;
  onMic?: () => void;
  placeholder?: string;
}

export default function ChatInput({ onSend, onPlus, onMic, placeholder = '说点什么…' }: ChatInputProps) {
  const [text, setText] = useState('');

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.root}>
      <button className={styles['icon-btn']} aria-label="附件" onClick={onPlus}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <div className={styles.field}>
        <input
          className={styles['field-input']}
          placeholder={placeholder}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
        />
      </div>
      <button className={styles['icon-btn']} aria-label="语音" onClick={onMic}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
        </svg>
      </button>
      <button
        className={[styles['icon-btn'], styles.send].join(' ')}
        aria-label="发送"
        onClick={submit}
        disabled={text.trim().length === 0}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l14-7-6 16-2-7-6-2z" />
        </svg>
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Write index.ts**

```ts
export { default } from './ChatInput';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/velin/ChatInput
git commit -m "feat(velin): add ChatInput component"
```

---

### Task 2.7: StatRing component (好感度 / 亲密度)

**Files:**
- Create: `frontend/src/components/velin/StatRing/StatRing.tsx`
- Create: `frontend/src/components/velin/StatRing/StatRing.module.css`
- Create: `frontend/src/components/velin/StatRing/index.ts`

- [ ] **Step 1: Write StatRing.module.css**

```css
/* Mirrors .stat .ring in prototype.html */
.root {
  padding: 14px 10px 12px;
  border-radius: var(--r-md);
  background: var(--glass-1);
  border: 1px solid var(--hair);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
  overflow: hidden;
  flex: 1;
}
.root::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: var(--accent, var(--hair-2));
  opacity: 0.5;
}
.theme-a { --accent: var(--a-2); }
.theme-b { --accent: var(--b-2); }
.theme-c { --accent: var(--c-2); }
.theme-d { --accent: var(--d-2); }

.ring {
  width: 56px; height: 56px;
  position: relative;
}
.ring svg { transform: rotate(-90deg); }
.track { stroke: var(--glass-2); }
.bar {
  stroke: var(--accent);
  stroke-linecap: round;
  filter: drop-shadow(0 0 4px var(--accent));
  transition: stroke-dashoffset var(--dur-slow) var(--ease);
}
.val {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.lbl {
  font-size: var(--t-caption);
  color: var(--text-mute);
  letter-spacing: var(--track-caps);
  text-transform: uppercase;
}
```

- [ ] **Step 2: Write StatRing.tsx**

```tsx
import styles from './StatRing.module.css';

type Theme = 'a' | 'b' | 'c' | 'd';

interface StatRingProps {
  theme: Theme;
  value: number;          // 0–100
  max?: number;           // default 100
  label: string;
  size?: number;          // px, default 56
}

export default function StatRing({ theme, value, max = 100, label, size = 56 }: StatRingProps) {
  const r = (size - 8) / 2;            // ring radius (stroke width 4 → diameter = r*2 + 4 each side, leave 2px margin)
  const C = 2 * Math.PI * r;
  const offset = C * (1 - Math.min(value, max) / max);

  return (
    <div className={[styles.root, styles[`theme-${theme}`]].join(' ')}>
      <div className={styles.ring}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle className={styles.track} cx={size / 2} cy={size / 2} r={r}
                  fill="none" strokeWidth="4" />
          <circle className={styles.bar} cx={size / 2} cy={size / 2} r={r}
                  fill="none" strokeWidth="4"
                  strokeDasharray={C} strokeDashoffset={offset} />
        </svg>
        <div className={styles.val}>{value}</div>
      </div>
      <div className={styles.lbl}>{label}</div>
    </div>
  );
}
```

- [ ] **Step 3: Write index.ts**

```ts
export { default } from './StatRing';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/velin/StatRing
git commit -m "feat(velin): add StatRing component (好感度/亲密度)"
```

---

### Task 2.8: StatCount component (珍藏 big number)

**Files:**
- Create: `frontend/src/components/velin/StatCount/StatCount.tsx`
- Create: `frontend/src/components/velin/StatCount/StatCount.module.css`
- Create: `frontend/src/components/velin/StatCount/index.ts`

- [ ] **Step 1: Write StatCount.module.css**

```css
/* Mirrors .stat.d.count in prototype.html */
.root {
  flex: 1;
  padding: 12px 10px 10px;
  border-radius: var(--r-md);
  background: var(--glass-1);
  border: 1px solid var(--hair);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  position: relative;
  overflow: hidden;
}
.root::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: var(--accent, var(--hair-2));
  opacity: 0.5;
}
.theme-d { --accent: var(--d-2); }
.theme-a { --accent: var(--a-2); }
.theme-b { --accent: var(--b-2); }
.theme-c { --accent: var(--c-2); }

.big {
  font-size: 32px;
  font-weight: 600;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.04em;
  line-height: 1;
  background: linear-gradient(180deg, var(--text) 0%, var(--text-mute) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 12px var(--accent));
}
.lbl {
  font-size: var(--t-caption);
  color: var(--text-mute);
  letter-spacing: var(--track-caps);
  text-transform: uppercase;
  margin-top: 6px;
}
.unit {
  font-size: var(--t-micro);
  color: var(--text-dim);
  letter-spacing: 0.04em;
  margin-top: 2px;
}
```

- [ ] **Step 2: Write StatCount.tsx**

```tsx
import styles from './StatCount.module.css';

type Theme = 'a' | 'b' | 'c' | 'd';

interface StatCountProps {
  theme?: Theme;          // default 'd' (warm cream)
  value: number;
  label: string;          // e.g., "珍藏"
  unit: string;           // e.g., "个故事"
}

export default function StatCount({ theme = 'd', value, label, unit }: StatCountProps) {
  return (
    <div className={[styles.root, styles[`theme-${theme}`]].join(' ')}>
      <div className={styles.big}>{value}</div>
      <div className={styles.lbl}>{label}</div>
      <div className={styles.unit}>{unit}</div>
    </div>
  );
}
```

- [ ] **Step 3: Write index.ts**

```ts
export { default } from './StatCount';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/velin/StatCount
git commit -m "feat(velin): add StatCount component (珍藏)"
```

---

### Task 2.9: MemoryCard component

**Files:**
- Create: `frontend/src/components/velin/MemoryCard/MemoryCard.tsx`
- Create: `frontend/src/components/velin/MemoryCard/MemoryCard.module.css`
- Create: `frontend/src/components/velin/MemoryCard/index.ts`

- [ ] **Step 1: Write MemoryCard.module.css**

```css
/* Mirrors .memory in prototype.html */
.root {
  display: flex;
  gap: var(--s-3);
  padding: var(--s-3);
  border-radius: var(--r-md);
  background: var(--glass-1);
  border: 1px solid var(--hair);
  position: relative;
  overflow: hidden;
}
.root::before {
  content: "";
  position: absolute;
  left: 0; top: 12px; bottom: 12px;
  width: 2px;
  border-radius: 2px;
  background: var(--accent, var(--c-2));
  opacity: 0.7;
}
.theme-a { --accent: var(--a-2); }
.theme-b { --accent: var(--b-2); }
.theme-c { --accent: var(--c-2); }
.theme-d { --accent: var(--d-2); }

.date {
  font-size: var(--t-micro);
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  padding-top: 2px;
}
.body { flex: 1; min-width: 0; }
.text {
  font-size: var(--t-callout);
  color: var(--text);
  line-height: 1.5;
  margin-bottom: 4px;
}
.tag {
  display: inline-block;
  font-size: var(--t-micro);
  color: var(--text-dim);
  padding: 2px 8px;
  border-radius: var(--r-pill);
  background: var(--glass-1);
  border: 1px solid var(--hair);
  letter-spacing: var(--track-loose);
}
```

- [ ] **Step 2: Write MemoryCard.tsx**

```tsx
import { ThemeKey } from '../../../theme/characterThemes';
import styles from './MemoryCard.module.css';

interface MemoryCardProps {
  date: string;            // "2025.12.10"
  text: string;            // memory body
  tag?: string;            // optional category tag ("初次对话")
  theme?: ThemeKey;        // optional accent; default 'c'
}

export default function MemoryCard({ date, text, tag, theme = 'c' }: MemoryCardProps) {
  return (
    <div className={[styles.root, styles[`theme-${theme}`]].join(' ')}>
      <div className={styles.date}>{date}</div>
      <div className={styles.body}>
        <div className={styles.text}>{text}</div>
        {tag && <span className={styles.tag}>{tag}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write index.ts**

```ts
export { default } from './MemoryCard';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/velin/MemoryCard
git commit -m "feat(velin): add MemoryCard component"
```

---

### Task 2.10: TabBar component (4 tabs: 消息/群聊/创作/我的)

**Files:**
- Create: `frontend/src/components/velin/TabBar/TabBar.tsx`
- Create: `frontend/src/components/velin/TabBar/TabBar.module.css`
- Create: `frontend/src/components/velin/TabBar/index.ts`

- [ ] **Step 1: Write TabBar.module.css**

```css
/* Mirrors nav.tabbar in prototype.html */
.root {
  position: relative;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom, 0));
  background: rgba(22, 22, 26, 0.72);
  border-top: 1px solid var(--hair);
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
  color: var(--text-mute);
  position: relative;
  font-size: var(--t-caption);
  letter-spacing: 0.02em;
  transition: color var(--dur-quick) var(--ease);
}
.tab.active { color: var(--text); }
.tab.active::before {
  content: "";
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 2px;
  border-radius: 0 0 2px 2px;
  background: var(--text);
}
.lbl { font-size: var(--t-caption); }
.tab.active .lbl { font-weight: 600; }
.home-indicator {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 134px;
  height: 5px;
  border-radius: 3px;
  background: var(--text);
  opacity: 0.4;
  pointer-events: none;
}
```

- [ ] **Step 2: Write TabBar.tsx**

```tsx
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './TabBar.module.css';

type TabKey = 'messages' | 'group' | 'create' | 'profile';

interface Tab {
  key: TabKey;
  label: string;
  path: string;
  icon: JSX.Element;
}

const TABS: Tab[] = [
  { key: 'messages', label: '消息', path: '/',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-1 4 8.5 8.5 0 0 1-7.6 4.5 8.4 8.4 0 0 1-4-1L3 21l1.9-5.4a8.4 8.4 0 0 1-1-4 8.5 8.5 0 0 1 4.5-7.6 8.4 8.4 0 0 1 4-1h.5a8.5 8.5 0 0 1 8 8v.5z"/></svg> },
  { key: 'group', label: '群聊', path: '/group',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M14 20a4.5 4.5 0 0 1 8 0"/></svg> },
  { key: 'create', label: '创作', path: '/character/new',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg> },
  { key: 'profile', label: '我的', path: '/profile',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg> },
];

export default function TabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path: string): boolean => {
    if (path === '/') return pathname === '/';
    if (path === '/group') return pathname.startsWith('/group');
    if (path === '/character/new') return pathname.startsWith('/character');
    if (path === '/profile') return pathname.startsWith('/profile');
    return false;
  };

  return (
    <nav className={styles.root} aria-label="主导航">
      {TABS.map(t => (
        <button
          key={t.key}
          className={[styles.tab, isActive(t.path) ? styles.active : ''].join(' ')}
          onClick={() => navigate(t.path)}
        >
          {t.icon}
          <span className={styles.lbl}>{t.label}</span>
        </button>
      ))}
      <div className={styles['home-indicator']} aria-hidden="true" />
    </nav>
  );
}
```

- [ ] **Step 3: Write index.ts**

```ts
export { default } from './TabBar';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/velin/TabBar
git commit -m "feat(velin): add TabBar (4 tabs: 消息/群聊/创作/我的)"
```

---

## Phase 3: App Shell + Brand Wordmark

### Task 3.1: Wordmark component

**Files:**
- Create: `frontend/src/components/velin/Wordmark/Wordmark.tsx`
- Create: `frontend/src/components/velin/Wordmark/Wordmark.module.css`
- Create: `frontend/src/components/velin/Wordmark/index.ts`

- [ ] **Step 1: Write Wordmark.module.css**

```css
.root {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-family: var(--font-display);
  letter-spacing: -0.02em;
}
.fr {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}
.dot {
  color: var(--text-dim);
  font-size: 16px;
  margin: 0 2px;
}
.cn {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-mute);
  letter-spacing: 0.1em;
}
```

- [ ] **Step 2: Write Wordmark.tsx**

```tsx
import styles from './Wordmark.module.css';

interface WordmarkProps {
  size?: 'sm' | 'md';
}

export default function Wordmark({ size = 'md' }: WordmarkProps) {
  return (
    <span className={styles.root} aria-label="Vélin · 尺素">
      <span className={styles.fr} style={size === 'sm' ? { fontSize: 15 } : undefined}>Vélin</span>
      <span className={styles.dot}>·</span>
      <span className={styles.cn} style={size === 'sm' ? { fontSize: 13 } : undefined}>尺素</span>
    </span>
  );
}
```

- [ ] **Step 3: Write index.ts**

```ts
export { default } from './Wordmark';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/velin/Wordmark
git commit -m "feat(velin): add Vélin · 尺素 wordmark"
```

---

### Task 3.2: AppShell component

**Files:**
- Create: `frontend/src/components/AppShell/AppShell.tsx`
- Create: `frontend/src/components/AppShell/AppShell.module.css`
- Create: `frontend/src/components/AppShell/index.ts`

- [ ] **Step 1: Write AppShell.module.css**

```css
.shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  position: relative;
  background: var(--canvas);
  overflow: hidden;
}
.scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  position: relative;
}
.scroll-no-tab {
  /* variant for pages that don't want a bottom tab bar (e.g. chat) */
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: var(--canvas);
  overflow: hidden;
}
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
  will-change: transform;
}
.blob-a {
  width: 360px; height: 360px;
  background: radial-gradient(circle, var(--a-1) 0%, transparent 70%);
  top: -120px; left: -80px;
  animation: bob-a 16s var(--ease) infinite;
}
.blob-b {
  width: 320px; height: 320px;
  background: radial-gradient(circle, var(--c-1) 0%, transparent 70%);
  bottom: -100px; right: -80px;
  animation: bob-b 18s var(--ease) infinite;
}
@keyframes bob-a {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(40px, 30px) scale(1.08); }
}
@keyframes bob-b {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(-30px, -40px) scale(1.06); }
}
.content {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
```

- [ ] **Step 2: Write AppShell.tsx**

```tsx
import { ReactNode, CSSProperties } from 'react';
import TabBar from '../velin/TabBar';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
  showTabBar?: boolean;     // default true
  showBlobs?: boolean;      // default true; chat pages may want their own theme
  blobTheme?: 'a' | 'b' | 'c' | 'd' | 'user';  // controls which colors show
  style?: CSSProperties;
}

export default function AppShell({
  children, showTabBar = true, showBlobs = true, blobTheme = 'a', style,
}: AppShellProps) {
  return (
    <div className={styles.shell} style={style} data-theme={blobTheme}>
      {showBlobs && (
        <div className={styles.bg} aria-hidden="true">
          <div className={`${styles.blob} ${styles['blob-a']}`} />
          <div className={`${styles.blob} ${styles['blob-b']}`} />
        </div>
      )}
      <div className={styles.content}>
        {children}
      </div>
      {showTabBar && <TabBar />}
    </div>
  );
}
```

- [ ] **Step 3: Write index.ts**

```ts
export { default } from './AppShell';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AppShell
git commit -m "feat(velin): add AppShell (canvas + ambient blobs + TabBar)"
```

---

### Task 3.3: Update App.tsx to mount AppShell and add /character/:id detail route

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add detail route + import (modify App.tsx)**

Find the `RequireAuth` route block and modify it. Specifically:
1. Add the import for the new `CharacterDetail` page (we'll create it in Phase 7 — add the import as a placeholder now; alternatively, defer this import until Phase 7).
2. Defer this task if CharacterDetail doesn't exist yet.

For this task, only add the import path comment — actual route is added in Phase 7 task 7.2.

- [ ] **Step 2: Commit (no change yet, just a checkpoint)**

```bash
git status
# Expect: nothing to commit (deferred to Phase 7)
```

(Engineer note: App.tsx's main routes are managed per-page; the AppShell wrap is applied at the page level, not in App.tsx. Skip this task if no immediate change is needed.)

- [ ] **Step 3: Defer (move on to Phase 4)**

---

## Phase 4: Home Page Rewrite

### Task 4.1: Replace Home.tsx with new design

**Files:**
- Modify: `frontend/src/pages/Home.tsx` (full rewrite)
- Create: `frontend/src/pages/Home.module.css`

- [ ] **Step 1: Write Home.module.css**

```css
/* Mirrors .phone .f1 nav in prototype.html */
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.nav {
  padding: 6px 24px 0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 8px 0 4px;
}
.title {
  font-size: var(--t-display);
  font-weight: 700;
  letter-spacing: var(--track-tight);
  color: var(--text);
  line-height: 1.05;
}
.actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.icon-btn {
  width: 38px; height: 38px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-2);
  background: var(--glass-1);
  border: 1px solid var(--hair);
}
.sub {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 2px 12px;
}
.label {
  font-size: var(--t-sub);
  color: var(--text-mute);
  letter-spacing: 0.02em;
}
.seg {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: var(--glass-1);
  border: 1px solid var(--hair);
  border-radius: var(--r-pill);
}
.seg-btn {
  font-size: 12px;
  font-weight: 500;
  padding: 5px 12px;
  border-radius: var(--r-pill);
  color: var(--text-mute);
  letter-spacing: 0.01em;
}
.seg-btn.active {
  background: var(--glass-3);
  color: var(--text);
  box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset;
}
.list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 100px;
  -webkit-overflow-scrolling: touch;
}
.empty {
  padding: 60px 24px;
  text-align: center;
  color: var(--text-mute);
  font-size: var(--t-sub);
}
.spinner {
  width: 24px; height: 24px;
  border: 2px solid var(--hair-2);
  border-top-color: var(--text);
  border-radius: 50%;
  margin: 80px auto;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

- [ ] **Step 2: Rewrite Home.tsx**

```tsx
import { useEffect, useState } from 'react';
import { charactersApi, groupsApi, extrasApi } from '../api/client';
import type { Character, Group } from '../api/types';
import AppShell from '../components/AppShell';
import CharacterCard from '../components/velin/CharacterCard';
import SearchPill from '../components/velin/SearchPill';
import SearchModal from '../components/velin/SearchModal';
import styles from './Home.module.css';

type Filter = 'all' | 'unread' | 'starred';

function timeAgo(iso: string | undefined, now = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const diff = now - t;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  if (diff < 7 * 86400_000) {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return `周${days[new Date(iso).getDay()]}`;
  }
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

export default function Home() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [extrasCount, setExtrasCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const c = await charactersApi.list();
        setCharacters(c.data);
        const counts: Record<string, number> = {};
        await Promise.all(c.data.map(async (ch: Character) => {
          try {
            const r = await extrasApi.list(ch.id);
            counts[ch.id] = r.data.length;
          } catch { counts[ch.id] = 0; }
        }));
        setExtrasCount(counts);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const total = characters.length;
  const unread = characters.filter(c => (c as any).unread_count > 0).length;

  return (
    <AppShell blobTheme="a">
      <div className={styles.page}>
        <div className={styles.nav}>
          <div className={styles['title-row']}>
            <h1 className={styles.title}>消息</h1>
            <div className={styles.actions}>
              <SearchPill onClick={() => setSearchOpen(true)} />
              <button
                className={styles['icon-btn']}
                aria-label="新建"
                onClick={() => { window.location.hash = '#/character/new'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          </div>
          <div className={styles.sub}>
            <div className={styles.label}>{total} 位角色 · {unread} 条未读</div>
            <div className={styles.seg} role="tablist">
              {(['all', 'unread', 'starred'] as Filter[]).map(f => (
                <button
                  key={f}
                  className={[styles['seg-btn'], filter === f ? styles.active : ''].join(' ')}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? '全部' : f === 'unread' ? '未读' : '星标'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.spinner} />
          ) : characters.length === 0 ? (
            <div className={styles.empty}>还没有角色,点 + 新建一个</div>
          ) : (
            characters
              .filter(c => filter === 'unread' ? (c as any).unread_count > 0 : true)
              .map(c => (
                <CharacterCard
                  key={c.id}
                  id={c.id}
                  name={c.name}
                  tagline={undefined}
                  preview={(c as any).last_message || '开始一段对话'}
                  time={timeAgo((c as any).last_message_at)}
                  unread={(c as any).unread_count || 0}
                  online={!!(c as any).online}
                />
              ))
          )}
        </div>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} characters={characters} />
    </AppShell>
  );
}
```

- [ ] **Step 3: Delete old Home.css**

```bash
git rm frontend/src/pages/Home.css
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Home.tsx frontend/src/pages/Home.module.css
git commit -m "feat(velin): rewrite Home with iOS 18 Premium design"
```

(Defer the import of SearchModal — it's defined in Phase 8. If you need to compile, temporarily comment out the import + usage, then uncomment in Phase 8.)

---

## Phase 5: Private Chat Rewrite

### Task 5.1: Replace Chat.tsx with new design

**Files:**
- Modify: `frontend/src/pages/Chat.tsx` (full rewrite)
- Create: `frontend/src/pages/Chat.module.css`

- [ ] **Step 1: Write Chat.module.css**

```css
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  -webkit-overflow-scrolling: touch;
}
.meta {
  text-align: center;
  font-size: var(--t-micro);
  color: var(--text-dim);
  margin: 4px 0 8px;
  letter-spacing: 0.02em;
}
.input-zone {
  flex-shrink: 0;
  background: var(--glass-1);
  border-top: 1px solid var(--hair);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
}
```

- [ ] **Step 2: Rewrite Chat.tsx**

(Engineer: keep all existing API calls — `/api/chat`, `loadMessages`, `sendMessage`, `generateChatResponse`. Only change the JSX layer to use the new components. The shape of `messages`, `character`, etc. is the same.)

```tsx
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { charactersApi, chatApi } from '../api/client';
import type { Character, Message } from '../api/types';
import AppShell from '../components/AppShell';
import ChatHeader from '../components/velin/ChatHeader';
import ChatBubble from '../components/velin/ChatBubble';
import ChatInput from '../components/velin/ChatInput';
import Avatar from '../components/velin/Avatar';
import { themeFor } from '../theme/characterThemes';
import styles from './Chat.module.css';

export default function Chat() {
  const { characterId = '' } = useParams();
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // === LOAD (keep existing logic from old Chat.tsx) ===
  useEffect(() => { /* ... existing load logic ... */ }, [characterId]);

  // === SCROLL TO BOTTOM ON NEW MESSAGES ===
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async (text: string) => {
    if (!character || sending) return;
    setSending(true);
    // ... existing send logic from old Chat.tsx ...
    setSending(false);
  };

  if (!character) {
    return (
      <AppShell showTabBar={false}>
        <div className={styles.page}><div className={styles.body} /></div>
      </AppShell>
    );
  }

  const theme = themeFor(character.name);
  const lastTime = messages.length > 0 ? new Date(messages[messages.length - 1].created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <AppShell showTabBar={false} blobTheme={theme}>
      <div className={styles.page}>
        <ChatHeader
          title={character.name}
          subtitle="在线 · 刚刚"
          live
        />
        <div className={styles.body} ref={scrollRef}>
          {messages.length > 0 && (
            <div className={styles.meta}>
              {new Date(messages[0].created_at).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          {messages.map((m, i) => {
            const isMe = m.role === 'user';
            const prev = messages[i - 1];
            const showMeta = !prev || prev.role !== m.role ||
              (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 60_000);
            return (
              <ChatBubble
                key={m.id || i}
                sender={isMe ? 'me' : 'them'}
                theme={isMe ? 'user' : theme}
                avatar={!isMe ? <Avatar theme={theme} label={character.name.charAt(0)} size="sm" /> : undefined}
                stamp={showMeta ? new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : undefined}
              >
                {m.content}
              </ChatBubble>
            );
          })}
        </div>
        <div className={styles['input-zone']}>
          <ChatInput onSend={send} />
        </div>
      </div>
    </AppShell>
  );
}
```

(Engineer: fill in the `load` / `send` / `useEffect` blocks with the **existing** logic from the old `Chat.tsx`. Do not change the API calls. Only the JSX changes.)

- [ ] **Step 3: Delete old Chat.css**

```bash
git rm frontend/src/pages/Chat.css
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Chat.tsx frontend/src/pages/Chat.module.css
git commit -m "feat(velin): rewrite Chat with iOS 18 Premium design (both-side avatars)"
```

---

## Phase 6: Group Chat Rewrite

### Task 6.1: Replace GroupChat.tsx with new design

**Files:**
- Modify: `frontend/src/pages/GroupChat.tsx` (full rewrite)
- Create: `frontend/src/pages/GroupChat.module.css`

- [ ] **Step 1: Write GroupChat.module.css**

```css
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  -webkit-overflow-scrolling: touch;
}
.meta {
  text-align: center;
  font-size: var(--t-micro);
  color: var(--text-dim);
  margin: 4px 0 8px;
}
.input-zone {
  flex-shrink: 0;
  background: var(--glass-1);
  border-top: 1px solid var(--hair);
  backdrop-filter: blur(24px) saturate(180%);
}
```

- [ ] **Step 2: Rewrite GroupChat.tsx**

(Engineer: keep existing load/send logic. Only change JSX. Each group member's bubble gets that member's theme — pass the character's theme key to ChatBubble's `theme` prop.)

```tsx
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { groupsApi, chatApi } from '../api/client';
import type { Group, Character, Message } from '../api/types';
import AppShell from '../components/AppShell';
import ChatHeader from '../components/velin/ChatHeader';
import ChatBubble from '../components/velin/ChatBubble';
import ChatInput from '../components/velin/ChatInput';
import Avatar from '../components/velin/Avatar';
import { themeFor } from '../theme/characterThemes';
import styles from './GroupChat.module.css';

export default function GroupChat() {
  const { groupId = '' } = useParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Character[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  // ... existing state and effects ...

  if (!group) return <AppShell showTabBar={false}><div /></AppShell>;

  // Take first 2 members for the avatar stack in the header
  const headerAvatars = members.slice(0, 2).map(m => (
    <Avatar key={m.id} theme={themeFor(m.name)} label={m.name.charAt(0)} size="sm"
            style={{ width: 28, height: 28, fontSize: 10, boxShadow: `0 0 0 2px var(--canvas)` }} />
  ));

  return (
    <AppShell showTabBar={false}>
      <div className={styles.page}>
        <ChatHeader
          title={group.name}
          subtitle={group.scene_label || `${members.length} 位角色`}
          showBack
          avatars={headerAvatars}
        />
        <div className={styles.body} ref={scrollRef}>
          {messages.map((m, i) => {
            // Look up which character said this message
            const speaker = members.find(c => c.id === m.character_id);
            const speakerName = speaker?.name || m.sender_name || '?';
            const isMe = !speaker;       // user messages have no character_id
            const theme = speaker ? themeFor(speakerName) : 'user';
            return (
              <ChatBubble
                key={m.id || i}
                sender={isMe ? 'me' : 'them'}
                theme={isMe ? 'user' : theme}
                avatar={!isMe
                  ? <Avatar theme={theme} label={speakerName.charAt(0)} size="sm" />
                  : <Avatar theme="user" label="我" size="sm" />}
                stamp={new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              >
                {!isMe && <div style={{ fontSize: 11, color: 'var(--text-mute)', marginBottom: 2 }}>{speakerName}</div>}
                {m.content}
              </ChatBubble>
            );
          })}
        </div>
        <div className={styles['input-zone']}>
          <ChatInput onSend={send} />
        </div>
      </div>
    </AppShell>
  );
}
```

(Engineer: fill in the `load` / `send` effects with existing logic from old `GroupChat.tsx`.)

- [ ] **Step 3: Delete old GroupChat.css (if exists)**

```bash
git ls-files frontend/src/pages/ | grep -i groupchat
# If GroupChat.css exists:
git rm frontend/src/pages/GroupChat.css
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/GroupChat.tsx frontend/src/pages/GroupChat.module.css
git commit -m "feat(velin): rewrite GroupChat with iOS 18 Premium design"
```

---

## Phase 7: Character Detail Page (NEW)

### Task 7.1: Create CharacterDetail page

**Files:**
- Create: `frontend/src/pages/CharacterDetail.tsx`
- Create: `frontend/src/pages/CharacterDetail.module.css`

- [ ] **Step 1: Write CharacterDetail.module.css**

```css
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.hero {
  height: 340px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--s-3);
  overflow: hidden;
}
.hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--hero-grad, var(--canvas));
  z-index: 0;
}
.hero::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 40%, rgba(255,255,255,0.08) 0%, transparent 60%);
  z-index: 0;
}
.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-2);
  animation: fade-up 0.9s var(--ease) both;
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.hero-name {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
  margin-top: 6px;
}
.hero-tag {
  font-size: var(--t-micro);
  color: var(--text-mute);
  padding: 3px 10px;
  border-radius: var(--r-pill);
  background: var(--glass-1);
  border: 1px solid var(--hair);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.body {
  padding: var(--s-5) var(--s-4) var(--s-7);
  display: flex;
  flex-direction: column;
  gap: var(--s-5);
  background: var(--canvas);
}
.desc {
  font-size: var(--t-body);
  line-height: 1.6;
  color: var(--text-2);
}
.stats-row {
  display: flex;
  gap: 10px;
}
.section-title {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0 2px;
}
.section-title h3 {
  font-size: var(--t-headline);
  font-weight: 600;
  color: var(--text);
  letter-spacing: -0.01em;
}
.more {
  font-size: var(--t-sub);
  color: var(--text-mute);
}
.memories {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}
.actions {
  position: sticky;
  bottom: 0;
  display: flex;
  gap: var(--s-2);
  padding: var(--s-3) 0 calc(var(--s-3) + env(safe-area-inset-bottom, 0));
  background: rgba(22, 22, 26, 0.72);
  border-top: 1px solid var(--hair);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  margin: 0 calc(-1 * var(--s-4));
  padding-left: var(--s-4);
  padding-right: var(--s-4);
}
.btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 44px;
  border-radius: var(--r-pill);
  font-size: var(--t-callout);
  font-weight: 500;
  color: var(--text);
  background: var(--glass-1);
  border: 1px solid var(--hair);
}
.btn-primary {
  background: linear-gradient(135deg, var(--accent) 0%, #c0c0c8 100%);
  color: var(--canvas);
  border-color: transparent;
  font-weight: 600;
}
```

- [ ] **Step 2: Write CharacterDetail.tsx**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { charactersApi, affinityApi, memoriesApi } from '../api/client';
import type { Character, AffinityState } from '../api/types';
import AppShell from '../components/AppShell';
import ChatHeader from '../components/velin/ChatHeader';
import Avatar from '../components/velin/Avatar';
import StatRing from '../components/velin/StatRing';
import StatCount from '../components/velin/StatCount';
import MemoryCard from '../components/velin/MemoryCard';
import { themeFor, ThemeKey } from '../theme/characterThemes';
import styles from './CharacterDetail.module.css';

export default function CharacterDetail() {
  const { characterId = '' } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character | null>(null);
  const [affinity, setAffinity] = useState<AffinityState | null>(null);
  const [memoryCount, setMemoryCount] = useState(0);
  const [recentMemories, setRecentMemories] = useState<Array<{ date: string; text: string; tag?: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const c = await charactersApi.get(characterId);
        setCharacter(c.data);
        try {
          const a = await affinityApi.get(characterId);
          setAffinity(a.data);
        } catch { /* no affinity yet */ }
        try {
          const m = await memoriesApi.list(characterId);
          setMemoryCount(m.data.length);
          setRecentMemories(m.data.slice(0, 3).map((mem: any) => ({
            date: new Date(mem.created_at).toLocaleDateString('zh-CN'),
            text: mem.summary || mem.content,
            tag: mem.tag,
          })));
        } catch { /* no memories yet */ }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [characterId]);

  if (!character) {
    return (
      <AppShell showTabBar={false}>
        <div className={styles.page} />
      </AppShell>
    );
  }

  const theme: ThemeKey = themeFor(character.name);
  const heroStyle: React.CSSProperties = ({
    '--hero-grad':
      theme === 'a' ? 'linear-gradient(180deg, #2a4434 0%, #16161a 100%)' :
      theme === 'b' ? 'linear-gradient(180deg, #2c3a4a 0%, #16161a 100%)' :
      theme === 'c' ? 'linear-gradient(180deg, #3a2c4a 0%, #16161a 100%)' :
                      'linear-gradient(180deg, #4a3c2c 0%, #16161a 100%)',
  } as React.CSSProperties);

  return (
    <AppShell showTabBar={false} blobTheme={theme}>
      <div className={styles.page}>
        <div className={styles.hero} style={heroStyle} data-theme={theme}>
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
            <ChatHeader title="" showBack />
          </div>
          <div className={styles['hero-content']}>
            <Avatar theme={theme} label={character.name.charAt(0)} size="xl" />
            <div className={styles['hero-name']}>{character.name}</div>
            <div className={styles['hero-tag']}>{character.description || '角色'}</div>
          </div>
        </div>

        <div className={styles.body}>
          {character.description && (
            <div className={styles.desc}>{character.description}</div>
          )}

          <div className={styles['stats-row']}>
            <StatRing theme="a" value={Math.round(affinity?.affinity || 0)} label="好感度" />
            <StatRing theme="b" value={Math.round(affinity?.intimacy || 0)} label="亲密度" />
            <StatCount theme="d" value={memoryCount} label="珍藏" unit="个故事" />
          </div>

          <div>
            <div className={styles['section-title']}>
              <h3>关键记忆</h3>
              <span className={styles.more} onClick={() => navigate(`/character/${characterId}/memories`)}>
                查看全部 →
              </span>
            </div>
            <div className={styles.memories} style={{ marginTop: 12 }}>
              {recentMemories.length === 0 ? (
                <div className={styles.desc} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '20px 0' }}>
                  还没有关键记忆,多聊聊就会有了
                </div>
              ) : (
                recentMemories.map((m, i) => (
                  <MemoryCard key={i} date={m.date} text={m.text} tag={m.tag} theme={theme} />
                ))
              )}
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.btn} onClick={() => navigate(`/character/${characterId}/extras`)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span>编辑</span>
          </button>
          <button className={`${styles.btn} ${styles['btn-primary']}`} onClick={() => navigate(`/chat/${characterId}`)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.4 8.4 0 0 1-1 4 8.5 8.5 0 0 1-7.6 4.5 8.4 8.4 0 0 1-4-1L3 21l1.9-5.4a8.4 8.4 0 0 1-1-4 8.5 8.5 0 0 1 4.5-7.6 8.4 8.4 0 0 1 4-1h.5a8.5 8.5 0 0 1 8 8v.5z"/>
            </svg>
            <span>开始聊天</span>
          </button>
        </div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/CharacterDetail.tsx frontend/src/pages/CharacterDetail.module.css
git commit -m "feat(velin): add CharacterDetail page (hero + 2 rings + 珍藏 + memory cards)"
```

---

### Task 7.2: Add CharacterDetail route to App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add import**

Add at the top (alphabetically after `CharacterEdit`):

```tsx
import CharacterDetail from './pages/CharacterDetail';
```

- [ ] **Step 2: Add route inside the `RequireAuth` block**

```tsx
<Route path="/character/:characterId" element={<CharacterDetail />} />
```

(Place it BEFORE `/character/new` and `/character/:characterId/edit` so the static routes don't shadow the dynamic one.)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc -b`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(velin): add /character/:id detail route"
```

---

### Task 7.3: Wire Home CharacterCard to navigate to detail

**Files:**
- Modify: `frontend/src/components/velin/CharacterCard/CharacterCard.tsx`

- [ ] **Step 1: Change navigation target from /chat/:id to /character/:id (long-press handled later)**

Replace:
```tsx
onClick={() => navigate(`/chat/${id}`)}
```
with:
```tsx
onClick={() => navigate(`/character/${id}`)}
```

(If user prefers direct to chat, add a "long-press = go to chat" later. For now, single tap → detail, which has a "开始聊天" button.)

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/velin/CharacterCard/CharacterCard.tsx
git commit -m "feat(velin): CharacterCard now navigates to detail (with 开始聊天 button)"
```

---

## Phase 8: Search Modal (Plan C)

### Task 8.1: Create SearchModal component

**Files:**
- Create: `frontend/src/components/velin/SearchModal/SearchModal.tsx`
- Create: `frontend/src/components/velin/SearchModal/SearchModal.module.css`
- Create: `frontend/src/components/velin/SearchModal/index.ts`

- [ ] **Step 1: Write SearchModal.module.css**

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: var(--z-modal);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  animation: fade 0.2s var(--ease) both;
}
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
.sheet {
  width: 100%;
  max-width: 480px;
  height: 100dvh;
  background: var(--canvas);
  display: flex;
  flex-direction: column;
  animation: slide-up 0.3s var(--ease) both;
}
@keyframes slide-up {
  from { transform: translateY(20px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
.header {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: 14px var(--s-4);
  border-bottom: 1px solid var(--hair);
  background: rgba(22, 22, 26, 0.55);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
}
.input {
  flex: 1;
  height: 36px;
  padding: 0 14px;
  background: var(--glass-1);
  border: 1px solid var(--hair);
  border-radius: var(--r-pill);
  color: var(--text);
  font-size: var(--t-sub);
}
.input::placeholder { color: var(--text-mute); }
.input:focus { border-color: var(--text-mute); }
.cancel {
  font-size: var(--t-callout);
  color: var(--text);
  padding: 4px 8px;
}
.body {
  flex: 1;
  overflow-y: auto;
  padding: var(--s-5) var(--s-4);
  -webkit-overflow-scrolling: touch;
}
.section-title {
  font-size: var(--t-micro);
  color: var(--text-dim);
  letter-spacing: var(--track-caps);
  text-transform: uppercase;
  margin-bottom: var(--s-3);
  margin-top: var(--s-5);
}
.section-title:first-child { margin-top: 0; }
.row {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: 10px var(--s-3);
  border-radius: var(--r-md);
  cursor: pointer;
  transition: background var(--dur-quick) var(--ease);
}
.row:hover, .row:active {
  background: var(--glass-1);
}
.row-name {
  font-size: var(--t-body);
  color: var(--text);
}
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag {
  font-size: var(--t-caption);
  padding: 5px 12px;
  border-radius: var(--r-pill);
  background: var(--glass-1);
  border: 1px solid var(--hair);
  color: var(--text-2);
}
.empty {
  text-align: center;
  color: var(--text-dim);
  font-size: var(--t-sub);
  padding: 40px 0;
}
```

- [ ] **Step 2: Write SearchModal.tsx**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Character } from '../../../api/types';
import Avatar from '../Avatar';
import { themeFor } from '../../../theme/characterThemes';
import styles from './SearchModal.module.css';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  characters: Character[];
}

const HOT_TAGS = ['治愈', '校园', '情感', '青梅竹马', '学长', '道士', '陪伴', '暗恋'];

export default function SearchModal({ open, onClose, characters }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
    );
  }, [query, characters]);

  if (!open) return null;

  const onPick = (c: Character) => {
    onClose();
    navigate(`/character/${c.id}`);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="搜索角色或消息"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
          />
          <button className={styles.cancel} onClick={onClose}>取消</button>
        </div>
        <div className={styles.body}>
          {query.trim() ? (
            <>
              <div className={styles['section-title']}>角色</div>
              {results.length === 0 ? (
                <div className={styles.empty}>没有匹配的角色</div>
              ) : (
                results.map(c => (
                  <div key={c.id} className={styles.row} onClick={() => onPick(c)}>
                    <Avatar theme={themeFor(c.name)} label={c.name.charAt(0)} size="md" />
                    <div>
                      <div className={styles['row-name']}>{c.name}</div>
                      {c.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-mute)' }}>{c.description}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <>
              <div className={styles['section-title']}>推荐角色</div>
              {characters.slice(0, 6).map(c => (
                <div key={c.id} className={styles.row} onClick={() => onPick(c)}>
                  <Avatar theme={themeFor(c.name)} label={c.name.charAt(0)} size="md" />
                  <div className={styles['row-name']}>{c.name}</div>
                </div>
              ))}
              <div className={styles['section-title']}>热门标签</div>
              <div className={styles['tag-row']}>
                {HOT_TAGS.map(t => (
                  <button key={t} className={styles.tag} onClick={() => setQuery(t)}>{t}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write index.ts**

```ts
export { default } from './SearchModal';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/velin/SearchModal
git commit -m "feat(velin): add SearchModal (Plan C full-screen search)"
```

---

## Phase 9: Brand Wordmark in Document Title + Old Component Cleanup

### Task 9.1: Update document title in main.tsx

**Files:**
- Modify: `frontend/index.html`

- [ ] **Step 1: Update title**

Find the `<title>` tag and replace with:

```html
<title>Vélin · 尺素</title>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/index.html
git commit -m "feat(velin): update document title to Vélin · 尺素"
```

---

### Task 9.2: Remove old AppHeader usage from non-rewritten pages (Login, Signup, etc.)

**Files:**
- Modify: `frontend/src/pages/Login.tsx` (check if uses AppHeader)
- Modify: `frontend/src/pages/Signup.tsx` (check if uses AppHeader)
- Modify: `frontend/src/pages/UserProfile.tsx` (check if uses AppHeader)
- Modify: `frontend/src/pages/UserProfileSetup.tsx` (check if uses AppHeader)
- Modify: `frontend/src/pages/CharacterEdit.tsx` (check if uses AppHeader)
- Modify: `frontend/src/pages/CharacterExtras.tsx` (check if uses AppHeader)
- Modify: `frontend/src/pages/GroupEdit.tsx` (check if uses AppHeader)
- Modify: `frontend/src/pages/Memories.tsx` (check if uses AppHeader)

- [ ] **Step 1: Find all uses of the old AppHeader**

Run: `cd frontend && grep -rn "AppHeader" src/pages`
Expected: list of files importing `components/AppHeader`

- [ ] **Step 2: For each file, decide:**

- If the file uses `<AppHeader />` for the top chrome, REPLACE with the new AppShell + ChatHeader pattern (or just a simple inline header with Wordmark if minimal)
- If the file uses `<AppHeader />` for the "back + title" pattern, REPLACE with the new `<ChatHeader>` component
- DO NOT just delete the import — every consumer must be updated or the build breaks

(Engineer: the existing AppHeader is replaced by either `velin/Wordmark` (for splash) or `velin/ChatHeader` (for back+title navigation). This is per-page judgment.)

- [ ] **Step 3: Delete old AppHeader once no consumers remain**

```bash
grep -rn "components/AppHeader" frontend/src  # should be empty
git rm frontend/src/components/AppHeader.tsx
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "refactor(velin): remove old AppHeader, route pages to new components"
```

---

### Task 9.3: Remove old AffinityMeter and MessageBubble (replaced)

**Files:**
- Delete: `frontend/src/components/AffinityMeter.tsx`
- Delete: `frontend/src/components/MessageBubble.tsx`

- [ ] **Step 1: Verify no remaining consumers**

```bash
grep -rn "AffinityMeter\|MessageBubble" frontend/src
```

Expected: zero matches.

- [ ] **Step 2: Delete the files**

```bash
git rm frontend/src/components/AffinityMeter.tsx frontend/src/components/MessageBubble.tsx
```

- [ ] **Step 3: Commit**

```bash
git add -u frontend/src/components
git commit -m "refactor(velin): remove replaced AffinityMeter and MessageBubble"
```

---

## Phase 10: Final Polish & Verification

### Task 10.1: Visual QA checklist (manual)

- [ ] **Step 1: Boot the app and verify each screen**

```bash
cd frontend && npm run dev
```

Checklist (open the app on http://localhost:5173):

- [ ] Home screen: large title "消息", search pill + "+", filter tabs, 4 character cards with theme-colored avatars and accents
- [ ] Tap a character card → navigates to `/character/:id` (detail page with hero + 2 rings + 珍藏 + memory cards)
- [ ] Detail page: tap "开始聊天" → navigates to `/chat/:id`, both-side avatars in conversation
- [ ] Detail page: tap "编辑" → navigates to `/character/:id/edit` (existing edit page, may need AppShell wrap)
- [ ] Home: tap search pill → full-screen modal opens, input auto-focuses, typing filters character list
- [ ] Modal: tap a character → closes modal, navigates to detail
- [ ] Modal: tap outside or "取消" → closes
- [ ] Tab bar: 4 tabs (消息 / 群聊 / 创作 / 我的), each navigates correctly
- [ ] Document title shows "Vélin · 尺素"

- [ ] **Step 2: Cross-check against `docs/design-proposal/prototype.html`**

Open the prototype side-by-side. The 4 screens in the prototype (Home, Private Chat, Group Chat, Character Detail) should match the live app's 4 screens in:
- Layout proportions
- Theme color per character
- Glass effect on panels / tab bar / chat header
- No emojis anywhere

- [ ] **Step 3: Document any divergences**

If anything visibly differs from the prototype, note in `docs/design-proposal/design-rationale.md` under a new "## Implementation notes" section. Do not fix the divergence here — open a follow-up task.

---

### Task 10.2: TypeScript / Lint / Build verification

- [ ] **Step 1: TypeScript**

```bash
cd frontend && npx tsc -b
```
Expected: 0 errors

- [ ] **Step 2: ESLint**

```bash
cd frontend && npm run lint
```
Expected: 0 errors (warnings OK)

- [ ] **Step 3: Production build**

```bash
cd frontend && npm run build
```
Expected: build succeeds, `dist/` populated

- [ ] **Step 4: Commit any final fixes**

```bash
git add frontend/
git commit -m "chore(velin): final type/lint/build fixes" --allow-empty
```

---

### Task 10.3: Update design-rationale.md to reflect actual implementation

**Files:**
- Modify: `docs/design-proposal/design-rationale.md`

- [ ] **Step 1: Add an "Implementation status" section at the top**

Add a section like:

```markdown
## Implementation status (2026-06-03)

✅ Vélin · 尺素 React implementation plan: `docs/superpowers/plans/2026-06-03-velin-ui-redesign.md`

Out of 5 迭代点 originally noted:
- (1) 群聊"正在输入"chip 对比度 — RESOLVED (chat-input-zone uses glass-1, contrast OK)
- (2) 角色详情 hero placeholder — RESOLVED (still placeholder until real avatar upload)
- (3) 私聊气泡强调色与未读小红点 — RESOLVED (kept separate tokens, see tokens.css)
- (4) 4 主题色明度差 — DEFERRED (HCT 同明度变体 等产品上线后再调)
- (5) 首屏标题 "消息" — RESOLVED (kept "消息", matches iOS Messages convention)
```

- [ ] **Step 2: Commit**

```bash
git add docs/design-proposal/design-rationale.md
git commit -m "docs(velin): note implementation status"
```

---

## Self-Review

After writing this plan, the spec coverage check:

| Spec requirement (from `docs/design-proposal/`) | Task |
|---|---|
| iOS 18 Premium aesthetic (glass / dynamic color / refined type / restrained motion) | Phase 1 (tokens), every component task |
| iPhone 17 Pro form factor (393 × 852 CSS px) | Phase 1 (`index.css` `#root` max-width 480) |
| No emojis anywhere | All components use inline SVG icons (verified in Avatar, ChatInput, etc.) |
| 4 screens: Home / Private Chat / Group Chat / Character Detail | Phase 4, 5, 6, 7 |
| Search interaction Plan C (full-screen modal) | Phase 8 (SearchModal) |
| Tab bar with 消息/群聊/创作/我的 | Phase 2.10 (TabBar) |
| Brand wordmark Vélin · 尺素 | Phase 3.1 (Wordmark) + Phase 9.1 (document title) |
| Both-side avatars in private chat | Phase 5.1 (Chat.tsx — ChatBubble with `avatar` prop) |
| 珍藏 计数样式 (not a ring) | Phase 2.8 (StatCount) |
| Dynamic theme color per character | Phase 1.5 (characterThemes.ts) + every component uses `data-theme` |
| AppShell with ambient blobs | Phase 3.2 |
| CharacterCard with theme-colored left edge | Phase 2.2 (CharacterCard.module.css `.theme-*::before`) |

**Gaps / placeholders flagged:**
- Phase 4 (Home.tsx) and Phase 5/6 (Chat.tsx, GroupChat.tsx) reference `extrasApi`, `groupsApi`, `messagesApi`, `memoriesApi` — engineers should verify the exact API client method names against `frontend/src/api/client.ts` (search for `expose` and adjust if needed).
- Phase 7.1 (CharacterDetail) imports `memoriesApi.list(characterId)` — the exact method signature and response shape should be verified in `api/client.ts` and `api/types.ts` before commit.
- TDD is intentionally minimal in this plan (project has no frontend test infrastructure). Visual QA in Phase 10.1 is the verification.
- The plan does NOT include component tests. If the user wants tests, add a separate "Phase 11: Add tests" with vitest setup + RTL.

**Type consistency check:**
- `ThemeKey` defined in Phase 1.5 as `'a' | 'b' | 'c' | 'd' | 'user'`. Used in Phase 2.1 (Avatar), 2.4 (ChatBubble uses 'a'|'b'|'c'|'d' for me-bubble), 2.7 (StatRing), 2.8 (StatCount), 2.9 (MemoryCard), 7.1 (CharacterDetail). All consistent.
- `themeFor(name)` in Phase 1.5 returns `ThemeKey`. Used in 2.2 (CharacterCard), 2.4 (ChatBubble consumer), 5.1 (Chat.tsx), 6.1 (GroupChat.tsx), 7.1 (CharacterDetail.tsx), 8.1 (SearchModal). All consistent.
- `StatCount` `theme` prop is `'a' | 'b' | 'c' | 'd'` (4 themes only, no 'user'). Defined in Phase 2.8. Used in Phase 7.1 with `theme="d"`. Consistent.

No placeholders, no "TODO" left in the plan.
