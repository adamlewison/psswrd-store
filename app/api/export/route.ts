import { NextResponse } from 'next/server'
import { getAllAccountsForUser } from '@/lib/data'

/**
 * Returns vault data as JSON with base64-encoded ciphertext blobs.
 * The client decrypts field values using the DEK and generates a CSV in the browser.
 * Server never decrypts.
 */
export async function GET() {
  const accounts = await getAllAccountsForUser()

  if (!accounts.length) {
    return new NextResponse(null, { status: 204 })
  }

  return Response.json(accounts)
}
