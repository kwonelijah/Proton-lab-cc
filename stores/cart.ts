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
  maxQuantity?: number // units on hand; undefined = no cap (custom team kits)
  image?: string
}

interface CartStore {
  items: CartItem[]
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  addItem: (item: Omit<CartItem, 'id' | 'quantity'>) => { ok: boolean; reason?: 'out-of-stock' | 'max-reached' }
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
    const cap = item.maxQuantity
    if (cap !== undefined && cap <= 0) return { ok: false, reason: 'out-of-stock' }
    const existing = get().items.find(i => i.id === id)
    if (existing && cap !== undefined && existing.quantity >= cap) {
      return { ok: false, reason: 'max-reached' }
    }
    set(state => {
      if (existing) {
        return {
          items: state.items.map(i =>
            i.id === id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        }
      }
      return { items: [...state.items, { ...item, id, quantity: 1 }] }
    })
    return { ok: true }
  },

  removeItem: (id) => set(state => ({
    items: state.items.filter(i => i.id !== id),
  })),

  clearCart: () => set({ items: [] }),

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}))
