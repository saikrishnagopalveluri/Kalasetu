import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isValidTier, isValidPeriod, priceFor } from '@/lib/pricing'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.replace('Bearer ', '')
    if (!accessToken) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    const { orderId, paymentId, signature } = await request.json()
    if (!orderId || !paymentId || !signature) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Payment verification is not fully set up yet (missing SUPABASE_SERVICE_ROLE_KEY).' },
        { status: 503 }
      )
    }

    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Payments are not set up yet.' }, { status: 503 })
    }

    // Confirm who's actually calling — never trust a client-supplied user id.
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    // Verify the payment really happened and wasn't tampered with client-side.
    const expectedSignature = createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex')
    if (expectedSignature !== signature) {
      console.error('Razorpay signature mismatch for order', orderId)
      return NextResponse.json({ error: 'Payment could not be verified.' }, { status: 400 })
    }

    // What to actually grant comes from Razorpay's own record of the order,
    // never from the client's request body. The signature above only proves
    // *this orderId* was genuinely paid — it says nothing about which tier
    // the client claims that payment was for. Without this fetch, a client
    // could pay for the cheapest tier, then call this endpoint asserting
    // any tier it likes and get it for free.
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
      headers: { Authorization: `Basic ${auth}` },
    })
    if (!orderRes.ok) {
      console.error('Could not fetch order from Razorpay for verification:', orderId, orderRes.status)
      return NextResponse.json({ error: 'Payment could not be verified.' }, { status: 502 })
    }
    const order = await orderRes.json()
    const tier = order.notes?.tier
    const period = order.notes?.period
    if (!isValidTier(tier) || !isValidPeriod(period)) {
      console.error('Order has no valid tier/period in notes:', orderId, order.notes)
      return NextResponse.json({ error: 'Payment could not be verified.' }, { status: 400 })
    }
    const expectedAmount = priceFor(tier, period)
    if (order.amount !== expectedAmount || order.status !== 'paid') {
      console.error('Order amount/status mismatch:', orderId, order.amount, expectedAmount, order.status)
      return NextResponse.json({ error: 'Payment could not be verified.' }, { status: 400 })
    }

    const renewsAt = new Date()
    if (period === 'annual') renewsAt.setFullYear(renewsAt.getFullYear() + 1)
    else renewsAt.setMonth(renewsAt.getMonth() + 1)

    const { error: updateError } = await supabaseAdmin
      .from('artisan_profiles')
      .update({ subscription_tier: tier, subscription_period: period, subscription_renews_at: renewsAt.toISOString() })
      .eq('id', userData.user.id)

    if (updateError) {
      console.error('Failed to apply subscription tier after payment:', updateError.message)
      return NextResponse.json({ error: 'Payment succeeded but updating your account failed. Contact support.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, tier, period })
  } catch (error) {
    console.error('Razorpay verify route error:', error)
    return NextResponse.json({ error: 'Could not verify payment. Please try again.' }, { status: 500 })
  }
}
