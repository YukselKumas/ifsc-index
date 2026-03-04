'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')

  async function handleSubmit() {
    if (!email || !password) { toast.error('E-posta ve şifre giriniz'); return }
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { toast.error(error.message); setLoading(false); return }
      router.push('/dashboard')
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success('Kayıt başarılı! Lütfen e-postanızı doğrulayın.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Arka plan desen */}
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 w-full max-w-md border border-white/20">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl shadow-lg mb-4">
            <span className="text-3xl">🛡️</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">IFSC Index</h1>
          <p className="text-blue-200 text-sm mt-1">Gıda Güvenliği Kültürü Değerlendirme</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-blue-200 uppercase tracking-widest mb-1.5">
              E-posta
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-blue-400 focus:bg-white/15 transition"
              placeholder="ornek@sirket.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-blue-200 uppercase tracking-widest mb-1.5">
              Şifre
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-blue-400 focus:bg-white/15 transition"
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg disabled:opacity-50 mt-2"
          >
            {loading ? 'Yükleniyor...' : mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-blue-200 text-sm">
            {mode === 'login' ? 'Hesabın yok mu?' : 'Hesabın var mı?'}{' '}
            <button
              onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}
              className="text-white font-bold hover:underline"
            >
              {mode === 'login' ? 'Kayıt Ol' : 'Giriş Yap'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
