import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

interface OrderItem {
  clubName: string
  productName: string
  size: string
  price: string
  quantity: number
}

export async function POST(req: Request) {
  const { name, email, phone, items }: { name: string; email: string; phone?: string; items: OrderItem[] } = await req.json()

  if (!name || !email || !items?.length) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const clubName = items[0].clubName
  const itemRows = items.map(item =>
    `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${item.productName}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${item.size}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${item.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${item.price}</td>
    </tr>`
  ).join('')

  const textSummary = items.map(i =>
    `${i.productName} — Size: ${i.size} × ${i.quantity} — ${i.price}`
  ).join('\n')

  const { error } = await resend.emails.send({
    from: 'Proton Lab CC <noreply@protonlab.cc>',
    to: 'info@protonlab.cc',
    replyTo: email,
    subject: `Club Order: ${clubName} — ${name}`,
    text: `Club: ${clubName}\nName: ${name}\nEmail: ${email}\nPhone: ${phone || '—'}\n\nItems:\n${textSummary}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
        <h2 style="font-size:18px;margin-bottom:24px;">New Club Kit Order</h2>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;width:100px;color:#666;font-size:13px;">Club</td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${clubName}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;color:#666;font-size:13px;">Name</td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${name}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;color:#666;font-size:13px;">Email</td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">
              <a href="mailto:${email}" style="color:#1a1a1a;">${email}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;color:#666;font-size:13px;">Phone</td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${phone || '—'}</td>
          </tr>
        </table>

        <p style="font-size:13px;color:#666;margin-bottom:12px;">Order Summary</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px 0;border-bottom:1px solid #1a1a1a;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#666;font-weight:normal;">Product</th>
              <th style="text-align:left;padding:8px 0;border-bottom:1px solid #1a1a1a;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#666;font-weight:normal;">Size</th>
              <th style="text-align:left;padding:8px 0;border-bottom:1px solid #1a1a1a;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#666;font-weight:normal;">Qty</th>
              <th style="text-align:left;padding:8px 0;border-bottom:1px solid #1a1a1a;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#666;font-weight:normal;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
        <p style="font-size:11px;color:#999;">Reply directly to this email to respond to ${name}.</p>
      </div>
    `,
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
