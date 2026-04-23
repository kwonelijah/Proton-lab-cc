import type { Metadata } from 'next'
import Image from 'next/image'
import PageWrapper from '@/components/layout/PageWrapper'
import CTABanner from '@/components/sections/CTABanner'

export const metadata: Metadata = {
  title: 'Team',
}

const teamMembers = [
  {
    name: 'Alex Thornton',
    role: 'Road Racing Ambassador',
    bio: 'Category 1 road racer. Three national championship podiums. Develops the Aero Series through race-day testing.',
    imageSeed: 'team-1',
  },
  {
    name: 'Mia Sorensen',
    role: 'Endurance Ambassador',
    bio: 'Ultra-endurance specialist. Has completed every major European sportive. The Endurance Series is built around her feedback.',
    imageSeed: 'team-2',
  },
  {
    name: 'Jack Fielding',
    role: 'Track & Crit Ambassador',
    bio: 'National crit series winner. Specialises in high-intensity, short-format racing. Tests the limits of our aerodynamic construction.',
    imageSeed: 'team-3',
  },
  {
    name: 'Sara Walsh',
    role: 'Gran Fondo Ambassador',
    bio: 'Cyclosportive enthusiast and coach. Rides 20,000km per year and provides feedback across all three of our collections.',
    imageSeed: 'team-4',
  },
  {
    name: 'Tom Byrne',
    role: 'Gravel Ambassador',
    bio: 'Gravel and mixed-surface specialist. His input pushed us to extend the Endurance range into variable-condition riding.',
    imageSeed: 'team-5',
  },
  {
    name: 'Elise Marchetti',
    role: 'Triathlon Ambassador',
    bio: 'Ironman age-group podium finisher. Works with us on aero efficiency in the TT position and transition-friendly construction.',
    imageSeed: 'team-6',
  },
]

export default function TeamPage() {
  return (
    <PageWrapper>
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32">
        <div className="max-w-2xl mb-16 md:mb-24">
          <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-4">
            The Athletes
          </p>
          <h1 className="font-playfair text-5xl md:text-7xl leading-none mb-8">
            Our Team
          </h1>
          <p className="text-proton-grey leading-relaxed">
            Proton Lab CC garments are developed in collaboration with the athletes who wear them.
            Every collection reflects their feedback, their demands, and their standards.
          </p>
        </div>

        {/* Team grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
          {teamMembers.map(member => (
            <div key={member.name} className="group">
              <div className="relative overflow-hidden aspect-square bg-proton-light mb-5">
                <Image
                  src={`https://picsum.photos/seed/${member.imageSeed}/600/600`}
                  alt={member.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-1">
                {member.role}
              </p>
              <h3 className="font-playfair text-xl mb-3">{member.name}</h3>
              <p className="text-sm text-proton-grey leading-relaxed">{member.bio}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Team store CTA */}
      <div className="border-t border-proton-light py-16 mb-0">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <p className="text-[10px] text-proton-grey uppercase tracking-widest mb-2">
                For Clubs & Teams
              </p>
              <p className="font-playfair text-2xl md:text-3xl">
                Interested in a team kit?
              </p>
            </div>
            <a
              href="/contact"
              className="inline-flex items-center text-xs uppercase tracking-widest border-b border-proton-black pb-0.5 hover:opacity-60 transition-opacity duration-200"
            >
              Get in touch
            </a>
          </div>
        </div>
      </div>

      <CTABanner
        headline="No compromise. No colour."
        ctaText="Shop"
        ctaHref="/shop"
        inverted
      />
    </PageWrapper>
  )
}
