import { getAuthedUser } from '@/lib/vault-server'

export async function GET() {
  try {
    const user = await getAuthedUser()
    return Response.json({ hasVault: !!(user.wrappedDek && user.dekIv && user.kekSalt) })
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
