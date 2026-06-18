'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Promotion {
  id: string
  title: string
  description: string | null
  image_url: string | null
}

export default function PromotionsPage() {
  const router = useRouter()
  const supabase = createClient()
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

      // กรองโปรโมชั่นที่อยู่ในช่วงเวลาที่กำหนด (ถ้ามีตั้งไว้)
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-6 pt-12 pb-4 flex items-center gap-3 border-b">
        <button onClick={() => router.back()} className="text-indigo-600 font-medium">← กลับ</button>
        <h1 className="font-bold text-lg text-gray-900">โปรโมชั่น / สิทธิประโยชน์</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : promotions.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🎁</p>
          <p>ยังไม่มีโปรโมชั่นในขณะนี้</p>
        </div>
      ) : (
        <div className="px-6 py-6 space-y-4">
          {promotions.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {p.image_url && (
                <img src={p.image_url} alt={p.title} className="w-full h-40 object-cover" />
              )}
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🎁</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{p.title}</p>
                    {p.description && (
                      <p className="text-sm text-gray-500 mt-1">{p.description}</p>
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
