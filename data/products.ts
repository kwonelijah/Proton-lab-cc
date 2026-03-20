import type { Product } from '@/types/product'

// picsum.photos with seed gives consistent placeholder images per product
const img = (seed: string, w = 800, h = 1000) => ({
  id: `img-${seed}`,
  url: `https://picsum.photos/seed/${seed}/${w}/${h}`,
  altText: null,
  width: w,
  height: h,
})

export const products: Product[] = [
  // ─── AERO SERIES ────────────────────────────────────────────────────────────
  {
    id: 'prod_001',
    handle: 'aero-race-bib-short',
    title: 'Aero Race Bib Short',
    description:
      'Wind-tunnel tested construction with compression mapping for peak performance. Eight-panel anatomic cut, silicone gripper hem, and 4D chamois pad for race-day comfort over any distance.',
    featuredImage: img('aero-bib-1'),
    images: { nodes: [img('aero-bib-1'), img('aero-bib-2')] },
    variants: {
      nodes: [
        { id: 'v001_s', title: 'S', availableForSale: true, price: { amount: '189.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'S' }] },
        { id: 'v001_m', title: 'M', availableForSale: true, price: { amount: '189.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'M' }] },
        { id: 'v001_l', title: 'L', availableForSale: true, price: { amount: '189.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'L' }] },
        { id: 'v001_xl', title: 'XL', availableForSale: false, price: { amount: '189.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'XL' }] },
      ],
    },
    priceRange: { minVariantPrice: { amount: '189.00', currencyCode: 'GBP' } },
    collections: { nodes: [{ handle: 'aero-series', title: 'Aero Series' }] },
    tags: ['aero', 'race', 'bib-short', 'competition'],
    availableForSale: true,
  },
  {
    id: 'prod_002',
    handle: 'aero-race-jersey',
    title: 'Aero Race Jersey',
    description:
      'Engineered for speed with a race-fit cut and low-drag fabric panels. Full-length hidden zip, three rear pockets with zipper security pocket, and reflective hits for visibility.',
    featuredImage: img('aero-jersey-1'),
    images: { nodes: [img('aero-jersey-1'), img('aero-jersey-2')] },
    variants: {
      nodes: [
        { id: 'v002_s', title: 'S', availableForSale: true, price: { amount: '169.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'S' }] },
        { id: 'v002_m', title: 'M', availableForSale: true, price: { amount: '169.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'M' }] },
        { id: 'v002_l', title: 'L', availableForSale: true, price: { amount: '169.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'L' }] },
        { id: 'v002_xl', title: 'XL', availableForSale: true, price: { amount: '169.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'XL' }] },
      ],
    },
    priceRange: { minVariantPrice: { amount: '169.00', currencyCode: 'GBP' } },
    collections: { nodes: [{ handle: 'aero-series', title: 'Aero Series' }] },
    tags: ['aero', 'race', 'jersey', 'competition'],
    availableForSale: true,
  },
  {
    id: 'prod_003',
    handle: 'aero-tt-skinsuit',
    title: 'Aero TT Skinsuit',
    description:
      'One-piece construction for maximum aerodynamic efficiency. Developed in the wind tunnel with elite time triallists. Dimpled sleeve panels, integrated arm grippers, and race-legal design.',
    featuredImage: img('aero-tt-1'),
    images: { nodes: [img('aero-tt-1'), img('aero-tt-2')] },
    variants: {
      nodes: [
        { id: 'v003_s', title: 'S', availableForSale: true, price: { amount: '289.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'S' }] },
        { id: 'v003_m', title: 'M', availableForSale: true, price: { amount: '289.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'M' }] },
        { id: 'v003_l', title: 'L', availableForSale: false, price: { amount: '289.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'L' }] },
        { id: 'v003_xl', title: 'XL', availableForSale: false, price: { amount: '289.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'XL' }] },
      ],
    },
    priceRange: { minVariantPrice: { amount: '289.00', currencyCode: 'GBP' } },
    collections: { nodes: [{ handle: 'aero-series', title: 'Aero Series' }] },
    tags: ['aero', 'race', 'skinsuit', 'tt', 'competition'],
    availableForSale: true,
  },

  // ─── ENDURANCE SERIES ────────────────────────────────────────────────────────
  {
    id: 'prod_004',
    handle: 'endurance-bib-tight',
    title: 'Endurance Bib Tight',
    description:
      'Built for the long ride. Thermal brushed inner, articulated knee panels, and our highest-rated chamois for six-hour comfort. Water-resistant outer for variable conditions.',
    featuredImage: img('end-tight-1'),
    images: { nodes: [img('end-tight-1'), img('end-tight-2')] },
    variants: {
      nodes: [
        { id: 'v004_s', title: 'S', availableForSale: true, price: { amount: '219.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'S' }] },
        { id: 'v004_m', title: 'M', availableForSale: true, price: { amount: '219.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'M' }] },
        { id: 'v004_l', title: 'L', availableForSale: true, price: { amount: '219.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'L' }] },
        { id: 'v004_xl', title: 'XL', availableForSale: true, price: { amount: '219.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'XL' }] },
      ],
    },
    priceRange: { minVariantPrice: { amount: '219.00', currencyCode: 'GBP' } },
    collections: { nodes: [{ handle: 'endurance-series', title: 'Endurance Series' }] },
    tags: ['endurance', 'thermal', 'bib-tight', 'long-ride'],
    availableForSale: true,
  },
  {
    id: 'prod_005',
    handle: 'endurance-long-sleeve-jersey',
    title: 'Endurance Long Sleeve Jersey',
    description:
      'Warmth without weight. Merino-blend construction with temperature regulation across a wide range. Slim cut with thumb loops, four rear pockets, and subtle Proton Lab branding.',
    featuredImage: img('end-ls-1'),
    images: { nodes: [img('end-ls-1'), img('end-ls-2')] },
    variants: {
      nodes: [
        { id: 'v005_s', title: 'S', availableForSale: true, price: { amount: '195.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'S' }] },
        { id: 'v005_m', title: 'M', availableForSale: true, price: { amount: '195.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'M' }] },
        { id: 'v005_l', title: 'L', availableForSale: true, price: { amount: '195.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'L' }] },
        { id: 'v005_xl', title: 'XL', availableForSale: true, price: { amount: '195.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'XL' }] },
      ],
    },
    priceRange: { minVariantPrice: { amount: '195.00', currencyCode: 'GBP' } },
    collections: { nodes: [{ handle: 'endurance-series', title: 'Endurance Series' }] },
    tags: ['endurance', 'long-sleeve', 'jersey', 'merino'],
    availableForSale: true,
  },
  {
    id: 'prod_006',
    handle: 'endurance-gilet',
    title: 'Endurance Gilet',
    description:
      'Wind protection when you need it. Ultra-packable gilet with windproof front panel, mesh back venting, and a deep drop hem. Folds into its own rear pocket for storage on climbs.',
    featuredImage: img('end-gilet-1'),
    images: { nodes: [img('end-gilet-1'), img('end-gilet-2')] },
    variants: {
      nodes: [
        { id: 'v006_s', title: 'S', availableForSale: true, price: { amount: '149.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'S' }] },
        { id: 'v006_m', title: 'M', availableForSale: true, price: { amount: '149.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'M' }] },
        { id: 'v006_l', title: 'L', availableForSale: true, price: { amount: '149.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'L' }] },
        { id: 'v006_xl', title: 'XL', availableForSale: true, price: { amount: '149.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'XL' }] },
      ],
    },
    priceRange: { minVariantPrice: { amount: '149.00', currencyCode: 'GBP' } },
    collections: { nodes: [{ handle: 'endurance-series', title: 'Endurance Series' }] },
    tags: ['endurance', 'gilet', 'wind', 'packable'],
    availableForSale: true,
  },

  // ─── TRAINING SERIES ─────────────────────────────────────────────────────────
  {
    id: 'prod_007',
    handle: 'training-bib-short',
    title: 'Training Bib Short',
    description:
      'Every-day performance without the premium price point. Durable four-way stretch fabric, comfortable bib construction with mesh back, and a quality chamois for daily training.',
    featuredImage: img('train-bib-1'),
    images: { nodes: [img('train-bib-1'), img('train-bib-2')] },
    variants: {
      nodes: [
        { id: 'v007_s', title: 'S', availableForSale: true, price: { amount: '129.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'S' }] },
        { id: 'v007_m', title: 'M', availableForSale: true, price: { amount: '129.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'M' }] },
        { id: 'v007_l', title: 'L', availableForSale: true, price: { amount: '129.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'L' }] },
        { id: 'v007_xl', title: 'XL', availableForSale: true, price: { amount: '129.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'XL' }] },
      ],
    },
    priceRange: { minVariantPrice: { amount: '129.00', currencyCode: 'GBP' } },
    collections: { nodes: [{ handle: 'training-series', title: 'Training Series' }] },
    tags: ['training', 'bib-short', 'everyday'],
    availableForSale: true,
  },
  {
    id: 'prod_008',
    handle: 'training-jersey',
    title: 'Training Jersey',
    description:
      'A jersey built for the volume. Relaxed race fit, moisture-wicking technical fabric, and a full-length zip for temperature control. Three rear pockets for all your training essentials.',
    featuredImage: img('train-jersey-1'),
    images: { nodes: [img('train-jersey-1'), img('train-jersey-2')] },
    variants: {
      nodes: [
        { id: 'v008_s', title: 'S', availableForSale: true, price: { amount: '119.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'S' }] },
        { id: 'v008_m', title: 'M', availableForSale: true, price: { amount: '119.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'M' }] },
        { id: 'v008_l', title: 'L', availableForSale: true, price: { amount: '119.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'L' }] },
        { id: 'v008_xl', title: 'XL', availableForSale: true, price: { amount: '119.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'XL' }] },
      ],
    },
    priceRange: { minVariantPrice: { amount: '119.00', currencyCode: 'GBP' } },
    collections: { nodes: [{ handle: 'training-series', title: 'Training Series' }] },
    tags: ['training', 'jersey', 'everyday'],
    availableForSale: true,
  },
  {
    id: 'prod_009',
    handle: 'training-arm-warmers',
    title: 'Training Arm Warmers',
    description:
      'Versatile thermal arm warmers that roll down when the temperature rises. Non-slip silicone grippers, flatlock seams, and UPF 50+ sun protection for year-round training.',
    featuredImage: img('train-arm-1'),
    images: { nodes: [img('train-arm-1'), img('train-arm-2')] },
    variants: {
      nodes: [
        { id: 'v009_s', title: 'S/M', availableForSale: true, price: { amount: '49.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'S/M' }] },
        { id: 'v009_l', title: 'L/XL', availableForSale: true, price: { amount: '49.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'L/XL' }] },
      ],
    },
    priceRange: { minVariantPrice: { amount: '49.00', currencyCode: 'GBP' } },
    collections: { nodes: [{ handle: 'training-series', title: 'Training Series' }] },
    tags: ['training', 'arm-warmers', 'accessories'],
    availableForSale: true,
  },
]
