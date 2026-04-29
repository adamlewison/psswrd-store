import { getAuthedUser, computeHmac, generateSalt, saveKekSalt } from '@/lib/vault-server'

/**
 * Step 1 of vault setup.
 * POST { pin: string }
 * → { hmac: string (base64), kekSalt: string (base64) }
 *
 * Server generates kek_salt, computes HMAC-SHA256(VAULT_PEPPER, kek_salt || pin),
 * stores kek_salt, and returns HMAC + kek_salt to client.
 * Client derives KEK via Argon2id, wraps a fresh DEK, then calls /setup/confirm.
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthedUser()

    if (user.wrappedDek) {
      return Response.json({ error: 'Vault already set up' }, { status: 409 })
    }

    const { pin } = await request.json() as { pin?: string }
    if (!pin || typeof pin !== 'string' || pin.length < 4) {
      return Response.json({ error: 'PIN must be at least 4 characters' }, { status: 400 })
    }

    const kekSalt = generateSalt()
    const hmac = computeHmac(kekSalt, pin)

    // Store kek_salt immediately (it is not secret)
    await saveKekSalt(user.id, kekSalt)

    return Response.json({
      hmac: hmac.toString('base64'),
      kekSalt: kekSalt.toString('base64'),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return Response.json({ error: msg }, { status })
  }
}
