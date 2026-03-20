import type { Collection } from '@/types/collection'
import { products } from './products'

export const collections: Collection[] = [
  {
    id: 'col_001',
    handle: 'race',
    title: 'Race',
    description:
      'Engineered for competition. From race jerseys and skinsuits to aerosuits and time trial kit — everything you need to race without compromise.',
    image: {
      url: '/images/collections/collection1.JPG',
      altText: 'Proton Lab CC Race Collection',
    },
    products: {
      nodes: products.filter(p =>
        p.collections?.nodes.some(c => c.handle === 'race')
      ),
    },
  },
  {
    id: 'col_002',
    handle: 'training',
    title: 'Training',
    description:
      'Built for the volume. Proton Lab quality in kit designed for daily training — durable, comfortable, and built to last the season.',
    image: {
      url: '/images/collections/collection2.JPG',
      altText: 'Proton Lab CC Training Collection',
    },
    products: {
      nodes: products.filter(p =>
        p.collections?.nodes.some(c => c.handle === 'training')
      ),
    },
  },
]
