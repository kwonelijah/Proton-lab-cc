import type { JournalPost } from '@/types/journal'

export const journalPosts: JournalPost[] = [
  {
    id: 'post_001',
    handle: 'wind-tunnel-testing-aero-series',
    title: 'Inside the Wind Tunnel: Developing the Aero Series',
    excerpt:
      'We spent three days at the Silverstone Sports Engineering Hub. Here is what we learned about fabric behaviour at race speeds — and why the numbers surprised us.',
    publishedAt: '2026-02-14T09:00:00Z',
    author: { name: 'The Proton Lab Team' },
    image: {
      url: 'https://picsum.photos/seed/wind-tunnel/1200/800',
      altText: 'Wind tunnel testing session at Silverstone',
    },
    tags: ['aero', 'development', 'technology', 'behind-the-scenes'],
    content: `The Silverstone Sports Engineering Hub sits at the edge of the famous circuit, its test section humming at 60mph as we walked in on the first morning.

We had three days to validate the Aero Series fabric selection and panel construction before committing to production. What followed was the most data-dense development process we have run to date.

The headline finding: fabric texture matters more than fabric weight at race speeds. A 10g/m² lighter fabric with a smooth face lost 8 watts compared to our slightly heavier textured option. At 40kph, that is 12 seconds per 10km. Over an Ironman bike leg, the numbers are significant.

The second lesson was about seam placement. Our original 12-panel construction placed a seam directly over the quad — exactly where airflow separates. Moving that seam 15mm inward, based on the tunnel data, saved another 4 watts.

The result is a garment that looks minimal but carries months of iterative testing in every stitch.`,
  },
  {
    id: 'post_002',
    handle: 'spring-classics-kit-guide',
    title: 'The Spring Classics Kit Guide',
    excerpt:
      'Cobbles, rain, and six hours in the saddle. We break down exactly what to wear from Flanders to Roubaix — and why layering strategy matters more than any single garment.',
    publishedAt: '2026-01-28T09:00:00Z',
    author: { name: 'The Proton Lab Team' },
    image: {
      url: 'https://picsum.photos/seed/spring-classics/1200/800',
      altText: 'Cobbled road in the spring classics',
    },
    tags: ['racing', 'guide', 'classics', 'spring'],
    content: `The Spring Classics present a unique kit challenge. You will leave the start line in 4°C and reach the finish in 14°C. The roads will be wet at 9am and dusty by noon. You might face sidewinds on the exposed Flemish farmland and climb out of the saddle on the Koppenberg.

No single garment covers all of that. Layering strategy is everything.

Our recommended setup for a sportive-distance classics ride:

Base layer first. Merino or a moisture-wicking synthetic. This is the garment that manages the moisture that will build after the first hour. Get this wrong and no amount of outer layers will help.

The Endurance Long Sleeve Jersey handles the mid-layer role here. The merino blend regulates temperature better than a pure synthetic across the range you will encounter. Thumb loops prevent the sleeves riding up.

Top that with the Endurance Gilet on the start line. It folds into its own pocket for the climbs. You will be grateful for it at the finish when the temperature drops again.

For the legs: the Endurance Bib Tight is designed for exactly these conditions. The articulated knee panels mean you are not fighting the fabric on the climbs.`,
  },
  {
    id: 'post_003',
    handle: 'why-we-chose-monochrome',
    title: 'Why We Chose Monochrome',
    excerpt:
      'On the decision to strip colour from our palette and let form and function speak. A conversation about restraint, identity, and what premium really means.',
    publishedAt: '2026-01-10T09:00:00Z',
    author: { name: 'The Proton Lab Team' },
    image: {
      url: 'https://picsum.photos/seed/monochrome/1200/800',
      altText: 'Monochrome fabric and garment details',
    },
    tags: ['design', 'brand', 'philosophy', 'monochrome'],
    content: `The brief we gave ourselves when starting Proton Lab CC was simple: make the best cycling apparel we could, then figure out what it should look like.

What it looks like is almost nothing.

Black. Off-white. A grey that sits between the two. No logo larger than necessary. No colour for the sake of colour.

This was not a default. It was a decision made after months of sampling fabrics in various colourways and asking ourselves the same question each time: does this colour add to the garment, or is it distracting from it?

The answer, almost every time, was that colour distracted. It drew the eye away from the cut, the construction detail, the panel work that we had spent months refining.

Restraint is harder than expression. Anyone can add colour. Stripping everything back until only what matters remains — that takes conviction.

We also noticed something in the market: the brands whose products we respected most were the ones where the garment itself communicated quality before you even touched it. The cut did the talking. The fabric did the talking.

We wanted Proton Lab CC to be that kind of brand.`,
  },
]
