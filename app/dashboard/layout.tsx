'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/login'); return }
      setUser(data.session.user)
      const { data: userData } = await supabase
        .from('users').select('role').eq('id', data.session.user.id).single()
      if (userData) setUserRole(userData.role)
    })
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const nav = [
    { href: '/dashboard', label: 'Genel Bakış', icon: '📊' },
    { href: '/dashboard/assessments', label: 'Değerlendirmeler', icon: '📋' },
    { href: '/dashboard/assessments/new', label: 'Yeni Değerlendirme', icon: '➕' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-lg">🛡️</div>
            <div>
              <div className="font-black text-white text-sm">IFSC Index</div>
              <div className="text-xs text-slate-400">Kültür Değerlendirme</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(item => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition font-medium
                ${pathname === item.href
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}

          {/* Admin link - sadece admin rolündeyse göster */}
          {userRole === 'admin' && (
            <Link href="/dashboard/admin"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition font-medium mt-4
                ${pathname === '/dashboard/admin'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <span>⚙️</span>
              Admin Ayarlar
            </Link>
          )}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-slate-700">
          <div className="px-3 py-2 mb-1">
            <div className="text-xs text-slate-400 truncate">{user?.email}</div>
            {userRole === 'admin' && (
              <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full font-bold">Admin</span>
            )}
          </div>
          <button onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800 hover:text-red-400 transition">
            🚪 Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
