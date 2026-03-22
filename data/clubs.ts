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
      { name: 'SS Race Jersey', handle: 'ss-race-jersey', price: '£80.00', image: '/images/clubs/edinburgh-bike-fitting-club/ss-race-jersey.jpg' },
      { name: 'Training Bib Shorts', handle: 'training-bib-shorts', price: '£80.00', image: '/images/clubs/edinburgh-bike-fitting-club/training-bib-shorts.jpg' },
      { name: 'SS Roadsuit', handle: 'ss-roadsuit', price: '£120.00', image: '/images/clubs/edinburgh-bike-fitting-club/ss-roadsuit.jpg' },
    ],
  },
]

export function getClubByHandle(handle: string): Club | undefined {
  return clubs.find(c => c.handle === handle)
}

export function getClubByPassword(password: string): Club | undefined {
  return clubs.find(c => c.password === password)
}
