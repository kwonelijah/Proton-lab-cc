# Proton Lab CC — Brand Standards for Claude Code

This document defines the design system, copy standards, and technical conventions for the Proton Lab CC website. All future edits must follow these rules exactly.

---

## 1. BRAND IDENTITY

**Brand name:** Proton Lab CC
**Sector:** Premium cycling apparel — race, training, and custom club kit
**Tone:** Editorial, precise, confident. Never casual or hyperbolic. Copy reads like it was written by a rider, not a marketer.
**Aesthetic:** Monochrome only. Fashion-editorial hybrid. Minimal. No accent colours.

---

## 2. COLOUR PALETTE

All colours are defined in `tailwind.config.ts`. Never use arbitrary hex values or colours outside this palette.

| Token | Value | Usage |
|---|---|---|
| `proton-black` | `#0a0a0a` | Primary text, CTAs, borders, backgrounds |
| `proton-white` | `#fafafa` | Page background, inverted text |
| `proton-grey` | `#6b6b6b` | Secondary/subdued text, labels |
| `proton-mid` | `#c8c8c8` | Mid-tone borders, dividers |
| `proton-light` | `#e8e8e8` | Subtle borders, row separators |

**Rule:** Never introduce a colour outside this palette. No accent colours. No blues, greens, or reds (except `text-red-600` for form validation errors only).

---

## 3. TYPOGRAPHY

**Fonts defined in `app/layout.tsx`:**

| Variable | Font | Usage |
|---|---|---|
| `font-playfair` | Playfair Display | Display headings, product titles, editorial pull quotes |
| `font-inter` | Montserrat | All body copy, labels, navigation, buttons, captions |

**Type scale conventions:**
- Page headings: `font-playfair text-5xl md:text-7xl leading-none`
- Product titles: `font-playfair text-3xl md:text-4xl leading-tight`
- Section labels / eyebrows: `text-[10px] uppercase tracking-widest text-proton-grey`
- Body copy: `text-sm text-proton-black leading-relaxed`
- Button labels: `text-xs uppercase tracking-widest font-inter`
- Subdued body: `text-sm text-proton-grey leading-relaxed`

---

## 4. LAYOUT & SPACING

- Max content width: `max-w-7xl mx-auto px-6 md:px-12`
- Section vertical padding: `py-16 md:py-24`
- Product grid: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12`
- Two-column product layout: `grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 lg:gap-20`
- Section dividers: `border-t border-proton-light`
- Sticky product info column: `md:sticky md:top-24 md:self-start space-y-8`

---

## 5. COMPONENTS

### Button (`components/ui/Button.tsx`)
Three variants, all uppercase Montserrat:
- `primary` — black fill, white text. Hover: grey fill
- `secondary` — transparent, black border. Hover: black fill, white text
- `ghost` — no border, underline on hover

Sizes: `sm` `md` `lg`. Always pass `type="submit"` on form buttons.
Supports `disabled` prop — applies `opacity-40 cursor-not-allowed`.

### ProductCard (`components/ui/ProductCard.tsx`)
- Image: `aspect-[4/5]` with `object-cover`, `group-hover:scale-105` on the image
- Links to `/products/[handle]`
- Shows title + price below image

### Accordion (`components/ui/Accordion.tsx`)
- Trigger: `text-[10px] uppercase tracking-widest`, `border-t border-proton-light`, chevron rotates 180° on open
- Animation: CSS grid `grid-rows-[0fr]` → `grid-rows-[1fr]` transition
- Props: `title: string`, `children: ReactNode`, `defaultOpen?: boolean`

### CartButton (`components/ui/CartButton.tsx`)
- Connected to Zustand store (`stores/cart.ts`)
- Shows live item count badge
- Calls `openCart()` on click

### CartDrawer (`components/ui/CartDrawer.tsx`)
- Slides in from right, full height, max-w-md
- Collects: name, email, phone number
- Submits to `/api/club-order` — sends formatted HTML email via Resend
- Backdrop closes drawer on click

---

## 6. PRODUCT PAGES

**Route:** `/products/[slug]`

**Page structure (in order, do not reorder):**
1. Breadcrumb — `text-[10px] uppercase tracking-widest text-proton-grey`
2. Two-column grid: gallery left, product info right
3. Product info column:
   - Collection label + Product name (Playfair) + Price
   - Size selector (no Size Guide link — removed; guide is in accordion below)
   - Add to Cart CTA — full width
   - Description heading + paragraph
   - Feature bullet list (dot markers, `text-sm text-proton-black`)
   - **Size Guide accordion** (Men's table always shown; Women's in code, `{false && ...}`, toggle when needed)
   - **Care & Washing accordion**

**SEO metadata** is set per-product via `product.seo.title`, `product.seo.description`, `product.seo.keywords` in `data/products.ts`.

**Size Guide — Men's:**
| Size | Chest | Waist | Hip |
|---|---|---|---|
| XS | 84 | 72 | 87 |
| S | 88 | 78 | 93 |
| M | 92 | 84 | 99 |
| L | 96 | 90 | 105 |
| XL | 100 | 96 | 111 |

Intro note: *"All measurements are in centimetres. Measure yourself and compare with the chart below. If you're between sizes, we recommend sizing up for a more relaxed club fit."*
**Do not recommend sizing down.**

**Care & Washing (verbatim, do not alter):**
- Machine wash at 30°C in garment bag or handwash
- Delicate cycle / Quick wash
- Wash dark and bright colors separately
- No synthetics wash / Do not bleach
- Do not dry clean / Do not tumble dry / Do not iron

---

## 7. DATA ARCHITECTURE

### `data/products.ts`
All products. Each product has:
- `description` — editorial paragraph copy (see `Proton_Lab_Product_Pages.md` for source)
- `bullets` — feature list array
- `seo.title`, `seo.description`, `seo.keywords`
- `availableForSale: true` on all products and all variants

### `data/collections.ts`
Two collections: `race` and `training`. Filtered from `products`.

### `data/clubs.ts`
Club shop entries. Each `ClubProduct` has: `name`, `handle`, `price`, `image`, `customImages?`.
Club handles map to `/custom/club/[handle]`.

### `lib/api.ts`
**The only place components import product/collection data from.** Never import directly from `/data/*` in components. This is the Shopify adapter — swap by uncommenting 6 lines when ready.

### `stores/cart.ts`
Zustand store. `CartItem` shape: `{ id, clubHandle, clubName, productHandle, productName, size, price, quantity }`.
Cart is club-shop only — main shop uses "Add to Cart — Coming Soon" (Shopify Phase 2).

---

## 8. EMAIL / API ROUTES

All email sent via **Resend** using `noreply@protonlab.cc` → `info@protonlab.cc`.
API key stored in `.env.local` (local) and Vercel Environment Variables (production).

| Route | Purpose |
|---|---|
| `/api/contact` | Contact form submissions |
| `/api/club-order` | Club kit orders — accepts `{ name, email, phone, items[] }` |

Both routes send formatted HTML emails with a consistent table layout (Name, Email, Phone rows, then order summary). Reply-to is always set to the customer's email.

---

## 9. NAVIGATION

**Navbar** (`components/layout/Navbar.tsx`):
- Desktop: 3-column grid — Left (Shop | Custom | Club Shop), Centre (logo), Right (Contact | Cart)
- Mobile: Logo left, Cart + hamburger right. Menu grid (3 cols: Custom | Shop | Club Shop) + secondary links
- Active state highlights current section
- Transparent on hero sections, white with blur on scroll or mobile open

**Club Shop link** → `/custom/club` — always present in navbar.

---

## 10. CLUB SHOPS

**Route:** `/custom/club/[handle]` (password-gated via sessionStorage)
**Product detail:** `/custom/club/[handle]/[productHandle]`

- All sizes available for sale in club context (override `availableForSale`)
- Custom club images shown first in gallery, then general product images
- "Add to Cart" → Zustand store → CartDrawer → club-order API
- Order email includes: club name, product, size, qty, price, customer name/email/phone

---

## 11. COPY STANDARDS

- **Product descriptions:** Editorial, first-person rider perspective. No superlatives. Focus on feel and purpose, not specs alone.
- **Fabric:** Always "Italian Miti fabric" — never generic "performance fabric"
- **Chamois:** Always "Elastic Interface® chamois" (with registered trademark symbol)
- **Fit terms:** "Race-fit" / "Club-fit" / "Relaxed-fit" — hyphenated, capitalised
- **Sizing advice:** Only recommend sizing up for relaxed fit. Never recommend sizing down.
- **CTA labels:** "Start Your Enquiry", "Order Kit", "Place Order", "Add to Cart", "Send Message"
- **Section labels:** Always 10px, uppercase, tracked, `text-proton-grey`

---

## 12. DEPLOYMENT

- **Hosting:** Vercel (auto-deploys on push to `main`)
- **Repo:** `github.com/kwonelijah/Proton-lab-cc`
- **Local dev:** `cd ~/Desktop/proton-lab-cc && npm run dev` → `localhost:3000`
- **Environment variables** must be set in both `.env.local` (local) and Vercel dashboard (production)
- Always run `npm run build` locally before pushing to catch type errors

---

## 13. PHASE 2 — SHOPIFY (PENDING)

When ready to connect Shopify Storefront API:
1. Implement `lib/shopify.ts` stubs
2. Uncomment 6 lines in `lib/api.ts`
3. Install Zustand cart: `npm install zustand` (already done)
4. Create `/stores/cart.ts` full implementation (already done for club shops)
5. Uncomment cart slot in `CartButton.tsx` (already connected)
6. Implement `middleware.ts` stub for `/team-store/*` auth

**Zero component changes required** — the adapter layer handles the swap.
