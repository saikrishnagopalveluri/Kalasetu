import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isValidTier, isValidPeriod, priceFor } from '@/lib/pricing'

export async function POST(request: NextRequest) {
  try {
    const { tier, period } = await request.json()
    if (!isValidTier(tier) || !isValidPeriod(period)) {
      return NextResponse.json({ error: 'Unknown subscription tier or billing period' }, { status: 400 })
    }
    const amount = priceFor(tier, period)

    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keyId || !keySecret || !supabaseAdmin) {
      return NextResponse.json(
        { error: 'Payments are not set up yet.' },
        { status: 503 }
      )
    }

    const accessToken = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!accessToken) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        // Recorded on the order itself (not just in our own DB) so /verify
        // can read back what was actually paid for from Razorpay's own
        // record, rather than trusting whatever tier/period the client
        // claims when it calls back after payment.
        notes: { tier, period },
      }),
    })

    if (!rzpResponse.ok) {
      const errText = await rzpResponse.text()
      console.error('Razorpay order creation failed:', rzpResponse.status, errText)
      return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 502 })
    }

    const order = await rzpResponse.json()
    return NextResponse.json({ orderId: order.id, amount, keyId })
  } catch (error) {
    console.error('Razorpay create-order route error:', error)
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 })
  }
}
