import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { name, email, size, productName, clubName, price } = await req.json()

  if (!name || !email || !size || !productName || !clubName) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { error } = await resend.emails.send({
    from: 'Proton Lab CC <noreply@protonlab.cc>',
    to: 'info@protonlab.cc',
    replyTo: email,
    subject: `Club Order: ${productName} — ${clubName}`,
    text: `Club: ${clubName}\nProduct: ${productName}\nSize: ${size}\nPrice: ${price}\n\nName: ${name}\nEmail: ${email}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
        <h2 style="font-size:18px;margin-bottom:24px;">New Club Kit Order</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;width:120px;color:#666;font-size:13px;">Club</td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${clubName}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;color:#666;font-size:13px;">Product</td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${productName}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;color:#666;font-size:13px;">Size</td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${size}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;color:#666;font-size:13px;">Price</td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${price}</td>
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
