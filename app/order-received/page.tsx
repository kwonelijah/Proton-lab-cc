import PageWrapper from '@/components/layout/PageWrapper'
import OrderReceived from './OrderReceived'

// Landing page after a bank-transfer club-shop order (CartDrawer → backend
// api/bank-transfer-order). The Stripe equivalent is /success.
export default function OrderReceivedPage() {
  return (
    <PageWrapper>
      <OrderReceived />
    </PageWrapper>
  )
}
