export interface ClubProduct {
  name: string
  handle: string
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
    tagline: 'Your club kit — order directly below.',
    products: [
      { name: 'SS Race Jersey', handle: 'ss-race-jersey', price: '£80.00',
        image: '/images/clubs/edinburgh-bike-fitting-club/ss-race-jersey-front.jpg?v=2',
        customImages: ['/images/clubs/edinburgh-bike-fitting-club/ss-race-jersey-back.jpg?v=2'] },
      { name: 'Race Bib Shorts', handle: 'race-bib-shorts', price: '£90.00',
        image: '/images/clubs/edinburgh-bike-fitting-club/race-bib-shorts-front.jpg?v=2',
        customImages: ['/images/clubs/edinburgh-bike-fitting-club/race-bib-shorts-back.jpg?v=2'] },
      { name: 'SS Roadsuit', handle: 'ss-roadsuit', price: '£120.00',
        image: '/images/clubs/edinburgh-bike-fitting-club/ss-roadsuit-front.jpg?v=2',
        customImages: ['/images/clubs/edinburgh-bike-fitting-club/ss-roadsuit-back.jpg?v=2'] },
      { name: 'Summer Gilet', handle: 'summer-gilet', price: '£55.00',
        image: '/images/clubs/edinburgh-bike-fitting-club/summer-gilet-front.jpg?v=2',
        customImages: ['/images/clubs/edinburgh-bike-fitting-club/summer-gilet-back.jpg?v=2'] },
      { name: 'LS Fleece Jersey', handle: 'ls-fleece-jersey', price: '£85.00',
        image: '/images/clubs/edinburgh-bike-fitting-club/ls-fleece-jersey-front.jpg?v=2',
        customImages: ['/images/clubs/edinburgh-bike-fitting-club/ls-fleece-jersey-back.jpg?v=2'] },
    ],
  },
  {
    handle: 'hamish-mayes',
    name: 'Hamish Mayes',
    password: 'HAMISH',
    tagline: 'Your kit — order directly below.',
    products: [
      { name: 'Training Bib Shorts', handle: 'training-bib-shorts', price: '£70.00', image: '/images/products/training-bib-shorts/training-bib-shorts1.jpg' },
    ],
  },
]

export function getClubByHandle(handle: string): Club | undefined {
  return clubs.find(c => c.handle === handle)
}

export function getClubByPassword(password: string): Club | undefined {
  return clubs.find(c => c.password.toLowerCase() === password.toLowerCase())
}
