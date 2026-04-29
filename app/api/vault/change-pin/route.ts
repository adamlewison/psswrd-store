import { getAuthedUser, rotateVaultKeys } from '@/lib/vault-server'

/**
 * Step 2 of PIN change. Atomically rotates kek_salt + wrapped DEK.
 * POST { kekSalt: string (base64), wrappedDek: string (base64), dekIv: string (base64) }
 * → { ok: true }
 *
 * The new kek_salt comes from /api/vault/change-pin/init; the new wrappedDek
 * is the DEK re-encrypted with the new KEK by the client. Server never
 * sees the plaintext DEK.
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthedUser()

    if (!user.wrappedDek) {
      return Response.json({ error: 'Vault not set up' }, { status: 404 })
    }

    const { kekSalt, wrappedDek, dekIv } = await request.json() as {
      kekSalt?: string
      wrappedDek?: string
      dekIv?: string
    }

    if (!kekSalt || !wrappedDek || !dekIv) {
      return Response.json({ error: 'kekSalt, wrappedDek, and dekIv are required' }, { status: 400 })
    }

    const newKekSaltBuf = Buffer.from(kekSalt, 'base64')
    const newWrappedDekBuf = Buffer.from(wrappedDek, 'base64')
    const newDekIvBuf = Buffer.from(dekIv, 'base64')

    if (newKekSaltBuf.length !== 16) {
      return Response.json({ error: 'kekSalt must be 16 bytes' }, { status: 400 })
    }
    if (newDekIvBuf.length !== 12) {
      return Response.json({ error: 'dekIv must be 12 bytes' }, { status: 400 })
    }

    await rotateVaultKeys(user.id, newKekSaltBuf, newWrappedDekBuf, newDekIvBuf)
    return Response.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return Response.json({ error: msg }, { status })
  }
}
