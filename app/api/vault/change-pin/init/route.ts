import { getAuthedUser, computeHmac, generateSalt } from '@/lib/vault-server'

/**
 * Step 1 of PIN change.
 * POST { newPin: string }
 * → { hmac: string (base64), kekSalt: string (base64) }
 *
 * Returns new HMAC + new kek_salt. Client derives new KEK, re-wraps the
 * current DEK (already in memory), then calls POST /api/vault/change-pin.
 * kek_salt is NOT committed to DB here — only on confirm.
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthedUser()

    if (!user.wrappedDek) {
      return Response.json({ error: 'Vault not set up' }, { status: 404 })
    }

    const { newPin } = await request.json() as { newPin?: string }
    if (!newPin || typeof newPin !== 'string' || newPin.length < 4) {
      return Response.json({ error: 'New PIN must be at least 4 characters' }, { status: 400 })
    }

    const newKekSalt = generateSalt()
    const newHmac = computeHmac(newKekSalt, newPin)

    return Response.json({
      hmac: newHmac.toString('base64'),
      kekSalt: newKekSalt.toString('base64'),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return Response.json({ error: msg }, { status })
  }
}
