import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Resend from 'next-auth/providers/resend'
import { DrizzleAdapter } from '@/lib/auth-adapter'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter,
  session: { strategy: 'jwt' },
  providers: [
    Google,
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM ?? 'Vault <onboarding@resend.dev>',
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      return !!user.email
    },
    async session({ session }) {
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
})
