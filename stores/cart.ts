import { create } from 'zustand'

export interface CartItem {
  id: string // unique: clubHandle + productHandle + size
  clubHandle: string
  clubName: string
  productHandle: string
  productName: string
  size: string
  price: string // GBP amount string e.g. "80.00"
  quantity: number
  image?: string
}

interface CartStore {
  items: CartItem[]
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  addItem: (item: Omit<CartItem, 'id' | 'quantity'>) => void
  removeItem: (id: string) => void
  clearCart: () => void
  totalItems: () => number
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  isOpen: false,

  openCart: () => set({ isOpen: true }),
  closeCart: () => set({ isOpen: false }),

  addItem: (item) => {
    const id = `${item.clubHandle}-${item.productHandle}-${item.size}`
    set(state => {
      const existing = state.items.find(i => i.id === id)
      if (existing) {
        return {
          items: state.items.map(i =>
            i.id === id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        }
      }
      return { items: [...state.items, { ...item, id, quantity: 1 }] }
    })
  },

  removeItem: (id) => set(state => ({
    items: state.items.filter(i => i.id !== id),
  })),

  clearCart: () => set({ items: [] }),

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}))
