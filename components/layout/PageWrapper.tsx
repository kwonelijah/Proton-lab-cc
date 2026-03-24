import Navbar from './Navbar'
import Footer from './Footer'

interface PageWrapperProps {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export default function PageWrapper({ children, className = '', noPadding = false }: PageWrapperProps) {
  return (
    <>
      <Navbar />
      <main id="main-content" className={`min-h-screen ${noPadding ? '' : 'pt-20'} ${className}`}>
        {children}
      </main>
      <Footer />
    </>
  )
}
