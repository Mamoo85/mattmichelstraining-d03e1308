## Wheel-of-Fortune Rotating Slogan

### Slogans (9 total)

```
"Real coaching. Real results."
"Train smarter. Get stronger."
"Strength Trainging Fundamentals."
"Your kid's secret weapon."
"I make athletes, every age."

```

### Files


| File                                      | Change                                                                                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/features/WheelSlogan.tsx` | **New** — letter-by-letter vertical flip animation cycling every 4s using framer-motion `rotateX` with 30ms stagger per character |
| `src/components/features/HeroSection.tsx` | Replace static primary-colored second line with `<WheelSlogan />`                                                                 |


### Animation

- Letters flip in from `rotateX: -90` → `rotateX: 0`, staggered 30ms each
- Exit: quick opacity fade
- 4s hold between slogans, 2s initial delay
- Preserves fixed first line "Real strength. Zero gimmicks."