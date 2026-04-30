import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { verificationTokens } from '@/db/schema'
import { and, eq, gt } from 'drizzle-orm'
import { createHash } from 'crypto'

export async function POST(req: NextRequest) {
  const { email, code } = await req.json()

  if (!email || !code) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const secret = process.env.AUTH_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 })
  }

  const hashed = createHash('sha256').update(`${code}${secret}`).digest('hex')

  const record = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.token, hashed),
        gt(verificationTokens.expires, new Date()),
      ),
    )
    .get()

  if (!record) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
