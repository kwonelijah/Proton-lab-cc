import Image from 'next/image'

interface EditorialItem {
  imageSrc: string
  imageAlt?: string
  caption?: string
}

interface EditorialGridProps {
  items: EditorialItem[]
  className?: string
}

export default function EditorialGrid({ items, className = '' }: EditorialGridProps) {
  if (items.length === 3) {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 ${className}`}>
        {/* Large image — spans 2 rows on desktop */}
        <div className="col-span-2 md:col-span-2 md:row-span-2 relative overflow-hidden aspect-[4/3] md:aspect-auto md:min-h-[500px] group bg-proton-light">
          <Image
            src={items[0].imageSrc}
            alt={items[0].imageAlt ?? ''}
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
          {items[0].caption && (
            <p className="absolute bottom-3 left-3 text-[10px] text-proton-white/70 uppercase tracking-widest">
              {items[0].caption}
            </p>
          )}
        </div>

        {/* Two smaller images stacked */}
        {items.slice(1).map((item, i) => (
          <div
            key={i}
            className="col-span-1 relative overflow-hidden aspect-square group bg-proton-light"
          >
            <Image
              src={item.imageSrc}
              alt={item.imageAlt ?? ''}
              fill
              sizes="(max-width: 768px) 50vw, 20vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
            {item.caption && (
              <p className="absolute bottom-3 left-3 text-[10px] text-proton-white/70 uppercase tracking-widest">
                {item.caption}
              </p>
            )}
          </div>
        ))}
      </div>
    )
  }

  // 4-item asymmetric layout
  if (items.length === 4) {
    return (
      <div className={`grid grid-cols-4 gap-2 md:gap-3 ${className}`}>
        <div className="col-span-3 relative overflow-hidden aspect-[16/9] group bg-proton-light">
          <Image src={items[0].imageSrc} alt={items[0].imageAlt ?? ''} fill className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" sizes="75vw" />
        </div>
        <div className="col-span-1 relative overflow-hidden aspect-[9/16] group bg-proton-light">
          <Image src={items[1].imageSrc} alt={items[1].imageAlt ?? ''} fill className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" sizes="25vw" />
        </div>
        <div className="col-span-1 relative overflow-hidden aspect-[9/16] group bg-proton-light">
          <Image src={items[2].imageSrc} alt={items[2].imageAlt ?? ''} fill className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" sizes="25vw" />
        </div>
        <div className="col-span-3 relative overflow-hidden aspect-[16/9] group bg-proton-light">
          <Image src={items[3].imageSrc} alt={items[3].imageAlt ?? ''} fill className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" sizes="75vw" />
        </div>
      </div>
    )
  }

  // Fallback: uniform grid
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 ${className}`}>
      {items.map((item, i) => (
        <div key={i} className="relative overflow-hidden aspect-square group bg-proton-light">
          <Image
            src={item.imageSrc}
            alt={item.imageAlt ?? ''}
            fill
            sizes="33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        </div>
      ))}
    </div>
  )
}
