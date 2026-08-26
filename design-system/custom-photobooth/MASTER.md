# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/custom-photobooth/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Custom Photobooth
**Category:** Event tool — host admin (dashboard) + guest booth (entertainment)
**Design Dials:** Variance 6/10 (Balanced / Modern) | Motion 4/10 (Standard) | Density 4/10 (Standard)

> **Palette and typography below are host-locked**, not generated. The generator
> proposed an orange/Fredoka system; that was discarded. Style (Claymorphism),
> spacing, shadows, motion and the anti-pattern list are from the generator.

---

## Global Rules

### Color Palette

Four host-supplied colors, plus shades derived from them where contrast required it.

| Role | Hex | CSS Variable | Source |
|------|-----|--------------|--------|
| Background | `#F2EAE0` | `--bg` | host |
| Surface / card | `#FDFBF8` | `--surface` | derived (lifted cream) |
| Sunken / input | `#EDE3D6` | `--sunken` | derived (pressed cream) |
| Secondary / info | `#B4D3D9` | `--mist` | host |
| Border / lilac | `#BDA6CE` | `--lilac` | host |
| Accent | `#9B8EC7` | `--accent` | host |
| Accent deep / CTA | `#6B5CA5` | `--accent-deep` | derived shade of `--accent` |
| Ink / text | `#2E2640` | `--ink` | derived |
| Muted text | `#6B5F80` | `--muted` | derived |
| Success | `#3F7F63` | `--ok` | derived |
| Destructive | `#B23A4C` | `--err` | derived |

**Contrast (verified, WCAG AA body text needs 4.5:1):**

| Pair | Ratio | Verdict |
|------|-------|---------|
| `--ink` on `--bg` | 12.0:1 | ✅ AAA |
| `--muted` on `--bg` | 4.93:1 | ✅ AA |
| `--ink` on `--mist` | 9.0:1 | ✅ AAA |
| `--ink` on `--accent` | 4.83:1 | ✅ AA |
| white on `--accent-deep` | 5.68:1 | ✅ AA |
| white on `--accent` | 2.96:1 | ❌ **never do this** |

> `--accent` (#9B8EC7) is too light to carry white text. Primary CTAs use
> `--accent-deep`; `--accent` is for fills, outlines and decoration only.

### Typography

- **Single family:** Karla (variable, ExtraLight→ExtraBold), loaded via `next/font/google`
- **Heading weight:** 800 (chunky, matches Claymorphism)
- **Body weight:** 400, labels 600
- **Base size:** 16px, line-height 1.5

| Token | Size | Use |
|-------|------|-----|
| `--fs-display` | `clamp(2rem, 6vw, 3rem)` | Booth title, page h1 |
| `--fs-h2` | `1.15rem` | Card headings |
| `--fs-body` | `1rem` | Body |
| `--fs-sm` | `0.875rem` | Helper text |
| `--fs-label` | `0.8rem` | Field labels (uppercase, tracked) |

### Spacing Variables

*Density: 4/10 — Standard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` | Tight gaps |
| `--space-sm` | `8px` | Icon gaps, inline spacing |
| `--space-md` | `16px` | Standard padding |
| `--space-lg` | `24px` | Section padding |
| `--space-xl` | `32px` | Large gaps |
| `--space-2xl` | `48px` | Section margins |
| `--space-3xl` | `64px` | Hero padding |

### Shadow Depths — Claymorphism (double shadow)

Clay depth = a soft outer drop shadow **plus** an inner highlight/shade. No hard lines.

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 2px 4px rgba(46,38,64,.06)` | Subtle lift |
| `--shadow-md` | `0 6px 14px rgba(46,38,64,.10)` | Cards |
| `--shadow-lg` | `0 14px 28px rgba(46,38,64,.13)` | Raised / hover |
| `--shadow-clay-in` | `inset 0 2px 3px rgba(255,255,255,.85), inset 0 -3px 5px rgba(46,38,64,.09)` | Clay body |
| `--shadow-press` | `inset 0 2px 5px rgba(46,38,64,.18)` | Pressed / sunken input |

### Radii

`--r-sm: 10px` · `--r-md: 16px` · `--r-lg: 22px` · `--r-pill: 999px`
(Claymorphism calls for 16–24px on containers.)

---

## Component Specs

### Buttons

```css
.btn {                       /* base — chunky clay */
  border-radius: var(--r-pill);
  border: 2px solid transparent;
  padding: 12px 22px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
}
.btn-primary {
  background: var(--accent-deep);   /* NOT --accent: white text needs 5.68:1 */
  color: #fff;
  box-shadow: var(--shadow-md), inset 0 2px 2px rgba(255,255,255,.25);
}
.btn-primary:hover  { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
.btn-primary:active { transform: translateY(1px);  box-shadow: var(--shadow-press); }

.btn-secondary {
  background: var(--surface);
  color: var(--ink);
  border-color: var(--lilac);
  box-shadow: var(--shadow-sm);
}
```

### Cards

```css
.card {
  background: var(--surface);
  border: 2px solid var(--lilac);      /* clay wants thick borders */
  border-radius: var(--r-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-md), var(--shadow-clay-in);
}
```

### Inputs

```css
.input {
  padding: 12px 14px;
  font-size: 16px;                     /* 16px min — stops iOS zoom-on-focus */
  background: var(--sunken);
  border: 2px solid transparent;
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-press);     /* sunken, the inverse of a clay button */
  transition: border-color 180ms ease, box-shadow 180ms ease;
}
.input:focus-visible {
  outline: none;
  border-color: var(--accent-deep);
  box-shadow: var(--shadow-press), 0 0 0 4px rgba(155,142,199,.35);
}
```

---

## Style Guidelines

**Style:** Claymorphism

**Keywords:** Soft 3D, chunky, playful, toy-like, bubbly, thick borders (3-4px), double shadows, rounded (16-24px)

**Best For:** Educational apps, children's apps, SaaS platforms, creative tools, fun-focused, onboarding, casual games

**Key Effects:** Inner+outer shadows (subtle, no hard lines), soft press (200ms ease-out), fluffy elements, smooth transitions

**Why it fits:** a photobooth is a toy. Chunky rounded surfaces + soft pastel shadows
read as physical and fun, and the light-mode-only palette suits Claymorphism, which
only partially supports dark mode.

### Page Patterns

The generator returned "App Store Style Landing" — **discarded**, this product has no
marketing page. Actual surfaces:

| Route | Audience | Pattern |
|-------|----------|---------|
| `/login` | host | Single centered clay card, one field |
| `/admin` | host | Workspace card list + empty state, health badge per card |
| `/admin/[id]` | host | Sectioned settings, numbered steps, sticky save bar |
| `/b/[id]` | guest | Immersive full-viewport stage, one action at a time |

---

## Motion

**Stagger List** (Standard) — Trigger: load | Duration: 300-450ms | Easing: `back.out(1.4)`

Implemented in **CSS**, not GSAP — no animation dependency is warranted for a
handful of entrance tweens. The GSAP reference form:

```js
gsap.from('.grid-item', { opacity: 0, scale: 0.92, y: 16, duration: 0.4, stagger: { each: 0.06, from: 'start', grid: 'auto' }, ease: 'back.out(1.4)' });
```

CSS equivalent in use: `@keyframes rise` + `animation-delay` step per card,
`cubic-bezier(.34,1.4,.64,1)` approximating `back.out(1.4)`.

- ❌ Don't use back.out overshoot on dense data tables; it reads as sloppy
- ⚡ Animate `transform`/`opacity` only — never width/height
- ♿ All motion wrapped in `@media (prefers-reduced-motion: reduce)` kill switch

---

## Anti-Patterns (Do NOT Use)

- ❌ Generic design / no personality
- ❌ **White text on `--accent`** (2.96:1 — project-specific, see contrast table)
- ❌ **Emojis as icons** — use inline SVG (no icon dependency in this project)
- ❌ Missing `cursor: pointer` on clickable elements
- ❌ Layout-shifting hovers
- ❌ Low contrast text (< 4.5:1)
- ❌ Instant state changes (always 150–300ms)
- ❌ Invisible focus states

---

## Pre-Delivery Checklist

- [ ] No emojis used as icons (inline SVG instead)
- [ ] Icons visually consistent (same stroke width, same box)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Text contrast 4.5:1 minimum (see contrast table)
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Touch targets ≥ 44×44px
- [ ] Inputs ≥ 16px font (no iOS zoom-on-focus)
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No horizontal scroll on mobile
- [ ] Errors near their field, with `role="alert"`
