import type { Collection } from '@/types/collection'
import { products } from './products'

export const collections: Collection[] = [
  {
    id: 'col_001',
    handle: 'aero-series',
    title: 'Aero Series',
    description:
      'Engineered for competition. Every panel optimised in the wind tunnel, every gram accounted for. The Aero Series is for those who race without compromise.',
    image: {
      url: 'https://picsum.photos/seed/aero-col/1200/800',
      altText: 'Aero Series — wind-tunnel tested cycling apparel',
    },
    products: {
      nodes: products.filter(p =>
        p.collections?.nodes.some(c => c.handle === 'aero-series')
      ),
    },
  },
  {
    id: 'col_002',
    handle: 'endurance-series',
    title: 'Endurance Series',
    description:
      'Built for the long ride. Comfort without compromise over six hours in the saddle. The Endurance Series keeps you going when the kilometres accumulate.',
    image: {
      url: 'https://picsum.photos/seed/endurance-col/1200/800',
      altText: 'Endurance Series — long-ride comfort cycling apparel',
    },
    products: {
      nodes: products.filter(p =>
        p.collections?.nodes.some(c => c.handle === 'endurance-series')
      ),
    },
  },
  {
    id: 'col_003',
    handle: 'training-series',
    title: 'Training Series',
    description:
      'The volume demands durability. Training Series delivers Proton Lab quality at a price point built for daily use — because your training kit takes the most punishment.',
    image: {
      url: 'https://picsum.photos/seed/training-col/1200/800',
      altText: 'Training Series — everyday cycling training apparel',
    },
    products: {
      nodes: products.filter(p =>
        p.collections?.nodes.some(c => c.handle === 'training-series')
      ),
    },
  },
]
