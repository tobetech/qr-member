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

interface TopupSlot {
  slot: number
  min_amount: number
  bonus_bronze: number
  bonus_silver: number
  bonus_gold: number
  is_active: boolean
}

interface Tier {
  tier_name: string
  min_points: number
  sort_order: number
}

type Tab = 'topup' | 'banner'

export default function PromotionsPage() {
  const router = useRouter()
  const supabase = createClient()
  useSessionGuard()

  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [topupSlots, setTopupSlots] = useState<TopupSlot[]>([])
  const [userTier, setUserTier] = useState('Bronze')
  const [userPoints, setUserPoints] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('topup')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const now = new Date().toISOString()

      const [userRes, promoRes, slotsRes, tiersRes] = await Promise.all([
        supabase.from('users').select('loyalty_points').eq('id', user.id).single(),
        supabase.from('promotions').select('id, title, description, image_url, starts_at, ends_at').eq('is_active', true).order('sort_order'),
        supabase.from('topup_promotions').select('*').eq('is_active', true).order('slot'),
        supabase.from('loyalty_tiers').select('*').order('sort_order', { ascending: false }),
      ])

      // หา tier ของ user
      const points = userRes.data?.loyalty_points || 0
      const tier = (tiersRes.data || []).find((t: Tier) => points >= t.min_points)?.tier_name || 'Bronze'

      // กรอง banner promotions ตามช่วงเวลา
      const visible = (promoRes.data || []).filter((p: Promotion) => {
        if (p.starts_at && p.starts_at > now) return false
        if (p.ends_at && p.ends_at < now) return false
        return true
      })

      setUserPoints(points)
      setUserTier(tier)
      setPromotions(visible)
      setTopupSlots(slotsRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  function getBonusForTier(slot: TopupSlot) {
    if (userTier === 'Gold') return slot.bonus_gold
    if (userTier === 'Silver') return slot.bonus_silver
    return slot.bonus_bronze
  }

  const tierColors: Record<string, { text: string; bg: string; border: string }> = {
    Bronze: { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    Silver: { text: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' },
    Gold: { text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  }
  const tierStyle = tierColors[userTier] || tierColors['Bronze']

  const activeSlots = topupSlots.filter(s => s.is_active)

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* Header */}
      <div className="bg-indigo-600 px-6 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="text-indigo-200 font-medium text-sm">← กลับ</button>
          <h1 className="text-white font-bold text-lg">โปรโมชั่น / สิทธิประโยชน์</h1>
        </div>
        {/* Tier badge */}
        <div className="bg-white/15 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-xs">ระดับสมาชิกของคุณ</p>
            <p className="text-white font-bold text-lg mt-0.5">★ {userTier}</p>
          </div>
          <div className="text-right">
            <p className="text-indigo-200 text-xs">คะแนนสะสม</p>
            <p className="text-white font-semibold mt-0.5">⭐ {userPoints.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6 py-3 flex gap-2">
        <button
          onClick={() => setTab('topup')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${tab === 'topup' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          💰 โปรโมชั่นเติมเงิน
        </button>
        <button
          onClick={() => setTab('banner')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${tab === 'banner' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          🎁 สิทธิประโยชน์
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'topup' ? (
        <div className="flex-1 px-6 py-5 space-y-3">
          {/* คำอธิบาย */}
          <div className={`rounded-2xl border p-4 ${tierStyle.bg} ${tierStyle.border}`}>
            <p className={`text-sm font-medium ${tierStyle.text}`}>
              ★ คุณอยู่ระดับ {userTier} — โบนัสที่แสดงคือโบนัสสำหรับระดับของคุณ
            </p>
            <p className="text-xs text-gray-500 mt-1">เติมเงินถึงขั้นต่ำที่กำหนด จะได้รับโบนัสเครดิตเพิ่มอัตโนมัติ</p>
          </div>

          {activeSlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <p className="text-4xl mb-3">💰</p>
              <p>ยังไม่มีโปรโมชั่นเติมเงิน</p>
            </div>
          ) : (
            activeSlots.map(s => {
              const bonus = getBonusForTier(s)
              const hasBonus = bonus > 0
              return (
                <div key={s.slot} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${hasBonus ? 'border-indigo-100' : 'border-gray-100'}`}>
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${hasBonus ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                        {hasBonus ? '🎉' : '💳'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">เติม ฿{s.min_amount.toLocaleString()} ขึ้นไป</p>
                        {hasBonus ? (
                          <p className="text-sm text-indigo-600 font-medium mt-0.5">
                            รับโบนัส +฿{bonus.toLocaleString()} ({userTier})
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400 mt-0.5">ไม่มีโบนัสสำหรับระดับนี้</p>
                        )}
                      </div>
                    </div>
                    {hasBonus && (
                      <div className="text-right flex-shrink-0">
                        <div className="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl">
                          +฿{bonus.toLocaleString()}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          รวม ฿{(s.min_amount + bonus).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                  {hasBonus && (
                    <div className="bg-indigo-50 px-4 py-2 flex items-center justify-between">
                      <span className="text-xs text-indigo-400">เติม ฿{s.min_amount.toLocaleString()}</span>
                      <span className="text-xs text-indigo-600 font-medium">→ ได้รับ ฿{(s.min_amount + bonus).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      ) : (
        <div className="flex-1 px-6 py-5 space-y-4">
          {promotions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-16">
              <p className="text-5xl mb-4">🎁</p>
              <p className="font-medium">ยังไม่มีโปรโมชั่นในขณะนี้</p>
              <p className="text-sm mt-1">กลับมาเช็คใหม่ได้เรื่อยๆ นะครับ</p>
            </div>
          ) : (
            promotions.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.98] transition">
                {p.image_url && (
                  <img src={p.image_url} alt={p.title} className="w-full h-44 object-cover" />
                )}
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🎁</div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{p.title}</p>
                      {p.description && <p className="text-sm text-gray-500 mt-1 leading-relaxed">{p.description}</p>}
                      {(p.starts_at || p.ends_at) && (
                        <div className="mt-2">
                          <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                            {p.starts_at && new Date(p.starts_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                            {p.starts_at && p.ends_at && ' — '}
                            {p.ends_at && new Date(p.ends_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
