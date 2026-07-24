# "Know your space" Tour — Screen Preview Images

One image per onboarding tour card — a preview of the actual FLO screen
being introduced. Real screenshots (or lightly-cropped real screenshots),
not illustrations.

## Size & format

The on-screen box is NOT a fixed size — it's whatever's left above the
card's text/CTA, which varies by device height AND by how much sits below
the image on that specific card. **Two of the ten cards have extra content
under the image** (a row list), which eats roughly 150px more than the other
eight — so they need a shorter, more-square export or `resizeMode="cover"`
will crop noticeably more off the *sides*, risking cropping exactly the
icons/rows the card exists to show.

| Cards | Export size | Ratio |
|---|---|---|
| Home, Transactions, Add, Analytics, Menu, Budgets, Plans, Bills (nothing below the image) | **1080 × 1440px** | 3:4 |
| Currency, Personalize (a row list sits below the image — ~150px shorter box) | **1080 × 1200px** | 4:5 |

PNG or JPG either size. Keep the subject (the part of the screen that
actually illustrates the card's point) centered — `cover` may still crop a
little off the edges depending on the exact device.

## Files

Drop finished images into this folder (`assets/tour/`), named by card key:

| Card key | Filename | Export size | What to show |
|---|---|---|---|
| `home` | `home.png` | 1080×1440 | Home screen — balance, streak, rewards |
| `transactions` | `transactions.png` | 1080×1440 | Transactions list |
| `add` | `add.png` | 1080×1440 | The Add Transaction sheet (the ⊕ button's target) |
| `analytics` | `analytics.png` | 1080×1440 | Analytics screen |
| `menu` | `menu.png` | 1080×1440 | The Menu sheet (Budgets/Plans/Bills/Reports/Shop/Settings) |
| `budgets` | `budgets.png` | 1080×1440 | Budgets screen |
| `plans` | `plans.png` | 1080×1440 | Plans screen |
| `bills` | `bills.png` | 1080×1440 | Bills screen |
| `currency` | `currency.png` | **1080×1200** | Something showing coins/freezes/XP (e.g. the Rewards hub) |
| `personalize` | `personalize.png` | **1080×1200** | The Personalize screen |

## Wiring

Each filename has a matching commented-out line in
`TOUR_IMAGES` (`app/onboarding/tour/[step].js`) — uncomment the line for
whichever card you've just dropped an image in for. Metro needs the file to
already exist before that `require()` line is active (a static-string
requirement, same as the rank/streak badge art), so add images and
uncomment their lines one at a time, not all at once in advance.
