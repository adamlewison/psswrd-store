import { getAuthedUser, recordUnlockAttempt } from '@/lib/vault-server'

/**
 * POST { success: boolean }
 *
 * Client reports whether decryption succeeded. Increments pin_attempts on
 * failure and triggers lockouts; resets on success.
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthedUser()
    const { success } = await request.json() as { success?: boolean }
    if (typeof success !== 'boolean') {
      return Response.json({ error: 'success (boolean) required' }, { status: 400 })
    }
    await recordUnlockAttempt(user.id, success)
    return Response.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    const status = msg === 'Unauthorized' ? 401 : 500
    return Response.json({ error: msg }, { status })
  }
}
