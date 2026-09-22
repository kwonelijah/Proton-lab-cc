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
  tagline: string
  products: ClubProduct[]
}

export const clubs: Club[] = [
  {
    handle: 'edinburgh-bike-fitting-club',
    name: 'Edinburgh Bike Fitting Club',
    password: 'EBFSHOP',
    tagline: 'Your club kit — order directly below. Order Window closes Midnight Sunday 14th June.',
    products: [
      { name: 'SS Race Jersey', handle: 'ss-race-jersey', category: 'top', price: '£80.00',
        image: '/images/clubs/edinburgh-bike-fitting-club/ss-race-jersey-front.jpg?v=2',
        customImages: ['/images/clubs/edinburgh-bike-fitting-club/ss-race-jersey-back.jpg?v=2'] },
      { name: 'Race Bib Shorts', handle: 'race-bib-shorts', category: 'lower', price: '£90.00',
        image: '/images/clubs/edinburgh-bike-fitting-club/race-bib-shorts-front.jpg?v=2',
        customImages: ['/images/clubs/edinburgh-bike-fitting-club/race-bib-shorts-back.jpg?v=2'] },
      { name: 'SS Roadsuit', handle: 'ss-roadsuit', category: 'lower', price: '£120.00',
        image: '/images/clubs/edinburgh-bike-fitting-club/ss-roadsuit-front.jpg?v=2',
        customImages: ['/images/clubs/edinburgh-bike-fitting-club/ss-roadsuit-back.jpg?v=2'] },
      { name: 'Summer Gilet', handle: 'summer-gilet', category: 'top', price: '£55.00',
        image: '/images/clubs/edinburgh-bike-fitting-club/summer-gilet-front.jpg?v=2',
        customImages: ['/images/clubs/edinburgh-bike-fitting-club/summer-gilet-back.jpg?v=2'] },
      { name: 'LS Fleece Jersey', handle: 'ls-fleece-jersey', category: 'top', price: '£85.00',
        image: '/images/clubs/edinburgh-bike-fitting-club/ls-fleece-jersey-front.jpg?v=2',
        customImages: ['/images/clubs/edinburgh-bike-fitting-club/ls-fleece-jersey-back.jpg?v=2'] },
    ],
  },
  {
    handle: 'ucl-cycling',
    name: 'UCL Cycling',
    password: 'UCLSHOP',
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
    ],
  },
  {
    handle: 'swansea-university-road-team',
    name: 'Swansea University Road Team',
    password: 'SURT',
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
      { name: 'Club Shorts', handle: 'club-bib-shorts', category: 'lower', hideCatalogImages: true, price: '£59.00',
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
      { name: 'Buff', handle: 'buff', category: 'accessories', price: '£9.00',
        image: '/images/clubs/swansea-university-road-team/surt-buff-front.jpg',
        customImages: ['/images/clubs/swansea-university-road-team/surt-buff-back.jpg'] },
    ],
  },
]

export function getClubByHandle(handle: string): Club | undefined {
  return clubs.find(c => c.handle === handle)
}

export function getClubByPassword(password: string): Club | undefined {
  return clubs.find(c => c.password.toLowerCase() === password.toLowerCase())
}
