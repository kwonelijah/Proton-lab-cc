// Cross-sell recommendations for the bottom of retail product pages, in two
// rows: "Complete the Kit" (a rotating banner of the complementary garment —
// jerseys on bib pages, bibs on jersey pages) and "Different Colour?" (the
// other colourways of the garment being viewed).
//
// Ordering: the banner leads with the "matching" item as shot in the product
// photography (Sunset→Black, Ocean Blue→White, Red Sky→Granite), then the
// rest by GA4 item views over Jul 29–Aug 25 2026 (jerseys: Ocean Blue 335 >
// Red Sky 281 > Sunset 264; bibs: Black 1,286 > Granite 185 > White 81).
// Colour rows are ordered by the same view counts. Revisit when there's
// enough purchase volume to rank by conversion instead of clicks.
//
// Handles must be live in lib/api.ts SHOP_MODE — retired handles resolve to
// null at render time and simply drop out.
export interface KitRecommendation {
  completeKit: string[] // complementary garment, banner order
  colours: string[] // other colourways of the same garment
}

export const KIT_RECOMMENDATIONS: Record<string, KitRecommendation> = {
  // Jerseys → all three bibs in the banner, other jersey colours below
  'sunset-jersey': {
    completeKit: ['black-bib-shorts', 'granite-bib-shorts', 'white-bib-shorts'],
    colours: ['ocean-blue-jersey', 'red-sky-jersey'],
  },
  'ocean-blue-jersey': {
    completeKit: ['white-bib-shorts', 'black-bib-shorts', 'granite-bib-shorts'],
    colours: ['red-sky-jersey', 'sunset-jersey'],
  },
  'red-sky-jersey': {
    completeKit: ['granite-bib-shorts', 'black-bib-shorts', 'white-bib-shorts'],
    colours: ['ocean-blue-jersey', 'sunset-jersey'],
  },

  // Bibs → all three jerseys in the banner, other bib colours below
  'black-bib-shorts': {
    completeKit: ['sunset-jersey', 'ocean-blue-jersey', 'red-sky-jersey'],
    colours: ['granite-bib-shorts', 'white-bib-shorts'],
  },
  'granite-bib-shorts': {
    completeKit: ['red-sky-jersey', 'ocean-blue-jersey', 'sunset-jersey'],
    colours: ['black-bib-shorts', 'white-bib-shorts'],
  },
  'white-bib-shorts': {
    completeKit: ['ocean-blue-jersey', 'red-sky-jersey', 'sunset-jersey'],
    colours: ['black-bib-shorts', 'granite-bib-shorts'],
  },
}
