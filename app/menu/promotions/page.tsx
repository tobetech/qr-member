'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useSessionGuard } from '@/lib/hooks/useSessionGuard'

interface Promotion {
  id: string
  title: string
  description: string | null
  image_url: string | null
  starts_at: string | null
  ends_at: string | null
}

export default function PromotionsPage() {
  const router = useRouter()
  const supabase = createClient()
  useSessionGuard()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const now = new Date().toISOString()
      const { data } = await supabase
        .from('promotions')
        .select('id, title, description, image_url, starts_at, ends_at')
        .eq('is_active', true)
        .order('sort_order')

      const visible = (data || []).filter(p => {
        if (p.starts_at && p.starts_at > now) return false
        if (p.ends_at && p.ends_at < now) return false
        return true
      })

      setPromotions(visible)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* Header */}
      <div className="bg-indigo-600 px-6 pt-12 pb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-indigo-200 font-medium text-sm">
            ← กลับ
          </button>
          <h1 className="text-white font-bold text-lg">โปรโมชั่น / สิทธิประโยชน์</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : promotions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-20">
          <p className="text-5xl mb-4">🎁</p>
          <p className="font-medium">ยังไม่มีโปรโมชั่นในขณะนี้</p>
          <p className="text-sm mt-1">กลับมาเช็คใหม่ได้เรื่อยๆ นะครับ</p>
        </div>
      ) : (
        <div className="flex-1 px-6 py-6 space-y-4">
          {promotions.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.98] transition">
              {p.image_url && (
                <img src={p.image_url} alt={p.title} className="w-full h-44 object-cover" />
              )}
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                    🎁
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{p.title}</p>
                    {p.description && (
                      <p className="text-sm text-gray-500 mt-1 leading-relaxed">{p.description}</p>
                    )}
                    {(p.starts_at || p.ends_at) && (
                      <div className="mt-2 flex items-center gap-1">
                        <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                          {p.starts_at && `${new Date(p.starts_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`}
                          {p.starts_at && p.ends_at && ' — '}
                          {p.ends_at && `${new Date(p.ends_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
