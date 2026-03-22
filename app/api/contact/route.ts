import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { name, email, subject, message } = await req.json()

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const subjectLabels: Record<string, string> = {
    general: 'General Enquiry',
    sizing: 'Sizing & Fit',
    'team-store': 'Team Store',
    press: 'Press & Media',
    other: 'Other',
  }

  const { error } = await resend.emails.send({
    from: 'Proton Lab CC <noreply@protonlab.cc>',
    to: 'info@protonlab.cc',
    replyTo: email,
    subject: `Contact Form: ${subjectLabels[subject] ?? subject}`,
    text: `Name: ${name}\nEmail: ${email}\nSubject: ${subjectLabels[subject] ?? subject}\n\n${message}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
        <h2 style="font-size:18px;margin-bottom:24px;">New Contact Form Submission</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;width:100px;color:#666;font-size:13px;">Name</td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${name}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;color:#666;font-size:13px;">Email</td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">
              <a href="mailto:${email}" style="color:#1a1a1a;">${email}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;color:#666;font-size:13px;">Subject</td>
            <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:13px;">${subjectLabels[subject] ?? subject}</td>
          </tr>
        </table>
        <p style="font-size:13px;color:#666;margin-bottom:8px;">Message</p>
        <p style="font-size:14px;line-height:1.6;white-space:pre-wrap;">${message}</p>
        <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
        <p style="font-size:11px;color:#999;">Reply directly to this email to respond to ${name}.</p>
      </div>
    `,
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
