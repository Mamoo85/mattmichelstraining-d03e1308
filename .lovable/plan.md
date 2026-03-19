

# Global UI Polish — Radius & Padding

## Changes

### 1. Update `--radius` in `src/index.css`
Change from `0.125rem` to `0.75rem` in both `:root` and `.dark` blocks. This instantly affects every shadcn component (buttons, cards, modals, inputs, dialogs) since they all reference `var(--radius)`.

### 2. Update `src/components/progress/StatsRow.tsx`
- Increase card padding from `p-3` to `p-5`
- Add `rounded-xl` to each stat card
- Increase gap from `gap-3` to `gap-4`

### 3. Tailwind config cleanup (`tailwind.config.ts`)
The current config overrides `md` and `sm` radius to equal `--radius` with no calc offset. Update:
- `lg`: `var(--radius)` (stays)
- `md`: `calc(var(--radius) - 2px)`
- `sm`: `calc(var(--radius) - 4px)`

This restores the standard shadcn size hierarchy so buttons/inputs get slightly smaller rounding than cards.

## Scope
- 3 files edited
- No new components, no database changes
- Every shadcn component (Card, Button, Dialog, Input, Select, etc.) inherits the new radius automatically

