export interface ClubProduct {
  name: string
  handle: string
  // handle must match a catalogue product (it keys the size/description lookup
  // and the Stripe price) — unless catalogHandle points at the catalogue
  // product instead, e.g. for colourway variants or renamed club products.
  catalogHandle?: string
  // Colourway/trim note — appended to the size at add-to-cart so it survives
  // into Stripe metadata and the order emails.
  variant?: string
  // Shop-page section the product is listed under.
  category: 'top' | 'lower' | 'accessories' | 'running'
  // Hide the catalogue product's general photos on this club PDP (club design renders only).
  hideCatalogImages?: boolean
  price: string
  image: string
  customImages?: string[]
}

export interface Club {
  handle: string
  name: string
  password: string
  // Extra passwords the gate also accepts (all compared case-insensitively).
  // The dashboard's access box only shows `password`.
  altPasswords?: string[]
  tagline: string
  // Kit for this club ships in one consignment to the club's own distributor,
  // so checkout charges no delivery and collects no address. Ask the club when
  // setting the shop up. Display only — the backend decides for real, so the
  // handle must ALSO be in protonlab-backend/config/shipping.js
  // CLUB_DELIVERY_CLUBS, or checkout will still charge postage.
  centralDelivery?: boolean
  products: ClubProduct[]
}

export const clubs: Club[] = [
  {
    handle: 'edinburgh-bike-fitting-club',
    name: 'Edinburgh Bike Fitting Club',
    password: 'EBFSHOP',
    tagline: 'Order window closes **Sunday 18th October**.\nDelivery expected end of November.',
    products: [
      { name: 'SS Race Jersey', handle: 'ss-race-jersey', category: 'top', price: '£95.00',
        image: '/images/clubs/edinburgh-bike-fitting-club/ebfshop-ss-race-jersey-front.jpg',
        customImages: ['/images/clubs/edinburgh-bike-fitting-club/ebfshop-ss-race-jersey-back.jpg'] },
      { name: 'Winter Jacket', handle: 'winter-jacket', category: 'top', price: '£110.00',
        image: '/images/clubs/edinburgh-bike-fitting-club/ebfshop-winter-jacket-front.jpg',
        customImages: ['/images/clubs/edinburgh-bike-fitting-club/ebfshop-winter-jacket-back.jpg'] },
      { name: 'Summer Gilet', handle: 'summer-gilet', category: 'top', price: '£55.00',
        image: '/images/clubs/edinburgh-bike-fitting-club/ebfshop-summer-gilet-front.jpg',
        customImages: ['/images/clubs/edinburgh-bike-fitting-club/ebfshop-summer-gilet-back.jpg'] },
      { name: 'Training Bib Shorts', handle: 'training-bib-shorts', category: 'lower', price: '£90.00',
        image: '/images/clubs/edinburgh-bike-fitting-club/ebfshop-training-bib-shorts-front.jpg',
        customImages: ['/images/clubs/edinburgh-bike-fitting-club/ebfshop-training-bib-shorts-back.jpg'] },
      { name: 'Training Bib Tights', handle: 'training-bib-tights', category: 'lower', price: '£120.00',
        image: '/images/clubs/edinburgh-bike-fitting-club/ebfshop-training-bib-tights-front.jpg',
        customImages: ['/images/clubs/edinburgh-bike-fitting-club/ebfshop-training-bib-tights-back.jpg'] },
    ],
  },
  {
    handle: 'ucl-cycling',
    name: 'UCL Cycling',
    password: 'UCLSHOP',
    centralDelivery: true,
    tagline: 'All prices include the 10% university discount.\nOrder window open **Monday 12th October – Sunday 25th October**.\nDelivery expected end of November.',
    products: [
      { name: 'Club Jersey', handle: 'ss-club-jersey', category: 'top', price: '£45.00',
        image: '/images/clubs/ucl-cycling/ucl-ss-club-jersey-front.jpg',
        customImages: ['/images/clubs/ucl-cycling/ucl-ss-club-jersey-back.jpg'] },
      { name: 'Race Jersey', handle: 'ss-race-jersey', category: 'top', price: '£86.00',
        image: '/images/clubs/ucl-cycling/ucl-ss-race-jersey-front.jpg',
        customImages: ['/images/clubs/ucl-cycling/ucl-ss-race-jersey-back.jpg'] },
      { name: 'Club Bib Shorts', handle: 'club-bib-shorts', category: 'lower', price: '£59.00',
        image: '/images/clubs/ucl-cycling/ucl-club-bib-shorts-front.jpg',
        customImages: ['/images/clubs/ucl-cycling/ucl-club-bib-shorts-back.jpg'] },
      { name: 'Training Bib Shorts', handle: 'training-bib-shorts', category: 'lower', price: '£81.00',
        image: '/images/clubs/ucl-cycling/ucl-training-bib-shorts-front.jpg',
        customImages: ['/images/clubs/ucl-cycling/ucl-training-bib-shorts-back.jpg'] },
      { name: 'SS Roadsuit', handle: 'ss-roadsuit', category: 'lower', price: '£126.00',
        image: '/images/clubs/ucl-cycling/ucl-ss-roadsuit-front.jpg',
        customImages: ['/images/clubs/ucl-cycling/ucl-ss-roadsuit-back.jpg'] },
      { name: 'Summer Gilet', handle: 'summer-gilet-purple-trim', category: 'top',
        catalogHandle: 'summer-gilet', price: '£50.00',
        image: '/images/clubs/ucl-cycling/ucl-summer-gilet-purple-trim-front.jpg',
        customImages: ['/images/clubs/ucl-cycling/ucl-summer-gilet-purple-trim-back.jpg'] },
      { name: 'LS Fleece Jersey', handle: 'ls-fleece-jersey', category: 'top', price: '£81.00',
        image: '/images/clubs/ucl-cycling/ucl-ls-fleece-jersey-front.jpg',
        customImages: ['/images/clubs/ucl-cycling/ucl-ls-fleece-jersey-back.jpg'] },
      { name: 'Winter Jacket', handle: 'winter-jacket', category: 'top', price: '£99.00',
        image: '/images/clubs/ucl-cycling/ucl-winter-jacket-front.jpg',
        customImages: ['/images/clubs/ucl-cycling/ucl-winter-jacket-back.jpg'] },
      { name: 'Bib Tights', handle: 'training-bib-tights', category: 'lower', price: '£108.00',
        image: '/images/clubs/ucl-cycling/ucl-training-bib-tights-front.jpg' },
      { name: 'Aero Socks', handle: 'aero-socks', category: 'accessories', price: '£18.00',
        image: '/images/clubs/ucl-cycling/ucl-aero-socks-front.jpg' },
      { name: 'Mesh Mitts', handle: 'training-mitts', category: 'accessories', price: '£18.00',
        image: '/images/clubs/ucl-cycling/ucl-training-mitts-front.jpg',
        customImages: ['/images/clubs/ucl-cycling/ucl-training-mitts-back.jpg'] },
      { name: 'Arm Warmers', handle: 'arm-warmers', category: 'accessories', price: '£18.00',
        image: '/images/clubs/ucl-cycling/ucl-arm-warmers-front.jpg' },
      { name: 'White Cycling Socks', handle: 'white-cycling-socks', category: 'accessories',
        catalogHandle: 'white-cotton-socks', price: '£10.80',
        image: '/images/products/white-cotton-socks/white-cotton-socks1.jpg' },
    ],
  },
  {
    handle: 'swansea-university-road-team',
    name: 'Swansea University Road Team',
    password: 'SURT',
    centralDelivery: true,
    tagline: 'All prices include the 10% university discount.\nOrder window closes **Wednesday 28th October**.\nDelivery expected end of November.',
    products: [
      { name: 'Club Jersey', handle: 'ss-club-jersey', category: 'top', price: '£45.00',
        image: '/images/clubs/swansea-university-road-team/surt-ss-training-jersey-front.jpg',
        customImages: ['/images/clubs/swansea-university-road-team/surt-ss-training-jersey-back.jpg'] },
      { name: 'Training Jersey', handle: 'ss-training-jersey', category: 'top', price: '£63.00',
        image: '/images/clubs/swansea-university-road-team/surt-ss-training-jersey-front.jpg',
        customImages: ['/images/clubs/swansea-university-road-team/surt-ss-training-jersey-back.jpg'] },
      { name: 'LS Fleece Jersey', handle: 'ls-fleece-jersey', category: 'top', price: '£81.00',
        image: '/images/clubs/swansea-university-road-team/surt-ls-fleece-jersey-front.jpg',
        customImages: ['/images/clubs/swansea-university-road-team/surt-ls-fleece-jersey-back.jpg'] },
      { name: 'Summer Gilet', handle: 'summer-gilet', category: 'top', price: '£50.00',
        image: '/images/clubs/swansea-university-road-team/surt-summer-gilet-front.jpg',
        customImages: ['/images/clubs/swansea-university-road-team/surt-summer-gilet-back.jpg'] },
      { name: 'Running Tee', handle: 'ss-running-tee', category: 'running', price: '£27.00',
        image: '/images/clubs/swansea-university-road-team/surt-ss-running-tee-front.jpg',
        customImages: ['/images/clubs/swansea-university-road-team/surt-ss-running-tee-back.jpg'] },
      { name: 'Club Bib Shorts', handle: 'club-bib-shorts', category: 'lower', price: '£59.00',
        image: '/images/clubs/swansea-university-road-team/surt-club-bib-shorts-front.jpg',
        customImages: ['/images/clubs/swansea-university-road-team/surt-club-bib-shorts-back.jpg'] },
      { name: 'Training Bib Shorts', handle: 'training-bib-shorts', category: 'lower', price: '£81.00',
        image: '/images/clubs/swansea-university-road-team/surt-training-bib-shorts-front.jpg',
        customImages: ['/images/clubs/swansea-university-road-team/surt-training-bib-shorts-back.jpg'] },
      { name: 'SS Trisuit', handle: 'ss-trisuit', category: 'lower', hideCatalogImages: true, price: '£135.00',
        image: '/images/clubs/swansea-university-road-team/surt-ss-roadsuit-front.jpg',
        customImages: ['/images/clubs/swansea-university-road-team/surt-ss-roadsuit-back.jpg'] },
      { name: 'SS Roadsuit', handle: 'ss-roadsuit', category: 'lower', price: '£126.00',
        image: '/images/clubs/swansea-university-road-team/surt-ss-roadsuit-front.jpg',
        customImages: ['/images/clubs/swansea-university-road-team/surt-ss-roadsuit-back.jpg'] },
      { name: 'Aero Socks', handle: 'aero-socks', category: 'accessories', price: '£18.00',
        image: '/images/clubs/swansea-university-road-team/surt-aero-socks-front.jpg' },
      { name: 'Arm Warmers', handle: 'arm-warmers', category: 'accessories', hideCatalogImages: true, price: '£18.00',
        image: '/images/clubs/swansea-university-road-team/surt-arm-warmers-front.jpg' },
      { name: 'White Cycling Socks', handle: 'white-cycling-socks', category: 'accessories',
        catalogHandle: 'white-cotton-socks', price: '£10.80',
        image: '/images/products/white-cotton-socks/white-cotton-socks1.jpg' },
      { name: 'Buff', handle: 'buff', category: 'accessories', price: '£9.00',
        image: '/images/clubs/swansea-university-road-team/surt-buff-front.jpg',
        customImages: ['/images/clubs/swansea-university-road-team/surt-buff-back.jpg'] },
    ],
  },
  {
    handle: 'university-of-bristol-cycling-club',
    name: 'University of Bristol Cycling Club',
    password: 'BRISTOL',
    centralDelivery: true,
    tagline: 'All prices include the 10% university discount.\nOrder window open **Tuesday 6th October – Thursday 22nd October** (closes midnight).\nDelivery expected end of November.',
    products: [
      { name: 'SS Race Jersey', handle: 'ss-race-jersey', category: 'top', price: '£86.00',
        image: '/images/clubs/university-of-bristol-cycling-club/uobcc-ss-training-jersey-front.jpg',
        customImages: ['/images/clubs/university-of-bristol-cycling-club/uobcc-ss-training-jersey-back.jpg'] },
      { name: 'SS Training Jersey', handle: 'ss-training-jersey', category: 'top', price: '£63.00',
        image: '/images/clubs/university-of-bristol-cycling-club/uobcc-ss-training-jersey-front.jpg',
        customImages: ['/images/clubs/university-of-bristol-cycling-club/uobcc-ss-training-jersey-back.jpg'] },
      { name: 'SS Club Jersey', handle: 'ss-club-jersey', category: 'top', price: '£45.00',
        image: '/images/clubs/university-of-bristol-cycling-club/uobcc-ss-training-jersey-front.jpg',
        customImages: ['/images/clubs/university-of-bristol-cycling-club/uobcc-ss-training-jersey-back.jpg'] },
      { name: 'LS Fleece Jersey', handle: 'ls-fleece-jersey', category: 'top', price: '£81.00',
        image: '/images/clubs/university-of-bristol-cycling-club/uobcc-ls-fleece-jersey-front.jpg',
        customImages: ['/images/clubs/university-of-bristol-cycling-club/uobcc-ls-fleece-jersey-back.jpg'] },
      { name: 'LS MTB Jersey', handle: 'mtb-jersey', category: 'top', hideCatalogImages: true, price: '£31.50',
        image: '/images/clubs/university-of-bristol-cycling-club/uobcc-mtb-jersey-front.jpg',
        customImages: ['/images/clubs/university-of-bristol-cycling-club/uobcc-mtb-jersey-back.jpg'] },
      { name: 'Summer Gilet', handle: 'summer-gilet', category: 'top', price: '£50.00',
        image: '/images/clubs/university-of-bristol-cycling-club/uobcc-summer-gilet-front.jpg',
        customImages: ['/images/clubs/university-of-bristol-cycling-club/uobcc-summer-gilet-back.jpg'] },
      { name: 'Training Bib Shorts', handle: 'training-bib-shorts', category: 'lower', price: '£81.00',
        image: '/images/clubs/university-of-bristol-cycling-club/uobcc-training-bib-shorts-front.jpg',
        customImages: ['/images/clubs/university-of-bristol-cycling-club/uobcc-training-bib-shorts-back.jpg'] },
      { name: 'Club Bib Shorts', handle: 'club-bib-shorts', category: 'lower', price: '£59.00',
        image: '/images/clubs/university-of-bristol-cycling-club/uobcc-club-bib-shorts-front.jpg',
        customImages: ['/images/clubs/university-of-bristol-cycling-club/uobcc-club-bib-shorts-back.jpg'] },
      { name: 'SS Roadsuit', handle: 'ss-roadsuit', category: 'lower', price: '£126.00',
        image: '/images/clubs/university-of-bristol-cycling-club/uobcc-ss-roadsuit-front.jpg',
        customImages: ['/images/clubs/university-of-bristol-cycling-club/uobcc-ss-roadsuit-back.jpg'] },
      { name: 'Arm Warmers', handle: 'arm-warmers', category: 'accessories', price: '£18.00',
        image: '/images/clubs/university-of-bristol-cycling-club/uobcc-arm-warmers-front.jpg' },
      { name: 'White Cycling Socks', handle: 'white-cycling-socks', category: 'accessories',
        catalogHandle: 'white-cotton-socks', price: '£10.80',
        image: '/images/products/white-cotton-socks/white-cotton-socks1.jpg' },
    ],
  },
  {
    handle: 'university-of-bath-cycling-club',
    name: 'University of Bath Cycling Club',
    password: 'bath',
    altPasswords: ['uptheUOBCC2026'],
    centralDelivery: true,
    tagline: 'All prices include the 10% university discount.\nOrder window open **Monday 5th October – Sunday 18th October** (closes midnight).\nDelivery expected late November.',
    products: [
      { name: 'SS Race Jersey', handle: 'ss-race-jersey', category: 'top', price: '£86.00',
        image: '/images/clubs/university-of-bath-cycling-club/bath-ss-race-jersey-front.jpg',
        customImages: ['/images/clubs/university-of-bath-cycling-club/bath-ss-race-jersey-back.jpg'] },
      { name: 'SS Club Jersey', handle: 'ss-club-jersey', category: 'top', price: '£45.00',
        image: '/images/clubs/university-of-bath-cycling-club/bath-ss-club-jersey-front.jpg',
        customImages: ['/images/clubs/university-of-bath-cycling-club/bath-ss-club-jersey-back.jpg?v=2'] },
      { name: 'LS MTB Jersey', handle: 'mtb-jersey', category: 'top', hideCatalogImages: true, price: '£31.50',
        image: '/images/clubs/university-of-bath-cycling-club/bath-mtb-jersey-front.jpg',
        customImages: ['/images/clubs/university-of-bath-cycling-club/bath-mtb-jersey-back.jpg'] },
      { name: 'LS Fleece Jersey', handle: 'ls-fleece-jersey', category: 'top', price: '£81.00',
        image: '/images/clubs/university-of-bath-cycling-club/bath-ls-fleece-jersey-front.jpg?v=2',
        customImages: ['/images/clubs/university-of-bath-cycling-club/bath-ls-fleece-jersey-back.jpg'] },
      { name: 'Winter Jacket', handle: 'winter-jacket', category: 'top', price: '£99.00',
        image: '/images/clubs/university-of-bath-cycling-club/bath-winter-jacket-front.jpg?v=2',
        customImages: ['/images/clubs/university-of-bath-cycling-club/bath-winter-jacket-back.jpg'] },
      { name: 'Summer Gilet', handle: 'summer-gilet', category: 'top', price: '£50.00',
        image: '/images/clubs/university-of-bath-cycling-club/bath-summer-gilet-front.jpg',
        customImages: ['/images/clubs/university-of-bath-cycling-club/bath-summer-gilet-back.jpg'] },
      // Two colourways of the training bib short. Elijah's call (2026-10-05):
      // the flat strap artwork looked odd, so the black pair shows the
      // catalogue photo (as on the Bristol product); there is no white
      // catalogue photo, so the white pair keeps its club render and the
      // catalogue photo follows it in the gallery.
      { name: 'White Training Bib Shorts', handle: 'white-training-bib-shorts', category: 'lower',
        catalogHandle: 'training-bib-shorts', variant: 'White', price: '£81.00',
        image: '/images/clubs/university-of-bath-cycling-club/bath-white-training-bib-shorts-front.jpg',
        customImages: ['/images/clubs/university-of-bath-cycling-club/bath-white-training-bib-shorts-back.jpg'] },
      { name: 'Black Training Bib Shorts', handle: 'black-training-bib-shorts', category: 'lower',
        catalogHandle: 'training-bib-shorts', variant: 'Black', price: '£81.00',
        image: '/images/clubs/university-of-bath-cycling-club/bath-black-training-bib-shorts-front.jpg?v=2',
        customImages: ['/images/clubs/university-of-bath-cycling-club/bath-black-training-bib-shorts-back.jpg?v=2'] },
      { name: 'Training Bib Tights', handle: 'training-bib-tights', category: 'lower', price: '£108.00',
        image: '/images/clubs/university-of-bath-cycling-club/bath-training-bib-tights-front.jpg?v=2',
        customImages: ['/images/clubs/university-of-bath-cycling-club/bath-training-bib-tights-back.jpg'] },
      { name: 'SS Roadsuit', handle: 'ss-roadsuit', category: 'lower', price: '£126.00',
        image: '/images/clubs/university-of-bath-cycling-club/bath-ss-roadsuit-front.jpg?v=2',
        customImages: ['/images/clubs/university-of-bath-cycling-club/bath-ss-roadsuit-back.jpg?v=2'] },
      { name: 'LS Speedsuit', handle: 'ls-speedsuit', category: 'lower', price: '£153.00',
        image: '/images/clubs/university-of-bath-cycling-club/bath-ls-speedsuit-front.jpg',
        customImages: ['/images/clubs/university-of-bath-cycling-club/bath-ls-speedsuit-back.jpg'] },
      // Standard (undesigned) accessories: catalogue photo where one exists,
      // the blank placeholder otherwise. Image URLs match products.ts exactly
      // so the gallery doesn't repeat them.
      { name: 'Aero Socks', handle: 'aero-socks', category: 'accessories', price: '£18.00',
        image: '/images/clubs/university-of-bath-cycling-club/bath-aero-socks-front.jpg' },
      { name: 'Arm Warmers', handle: 'arm-warmers', category: 'accessories', price: '£18.00',
        image: '/images/products/arm-warmers/arm-warmers1.jpg' },
      { name: 'Leg Warmers', handle: 'leg-warmers', category: 'accessories', price: '£27.00',
        image: '/images/products/leg-warmers/leg-warmers1.jpg?v=3' },
      { name: 'Aero Arm Warmers', handle: 'aero-arm-warmers', category: 'accessories', price: '£22.50',
        image: '/images/products/aero-arm-warmers/aero-arm-warmers1.jpg?v=3' },
      { name: 'Aero Leg Warmers', handle: 'aero-leg-warmers', category: 'accessories', price: '£31.50',
        image: '/images/products/aero-leg-warmers/aero-leg-warmers1.jpg' },
      { name: 'White Cycling Socks', handle: 'white-cycling-socks', category: 'accessories',
        catalogHandle: 'white-cotton-socks', price: '£10.80',
        image: '/images/products/white-cotton-socks/white-cotton-socks1.jpg' },
    ],
  },
]

export function getClubByHandle(handle: string): Club | undefined {
  return clubs.find(c => c.handle === handle)
}

export function getClubByPassword(password: string): Club | undefined {
  const entered = password.toLowerCase()
  return clubs.find(c =>
    [c.password].concat(c.altPasswords ?? []).some(p => p.toLowerCase() === entered)
  )
}
