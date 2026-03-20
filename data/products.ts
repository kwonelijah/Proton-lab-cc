import type { Product } from '@/types/product'

// Blank placeholder — replace with real product photography
const img = (seed: string, w = 800, h = 1000) => ({
  id: `img-${seed}`,
  url: `/images/blank.png`,
  altText: null,
  width: w,
  height: h,
})

const sizes = (id: string, price: string) => ({
  nodes: [
    { id: `${id}_xs`, title: 'XS', availableForSale: false, price: { amount: price, currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'XS' }] },
    { id: `${id}_s`,  title: 'S',  availableForSale: false, price: { amount: price, currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'S' }] },
    { id: `${id}_m`,  title: 'M',  availableForSale: false, price: { amount: price, currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'M' }] },
    { id: `${id}_l`,  title: 'L',  availableForSale: false, price: { amount: price, currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'L' }] },
    { id: `${id}_xl`, title: 'XL', availableForSale: false, price: { amount: price, currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'XL' }] },
  ],
})

const col = (handle: string, title: string) => ({
  collections: { nodes: [{ handle, title }] },
})

export const products: Product[] = [

  // ─── RACE COLLECTION ────────────────────────────────────────────────────────

  {
    id: 'prod_001', handle: 'ss-race-jersey', title: 'SS Race Jersey',
    description: 'Short sleeve race jersey engineered for competition. Race fit, full-length zip, three rear pockets with security zip.',
    featuredImage: img('ss-race-jersey'), images: { nodes: [img('ss-race-jersey'), img('ss-race-jersey-2')] },
    variants: sizes('001', '80.00'),
    priceRange: { minVariantPrice: { amount: '80.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['jersey', 'race', 'short-sleeve'], availableForSale: true,
  },
  {
    id: 'prod_002', handle: 'ss-zipperless-jersey', title: 'SS Zipperless Jersey',
    description: 'Clean-line short sleeve jersey with no zip for a seamless aerodynamic profile. Three rear pockets.',
    featuredImage: img('ss-zipperless'), images: { nodes: [img('ss-zipperless'), img('ss-zipperless-2')] },
    variants: sizes('002', '65.00'),
    priceRange: { minVariantPrice: { amount: '65.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['jersey', 'race', 'short-sleeve', 'zipperless'], availableForSale: false,
  },
  {
    id: 'prod_003', handle: 'ls-fleece-jersey', title: 'LS Fleece Jersey',
    description: 'Long sleeve fleece-lined jersey for cold-weather racing and training. Thermal regulation with a race fit.',
    featuredImage: img('ls-fleece'), images: { nodes: [img('ls-fleece'), img('ls-fleece-2')] },
    variants: sizes('003', '85.00'),
    priceRange: { minVariantPrice: { amount: '85.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['jersey', 'race', 'long-sleeve', 'fleece', 'winter'], availableForSale: false,
  },
  {
    id: 'prod_004', handle: 'race-bib-shorts', title: 'Race Bib Shorts',
    description: 'Competition bib shorts with anatomic cut, silicone gripper hem, and high-density race chamois.',
    featuredImage: img('race-bib'), images: { nodes: [img('race-bib'), img('race-bib-2')] },
    variants: sizes('004', '90.00'),
    priceRange: { minVariantPrice: { amount: '90.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['shorts', 'race', 'bib'], availableForSale: false,
  },
  {
    id: 'prod_005', handle: 'training-bib-tights', title: 'Training Bib Tights',
    description: 'Full-length bib tights for cold-weather riding. Thermal brushed inner, water-resistant outer, articulated knee panels.',
    featuredImage: img('bib-tights'), images: { nodes: [img('bib-tights'), img('bib-tights-2')] },
    variants: sizes('005', '110.00'),
    priceRange: { minVariantPrice: { amount: '110.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['shorts', 'tights', 'winter', 'race'], availableForSale: false,
  },
  {
    id: 'prod_006', handle: 'winter-jacket', title: 'Winter Jacket',
    description: 'Windproof, water-resistant winter jacket with thermal fleece lining. Drop hem, three rear pockets, reflective details.',
    featuredImage: img('winter-jacket'), images: { nodes: [img('winter-jacket'), img('winter-jacket-2')] },
    variants: sizes('006', '100.00'),
    priceRange: { minVariantPrice: { amount: '100.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['jacket', 'winter', 'outerwear'], availableForSale: false,
  },
  {
    id: 'prod_007', handle: 'summer-gilet', title: 'Summer Gilet',
    description: 'Ultra-packable summer gilet. Windproof front panel, mesh back venting. Folds into its own rear pocket.',
    featuredImage: img('summer-gilet'), images: { nodes: [img('summer-gilet'), img('summer-gilet-2')] },
    variants: sizes('007', '55.00'),
    priceRange: { minVariantPrice: { amount: '55.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['gilet', 'summer', 'outerwear', 'packable'], availableForSale: true,
  },
  {
    id: 'prod_008', handle: 'winter-gilet', title: 'Winter Gilet',
    description: 'Thermal winter gilet with windproof front and insulated body. Deep drop hem for full back coverage.',
    featuredImage: img('winter-gilet'), images: { nodes: [img('winter-gilet'), img('winter-gilet-2')] },
    variants: sizes('008', '70.00'),
    priceRange: { minVariantPrice: { amount: '70.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['gilet', 'winter', 'outerwear'], availableForSale: false,
  },
  {
    id: 'prod_009', handle: 'ss-roadsuit', title: 'SS Roadsuit',
    description: 'One-piece short sleeve road skinsuit. Aerodynamic construction with integrated chamois. Race-legal design.',
    featuredImage: { id: 'img-ss-roadsuit-1', url: '/images/products/ss-roadsuit/ss-roadsuit1.jpg', altText: 'SS Roadsuit', width: 800, height: 1000 },
    images: { nodes: [
      { id: 'img-ss-roadsuit-1', url: '/images/products/ss-roadsuit/ss-roadsuit1.jpg', altText: 'SS Roadsuit front', width: 800, height: 1000 },
      { id: 'img-ss-roadsuit-2', url: '/images/products/ss-roadsuit/ss-roadsuit2.jpg', altText: 'SS Roadsuit detail', width: 800, height: 1000 },
    ]},
    variants: sizes('009', '120.00'),
    priceRange: { minVariantPrice: { amount: '120.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['skinsuit', 'race', 'aero'], availableForSale: false,
  },
  {
    id: 'prod_010', handle: 'ss-aerosuit', title: 'SS Aerosuit',
    description: 'Wind-tunnel developed aerosuit for time trials and triathlon. Dimpled sleeve panels, integrated arm grippers.',
    featuredImage: img('ss-aerosuit'), images: { nodes: [img('ss-aerosuit'), img('ss-aerosuit-2')] },
    variants: sizes('010', '140.00'),
    priceRange: { minVariantPrice: { amount: '140.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['skinsuit', 'race', 'aero', 'tt'], availableForSale: false,
  },
  {
    id: 'prod_011', handle: 'ls-speedsuit', title: 'LS Speedsuit',
    description: 'Long sleeve speed suit for maximum aerodynamic efficiency in cooler conditions. Full-body compression fit.',
    featuredImage: img('ls-speedsuit'), images: { nodes: [img('ls-speedsuit'), img('ls-speedsuit-2')] },
    variants: sizes('011', '150.00'),
    priceRange: { minVariantPrice: { amount: '150.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['skinsuit', 'race', 'aero', 'long-sleeve'], availableForSale: false,
  },
  {
    id: 'prod_012', handle: 'ss-trisuit', title: 'SS Trisuit',
    description: 'Short sleeve trisuit designed for swim-to-bike transitions. Quick-dry fabric, tri-specific chamois, rear zip.',
    featuredImage: img('ss-trisuit'), images: { nodes: [img('ss-trisuit'), img('ss-trisuit-2')] },
    variants: sizes('012', '135.00'),
    priceRange: { minVariantPrice: { amount: '135.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['trisuit', 'triathlon', 'race'], availableForSale: false,
  },
  {
    id: 'prod_013', handle: 'sleeveless-trisuit', title: 'Sleeveless Trisuit',
    description: 'Sleeveless trisuit for warm-weather racing. Open back design for ventilation, tri chamois, race-legal cut.',
    featuredImage: img('sl-trisuit'), images: { nodes: [img('sl-trisuit'), img('sl-trisuit-2')] },
    variants: sizes('013', '135.00'),
    priceRange: { minVariantPrice: { amount: '135.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['trisuit', 'triathlon', 'race', 'sleeveless'], availableForSale: false,
  },
  {
    id: 'prod_014', handle: 'aero-socks', title: 'Aero Socks',
    description: 'Aero-profile cycling socks with compression cuff and moisture-wicking construction. Race legal 16cm height.',
    featuredImage: img('aero-socks'), images: { nodes: [img('aero-socks')] },
    variants: {
      nodes: [
        { id: 'v014_sm', title: 'S/M', availableForSale: true, price: { amount: '20.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'S/M' }] },
        { id: 'v014_lx', title: 'L/XL', availableForSale: true, price: { amount: '20.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'L/XL' }] },
      ],
    },
    priceRange: { minVariantPrice: { amount: '20.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['accessories', 'socks', 'aero', 'moq-10'], availableForSale: true,
  },
  {
    id: 'prod_015', handle: 'aero-mitts', title: 'Aero Mitts',
    description: 'Short-finger aero mitts with silicone palm grip and low-profile cuff. Designed for race-day use.',
    featuredImage: img('aero-mitts'), images: { nodes: [img('aero-mitts')] },
    variants: sizes('015', '25.00'),
    priceRange: { minVariantPrice: { amount: '25.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['accessories', 'mitts', 'aero', 'moq-10'], availableForSale: false,
  },
  {
    id: 'prod_016', handle: 'aero-arm-warmers', title: 'Aero Arm Warmers',
    description: 'Aero-surface arm warmers with non-slip silicone grippers. Designed to complement race kit.',
    featuredImage: img('aero-armwarm'), images: { nodes: [img('aero-armwarm')] },
    variants: sizes('016', '25.00'),
    priceRange: { minVariantPrice: { amount: '25.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['accessories', 'arm-warmers', 'aero', 'moq-10'], availableForSale: false,
  },
  {
    id: 'prod_017', handle: 'knee-warmers', title: 'Knee Warmers',
    description: 'Thermal knee warmers with silicone gripper bands. Flatlock seams for comfort under bib shorts.',
    featuredImage: img('knee-warmers'), images: { nodes: [img('knee-warmers')] },
    variants: sizes('017', '25.00'),
    priceRange: { minVariantPrice: { amount: '25.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['accessories', 'knee-warmers', 'moq-10'], availableForSale: false,
  },
  {
    id: 'prod_018', handle: 'leg-warmers', title: 'Leg Warmers',
    description: 'Full-length leg warmers with thermal brushed inner. Silicone gripper at thigh, ankle zip for easy removal.',
    featuredImage: img('leg-warmers'), images: { nodes: [img('leg-warmers')] },
    variants: sizes('018', '25.00'),
    priceRange: { minVariantPrice: { amount: '25.00', currencyCode: 'GBP' } },
    ...col('race', 'Race'), tags: ['accessories', 'leg-warmers', 'moq-10'], availableForSale: false,
  },

  // ─── TRAINING COLLECTION ──────────────────────────────────────────────────

  {
    id: 'prod_019', handle: 'ss-training-jersey', title: 'SS Training Jersey',
    description: 'Workhorse short sleeve jersey for daily training. Relaxed race fit, moisture-wicking fabric, three rear pockets.',
    featuredImage: img('ss-training'), images: { nodes: [img('ss-training'), img('ss-training-2')] },
    variants: sizes('019', '65.00'),
    priceRange: { minVariantPrice: { amount: '65.00', currencyCode: 'GBP' } },
    ...col('training', 'Training'), tags: ['jersey', 'training', 'short-sleeve'], availableForSale: true,
  },
  {
    id: 'prod_020', handle: 'ss-club-jersey', title: 'SS Club Jersey',
    description: 'Club-fit short sleeve jersey. Durable construction for regular training use. Full-length zip, three rear pockets.',
    featuredImage: img('ss-club'), images: { nodes: [img('ss-club'), img('ss-club-2')] },
    variants: sizes('020', '50.00'),
    priceRange: { minVariantPrice: { amount: '50.00', currencyCode: 'GBP' } },
    ...col('training', 'Training'), tags: ['jersey', 'training', 'club', 'short-sleeve'], availableForSale: false,
  },
  {
    id: 'prod_021', handle: 'ls-training-jersey', title: 'LS Training Jersey',
    description: 'Long sleeve training jersey for cooler days. Comfortable fit with moisture management and thumb loops.',
    featuredImage: img('ls-training'), images: { nodes: [img('ls-training'), img('ls-training-2')] },
    variants: sizes('021', '70.00'),
    priceRange: { minVariantPrice: { amount: '70.00', currencyCode: 'GBP' } },
    ...col('training', 'Training'), tags: ['jersey', 'training', 'long-sleeve'], availableForSale: false,
  },
  {
    id: 'prod_022', handle: 'mtb-jersey', title: 'MTB Jersey',
    description: 'Relaxed-fit MTB jersey with dropped tail and wider cut for off-road riding. Durable stretch fabric.',
    featuredImage: img('mtb-jersey'), images: { nodes: [img('mtb-jersey'), img('mtb-jersey-2')] },
    variants: sizes('022', '30.00'),
    priceRange: { minVariantPrice: { amount: '30.00', currencyCode: 'GBP' } },
    ...col('training', 'Training'), tags: ['jersey', 'mtb', 'off-road'], availableForSale: false,
  },
  {
    id: 'prod_023', handle: 'training-bib-shorts', title: 'Training Bib Shorts',
    description: 'Daily training bib shorts. Four-way stretch fabric, comfortable bib construction, quality training chamois.',
    featuredImage: img('train-bib'), images: { nodes: [img('train-bib'), img('train-bib-2')] },
    variants: sizes('023', '80.00'),
    priceRange: { minVariantPrice: { amount: '80.00', currencyCode: 'GBP' } },
    ...col('training', 'Training'), tags: ['shorts', 'training', 'bib'], availableForSale: true,
  },
  {
    id: 'prod_024', handle: 'club-bib-shorts', title: 'Club Bib Shorts',
    description: 'Entry-level club bib shorts for recreational riding and club runs. Comfortable chamois and bib construction.',
    featuredImage: img('club-bib'), images: { nodes: [img('club-bib'), img('club-bib-2')] },
    variants: sizes('024', '65.00'),
    priceRange: { minVariantPrice: { amount: '65.00', currencyCode: 'GBP' } },
    ...col('training', 'Training'), tags: ['shorts', 'training', 'club', 'bib'], availableForSale: false,
  },
  {
    id: 'prod_025', handle: 'training-mitts', title: 'Training Mitts',
    description: 'Short-finger training mitts with padded palm and velcro closure. Durable construction for daily use.',
    featuredImage: img('train-mitts'), images: { nodes: [img('train-mitts')] },
    variants: sizes('025', '20.00'),
    priceRange: { minVariantPrice: { amount: '20.00', currencyCode: 'GBP' } },
    ...col('training', 'Training'), tags: ['accessories', 'mitts', 'training', 'moq-10'], availableForSale: false,
  },
  {
    id: 'prod_026', handle: 'arm-warmers', title: 'Arm Warmers',
    description: 'Versatile thermal arm warmers. Non-slip silicone grippers, flatlock seams, UPF 50+ sun protection.',
    featuredImage: img('arm-warmers'), images: { nodes: [img('arm-warmers')] },
    variants: sizes('026', '20.00'),
    priceRange: { minVariantPrice: { amount: '20.00', currencyCode: 'GBP' } },
    ...col('training', 'Training'), tags: ['accessories', 'arm-warmers', 'moq-10'], availableForSale: false,
  },
  {
    id: 'prod_027', handle: 'buff', title: 'Buff',
    description: 'Multifunctional neck tube and headwear. Moisture-wicking, quick-dry fabric for year-round use.',
    featuredImage: img('pl-buff'), images: { nodes: [img('pl-buff')] },
    variants: {
      nodes: [
        { id: 'v027_os', title: 'One Size', availableForSale: false, price: { amount: '10.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'One Size' }] },
      ],
    },
    priceRange: { minVariantPrice: { amount: '10.00', currencyCode: 'GBP' } },
    ...col('training', 'Training'), tags: ['accessories', 'headwear', 'moq-10'], availableForSale: false,
  },
  {
    id: 'prod_028', handle: 'cycling-cap', title: 'Cycling Cap',
    description: 'Classic cycling cap with structured peak and moisture-wicking sweatband. Fits under a helmet.',
    featuredImage: img('cycling-cap'), images: { nodes: [img('cycling-cap')] },
    variants: {
      nodes: [
        { id: 'v028_os', title: 'One Size', availableForSale: false, price: { amount: '10.00', currencyCode: 'GBP' }, selectedOptions: [{ name: 'Size', value: 'One Size' }] },
      ],
    },
    priceRange: { minVariantPrice: { amount: '10.00', currencyCode: 'GBP' } },
    ...col('training', 'Training'), tags: ['accessories', 'headwear', 'moq-10'], availableForSale: false,
  },
]
