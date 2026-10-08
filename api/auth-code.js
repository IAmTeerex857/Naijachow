import { createHash } from 'node:crypto'
import { z } from 'zod'
import { clientIp, fetchWithTimeout, parseJsonBody, requireMethod, sendJson } from '../server/http.js'
import { consumeRateLimit } from '../server/rateLimit.js'
import { supabaseAdmin } from '../server/supabaseAdmin.js'

const schema = z.object({ email: z.string().email().max(320) }).strict()

function emailHtml(otp) {
  return `<!doctype html><html><body style="margin:0;background:#f5f1e8;color:#201b16;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">Your six digit Naijachow sign in code.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:36px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffaf2;border:1px solid #e4d8c8;border-radius:24px;overflow:hidden"><tr><td style="height:8px;background:#e96f26"></td></tr><tr><td style="padding:42px"><div style="font-size:13px;font-weight:700;letter-spacing:.12em;color:#a54d18">NAIJACHOW</div><h1 style="margin:18px 0 12px;font-size:34px;line-height:1.1;color:#17130f">Your sign in code</h1><p style="margin:0 0 24px;font-size:17px;line-height:1.6;color:#5e554c">Enter this six digit code on the Naijachow sign in screen:</p><div style="display:inline-block;padding:16px 22px;background:#f0e5d7;border-radius:12px;font-size:30px;font-weight:700;letter-spacing:.24em;color:#201b16">${otp}</div><p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#81766b">This code expires in one hour and can only be used once. If you did not request it, you can safely ignore this email.</p></td></tr><tr><td style="padding:20px 42px;background:#201b16;color:#d8cfc5;font-size:12px">Smart meal planning for Nigerian homes, naijachow.xyz</td></tr></table></td></tr></table></body></html>`
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return
  let input
  try {
    input = schema.parse(parseJsonBody(req))
  } catch {
    return sendJson(res, 400, { error: 'Enter a valid email address.' })
  }
  const email = input.email.trim().toLowerCase()
  try {
    const emailIdentity = createHash('sha256').update(email).digest('hex')
    const [ipAllowed, emailAllowed] = await Promise.all([
      consumeRateLimit('auth-email-ip', clientIp(req), 10, 3600),
      consumeRateLimit('auth-email-address', emailIdentity, 3, 3600),
    ])
    if (!ipAllowed || !emailAllowed) {
      return sendJson(res, 429, { error: 'Too many sign in emails. Please wait and try again.' })
    }
    const { data, error } = await supabaseAdmin().auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    const otp = data?.properties?.email_otp
    if (error || !otp) throw error || new Error('No sign in code returned')
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) throw new Error('Resend is not configured')
    const response = await fetchWithTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Naijachow <hello@naijachow.xyz>',
        to: [email],
        subject: `${otp} is your Naijachow sign in code`,
        html: emailHtml(otp),
        text: `Your Naijachow sign in code is ${otp}.\n\nThis code expires in one hour. If you did not request it, ignore this email.`,
      }),
    }, 12_000)
    if (!response.ok) throw new Error(`Resend request failed (${response.status})`)
    return sendJson(res, 202, { sent: true })
  } catch (error) {
    console.error('[Naijachow] sign-in email failed:', error.message)
    return sendJson(res, 502, { error: 'Could not send the sign in email. Please try again.' })
  }
}
