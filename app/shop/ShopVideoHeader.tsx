import Image from 'next/image'

export default function ShopVideoHeader() {
  return (
    <div className="relative min-h-screen bg-proton-black overflow-hidden flex items-end">
      <Image
        src="/images/hero/Shop.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-80"
      />
      <div className="absolute inset-0 bg-proton-black/30" />
      <div className="absolute inset-0 flex items-end">
        <div className="max-w-7xl w-full mx-auto px-6 md:px-12 pb-10 md:pb-14">
          <p className="text-[10px] text-proton-white/60 uppercase tracking-widest mb-2">In Stock</p>
          <h1 className="font-playfair text-5xl md:text-7xl text-proton-white leading-none">
            Shop
          </h1>
        </div>
      </div>
    </div>
  )
}
