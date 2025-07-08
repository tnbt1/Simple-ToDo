import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import { logAuthEvent } from "./logger"

// TODO: NextAuthの型定義を正しくインポートする
export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          logAuthEvent('login_failed', undefined, false, undefined, {
            reason: 'missing_credentials',
            email: credentials?.email
          })
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        if (!user || !user.password) {
          logAuthEvent('login_failed', undefined, false, undefined, {
            reason: 'user_not_found',
            email: credentials.email
          })
          return null
        }

        // Verify password hash
        const isValidPassword = await bcrypt.compare(credentials.password, user.password)
        
        if (!isValidPassword) {
          logAuthEvent('login_failed', user.id, false, undefined, {
            reason: 'invalid_password',
            email: credentials.email
          })
          return null
        }

        logAuthEvent('login_success', user.id, true, undefined, {
          email: user.email,
          provider: 'credentials'
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      }
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    ] : []),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? [
      GitHubProvider({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      })
    ] : []),
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/signin",
    signUp: "/auth/signup",
  },
  callbacks: {
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
    async signIn({ user, account }: { user: any; account: any }) {
      // Log OAuth sign-ins
      if (account?.provider && account.provider !== 'credentials') {
        logAuthEvent('oauth_login', user.id, true, undefined, {
          provider: account.provider,
          email: user.email
        })
      }
      return true
    },
  },
}