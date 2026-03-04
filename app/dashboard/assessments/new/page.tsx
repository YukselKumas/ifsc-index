'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const FACILITY_TYPES = [
  'Et ve Et Ürünleri', 'Süt ve Süt Ürünleri', 'Fırın ve Pastane',
  'Meyve ve Sebze İşleme', 'Su ve İçecek', 'Hazır Yemek',
  'Balık ve Deniz Ürünleri', 'Tahıl ve Bakliyat', 'Diğer'
]

export default function NewAssessmentPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'new' | 'revision'>('new')
  const [facilityName, setFacilityName] = useState('')
  const [facilityType, setFacilityType] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [existingFacilities, setExistingFacilities] = useState<any[]>([])
  const [selectedFacility, setSelectedFacility] = useState<any>(null)
  const [facilitySearch, setFacilitySearch] = useState('')
  const [tenantId, setTenantId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      // Kullanıcının tenant_id'sini al
      const { data: authData } = await supabase.auth.getUser()
      if (authData.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', authData.user.id)
          .single()
        if (userData) setTenantId(userData.tenant_id)
      }

      // Mevcut firmaları çek
      const { data } = await supabase
        .from('assessments')
        .select('facility_name, facility_type, facility_id, revision_number')
        .order('facility_name')
      if (!data) return
      const map = new Map<string, any>()
      data.forEach(a => {
        const existing = map.get(a.facility_name)
        if (!existing || a.revision_number > existing.revision_number) {
          map.set(a.facility_name, a)
        }
      })
      setExistingFacilities(Array.from(map.values()))
    }
    init()
  }, [])

  function makeSlug(name: string) {
    return name.toLowerCase()
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  }

  async function handleSubmit() {
    const name = mode === 'revision' ? selectedFacility?.facility_name : facilityName
    if (!name) { toast.error('Tesis adı gerekli'); return }
    if (!date) { toast.error('Tarih gerekli'); return }
    if (mode === 'revision' && !selectedFacility) {
      toast.error('Lütfen bir firma seçin'); return
    }
    if (!tenantId) { toast.error('Oturum hatası'); return }
    setLoading(true)

    const slug = mode === 'revision'
      ? selectedFacility.facility_id
      : makeSlug(name)

    let revisionNumber = 1
    if (mode === 'revision' && selectedFacility) {
      const { data: prev } = await supabase
        .from('assessments')
        .select('revision_number')
        .eq('facility_name', selectedFacility.facility_name)
        .order('revision_number', { ascending: false })
        .limit(1)
      if (prev && prev.length > 0) revisionNumber = prev[0].revision_number + 1
    }

    const { data, error } = await supabase.from('assessments').insert({
      tenant_id: tenantId,
      facility_name: name,
      facility_type: mode === 'revision' ? selectedFacility.facility_type : facilityType,
      facility_id: slug,
      facility_slug: slug,
      assessment_date: date,
      notes,
      status: 'draft',
      revision_number: revisionNumber,
      w1: 0.25, w2: 0.25, w3: 0.25, w4: 0.25,
    }).select().single()

    setLoading(false)
    if (error) { toast.error('Hata: ' + error.message); return }
    toast.success(mode === 'revision'
      ? `R${revisionNumber} revizyonu oluşturuldu!`
      : 'Değerlendirme oluşturuldu!')
    router.push(`/dashboard/assessments/${data.id}`)
  }

  const filteredFacilities = existingFacilities.filter(f =>
    f.facility_name.toLowerCase().includes(facilitySearch.toLowerCase())
  )

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900">Yeni Değerlendirme</h1>
        <p className="text-slate-500 text-sm mt-1">IFSC Index değerlendirmesi başlat</p>
      </div>

      {/* Mod seçimi */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <button onClick={() => setMode('new')}
          className={`p-4 rounded-2xl border-2 text-left transition ${
            mode === 'new'
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}>
          <div className="text-2xl mb-2">🏭</div>
          <div className={`font-bold text-sm ${mode === 'new' ? 'text-blue-700' : 'text-slate-700'}`}>
            Yeni Firma
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Daha önce değerlendirilmemiş firma
          </div>
        </button>

        <button onClick={() => setMode('revision')}
          className={`p-4 rounded-2xl border-2 text-left transition ${
            mode === 'revision'
              ? 'border-purple-500 bg-purple-50'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}>
          <div className="text-2xl mb-2">🔄</div>
          <div className={`font-bold text-sm ${mode === 'revision' ? 'text-purple-700' : 'text-slate-700'}`}>
            Yeni Revizyon
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Mevcut firmaya tekrar değerlendirme
          </div>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">

        {mode === 'revision' ? (
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase block mb-2">
              Firma Seç
            </label>
            <input
              value={facilitySearch}
              onChange={e => setFacilitySearch(e.target.value)}
              placeholder="Firma adı ara..."
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm
                focus:outline-none focus:border-purple-400 mb-3"
            />
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {filteredFacilities.map(f => (
                <button key={f.facility_name}
                  onClick={() => setSelectedFacility(f)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                    selectedFacility?.facility_name === f.facility_name
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-slate-800">{f.facility_name}</div>
                      <div className="text-xs text-slate-400">{f.facility_type}</div>
                    </div>
                    <div className="text-xs font-bold text-purple-600 bg-purple-100
                      px-2 py-1 rounded-full">
                      R{f.revision_number} mevcut
                    </div>
                  </div>
                </button>
              ))}
              {filteredFacilities.length === 0 && (
                <div className="text-center py-4 text-sm text-slate-400">
                  Firma bulunamadı
                </div>
              )}
            </div>
            {selectedFacility && (
              <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                <div className="text-xs font-bold text-purple-700">
                  ✓ {selectedFacility.facility_name} seçildi →
                  R{selectedFacility.revision_number + 1} oluşturulacak
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-2">
                Tesis Adı *
              </label>
              <input value={facilityName} onChange={e => setFacilityName(e.target.value)}
                placeholder="ABC Gıda Üretim Tesisi"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm
                  focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-2">
                Tesis Tipi
              </label>
              <select value={facilityType} onChange={e => setFacilityType(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm
                  focus:outline-none focus:border-blue-400">
                <option value="">Seçiniz</option>
                {FACILITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </>
        )}

        <div>
          <label className="text-xs font-bold text-slate-400 uppercase block mb-2">
            Değerlendirme Tarihi *
          </label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm
              focus:outline-none focus:border-blue-400" />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-400 uppercase block mb-2">
            Ön Not (İsteğe Bağlı)
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={3} placeholder="Bu değerlendirme hakkında notlar..."
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm
              focus:outline-none focus:border-blue-400 resize-none" />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={() => router.back()}
            className="flex-1 border border-slate-200 text-slate-600 font-bold py-2.5
              rounded-xl text-sm hover:bg-slate-50 transition">
            İptal
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className={`flex-1 text-white font-bold py-2.5 rounded-xl text-sm
              transition disabled:opacity-40 ${
                mode === 'revision'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}>
            {loading
              ? 'Oluşturuluyor...'
              : mode === 'revision'
              ? '🔄 Revizyonu Başlat'
              : '→ Değerlendirmeyi Başlat'}
          </button>
        </div>
      </div>
    </div>
  )
}
