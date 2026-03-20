import Navbar from './Navbar'
import Footer from './Footer'

interface PageWrapperProps {
  children: React.ReactNode
  className?: string
}

export default function PageWrapper({ children, className = '' }: PageWrapperProps) {
  return (
    <>
      <Navbar />
      <main className={`min-h-screen pt-16 ${className}`}>
        {children}
      </main>
      <Footer />
    </>
  )
}
