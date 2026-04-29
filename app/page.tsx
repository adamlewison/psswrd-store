import { getAllAccountsForUser } from '@/lib/data'
import { TopBar } from '@/components/top-bar'
import { AccountList } from '@/components/account-list'

export default async function HomePage() {
  const accounts = await getAllAccountsForUser()

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <TopBar />
      <main className="max-w-[860px] mx-auto pt-20 px-4 pb-16">
        <AccountList accounts={accounts} />
      </main>
    </div>
  )
}
