'use client'
import { Suspense } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const FACILITY_TYPES = [
  'Et ve Et Ürünleri',
  'Süt ve Süt Ürünleri',
  'Fırın ve Pastane',
  'Meyve ve Sebze İşleme',
  'Deniz Ürünleri',
  'İçecek Üretimi',
  'Hazır Yemek / Catering',
  'Gıda Depolama ve Lojistik',
  'Perakende / Market',
  'Diğer',
]

function NewAssessmentForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    facility_name: '',
    facility_type: '',
    assessment_date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleStart() {
    if (!form.facility_name) { toast.error('Tesis adı zorunludur'); return }
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Oturum bulunamadı'); setLoading(false); return }

    const { data: userData } = await supabase
      .from('users').select('tenant_id').eq('id', user.id).single()

    const { data: assessment, error } = await supabase
      .from('assessments')
      .insert({
        facility_name: form.facility_name,
        facility_type: form.facility_type,
        assessment_date: form.assessment_date,
        notes: form.notes,
        assessor_id: user.id,
        tenant_id: userData?.tenant_id,
        status: 'draft',
      })
      .select()
      .single()

    if (error) { toast.error('Hata: ' + error.message); setLoading(false); return }
    toast.success('Değerlendirme oluşturuldu!')
    router.push(`/dashboard/assessments/${assessment.id}`)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-lg border border-slate-100">
        {/* Başlık */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl">🏭</div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Yeni Değerlendirme</h1>
            <p className="text-slate-400 text-sm">IFSC Index değerlendirmesi başlat</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Tesis Adı */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
              Tesis Adı *
            </label>
            <input
              value={form.facility_name}
              onChange={e => set('facility_name', e.target.value)}
              placeholder="ABC Gıda Üretim Tesisi"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition"
            />
          </div>

          {/* Tesis Tipi */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
              Tesis Tipi
            </label>
            <select
              value={form.facility_type}
              onChange={e => set('facility_type', e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition bg-white"
            >
              <option value="">Seçiniz</option>
              {FACILITY_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          {/* Tarih */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
              Değerlendirme Tarihi *
            </label>
            <input
              type="date"
              value={form.assessment_date}
              onChange={e => set('assessment_date', e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition"
            />
          </div>

          {/* Notlar */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
              Ön Not (İsteğe Bağlı)
            </label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Değerlendirme hakkında kısa not..."
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={() => router.back()}
            className="flex-1 border border-slate-200 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-50 transition text-sm"
          >
            İptal
          </button>
          <button
            onClick={handleStart}
            disabled={loading || !form.facility_name}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition text-sm disabled:opacity-40 shadow-sm"
          >
            {loading ? 'Oluşturuluyor...' : 'Değerlendirmeyi Başlat →'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NewAssessmentPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Yükleniyor...</div>}>
      <NewAssessmentForm />
    </Suspense>
  )
}
