import { NextResponse } from 'next/server'
import { getRates } from '@/lib/fx'

export const revalidate = 86400

export async function GET() {
  return NextResponse.json(await getRates(), {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400' },
  })
}
