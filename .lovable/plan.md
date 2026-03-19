

## Add Tech Showcase Card to For Parents Page

The `TechShowcaseCard` component (linking to `/the-edge`) will be added to the For Parents page as a compact section emphasizing how AI-powered posture analysis gives parents enhanced precision for their child's training.

### What changes

**File: `src/pages/ForParents.tsx`**
- Import `TechShowcaseCard` from `@/components/landing/TechShowcaseCard`
- Place it after the Parent-Child Account Section (after the parent portal block, ~line 277) and before the Instagram social box
- This positions it as a natural next step: after parents set up their child's account, they see they can enhance precision with cutting-edge tech
- Wrap it in a `motion.div` with fade animation to match the page pattern

### Placement rationale
After the parent portal section and before social proof (Instagram + press). Parents who just linked their child see: "Here's how the technology behind the programs gives your kid an edge."

