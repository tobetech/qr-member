'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Profile {
  full_name: string
  balance: number
  loyalty_points: number
}

interface Tier {
  id: string
  tier_name: string
  min_points: number
  sort_order: number
}

export default function MenuPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('users')
        .select('full_name, balance, loyalty_points')
        .eq('id', user.id)
        .single()

      setProfile(data)

      const { data: settings } = await supabase
        .from('loyalty_settings')
        .select('is_enabled')
        .eq('id', 1)
        .single()

      if (settings?.is_enabled) {
        setLoyaltyEnabled(true)
        const { data: tiersData } = await supabase
          .from('loyalty_tiers')
          .select('*')
          .order('sort_order')
        setTiers(tiersData || [])
      }

      setLoading(false)
    }
    load()

    const channel = supabase
      .channel('balance')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
      }, payload => {
        setProfile(prev => prev ? {
          ...prev,
          balance: payload.new.balance,
          loyalty_points: payload.new.loyalty_points,
        } : prev)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function handleLogout() {
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sessions/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id }),
        })
        console.log('[LOGOUT] backend response status:', res.status)
      } catch (err) {
        console.error('[LOGOUT] backend call failed:', err)
      }
    } else {
      console.log('[LOGOUT] no user found from getUser()')
    }

    sessionStorage.removeItem('session_token')
    sessionStorage.removeItem('user_id')

    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const points = profile?.loyalty_points || 0

  const currentTier = [...tiers].reverse().find(t => points >= t.min_points)
  const nextTier = tiers.find(t => t.min_points > points)

  let progressPercent = 100
  if (currentTier && nextTier) {
    const range = nextTier.min_points - currentTier.min_points
    const earned = points - currentTier.min_points
    progressPercent = Math.min(100, Math.max(0, (earned / range) * 100))
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="bg-indigo-600 px-6 pt-12 pb-8">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-indigo-200 text-sm">ชื่อผู้ใช้ / หมายเลขโทรศัพท์</p>
            <h2 className="text-white text-xl font-bold mt-0.5">{profile?.full_name || 'ผู้ใช้'}</h2>
          </div>
          <button
            onClick={handleLogout}
            className="text-indigo-200 text-sm hover:text-white"
          >
            ออกจากระบบ
          </button>
        </div>

        <div className="mt-6 bg-white/15 backdrop-blur rounded-2xl p-5 flex">
          <div className="flex-1">
            <p className="text-indigo-100 text-sm">ยอดเงินคงเหลือ</p>
            <p className="text-white text-4xl font-bold mt-1">
              ฿{profile?.balance?.toFixed(2) || '0.00'}
            </p>

            {loyaltyEnabled && (
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="inline-flex items-center gap-1.5 bg-white/15 text-white text-sm px-3 py-1.5 rounded-full">
                  ☆ คะแนนสะสม {points} คะแนน
                </span>
                {currentTier && (
                  <span className="inline-flex items-center gap-1.5 bg-amber-500/90 text-white text-sm px-3 py-1.5 rounded-full font-medium">
                    ☆ {currentTier.tier_name}
                  </span>
                )}
              </div>
            )}
          </div>

          {loyaltyEnabled && nextTier && (
            <div className="flex flex-col items-center justify-between ml-3 pl-3 border-l border-white/20">
              <span className="text-white text-xs font-semibold">{nextTier.min_points}</span>
              <span className="text-indigo-200 text-[10px]">{nextTier.tier_name}</span>
              <div className="w-1.5 h-20 bg-white/15 rounded-full mt-1 relative overflow-hidden">
                <div
                  className="absolute bottom-0 left-0 right-0 bg-white rounded-full transition-all"
                  style={{ height: `${progressPercent}%` }}
                />
              </div>
              <span className="text-white text-xs mt-1">{points}</span>
              <span className="text-indigo-200 text-[10px]">{Math.round(progressPercent)}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-6 py-6 space-y-3">
        <button
          onClick={() => router.push('/scan')}
          className="w-full flex items-center gap-4 bg-indigo-600 text-white px-5 py-4 rounded-2xl active:scale-95 transition"
        >
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
            📷
          </div>
          <div className="text-left">
            <p className="font-semibold text-lg">สแกน QR ซื้อสินค้า</p>
            <p className="text-indigo-200 text-sm">เปิดกล้องสแกน QR จากตู้</p>
          </div>
        </button>

        <button
          onClick={() => router.push('/menu/topup')}
          className="w-full flex items-center gap-4 bg-white border border-gray-100 px-5 py-4 rounded-2xl active:scale-95 transition shadow-sm"
        >
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl">
            💳
          </div>
          <div className="text-left">
            <p className="font-semibold text-lg text-gray-900">เติมเงิน</p>
            <p className="text-gray-400 text-sm">เพิ่มยอดเงินเข้ากระเป๋า</p>
          </div>
        </button>

        {loyaltyEnabled && (
          <button
            disabled
            className="w-full flex items-center gap-4 bg-white border border-gray-100 px-5 py-4 rounded-2xl shadow-sm opacity-60 cursor-not-allowed"
          >
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center text-2xl">
              ⭐
            </div>
            <div className="text-left">
              <p className="font-semibold text-lg text-gray-900">แลกคะแนนสะสม</p>
              <p className="text-gray-400 text-sm">เร็วๆนี้</p>
            </div>
          </button>
        )}

        <button
          onClick={() => router.push('/menu/promotions')}
          className="w-full flex items-center gap-4 bg-white border border-gray-100 px-5 py-4 rounded-2xl active:scale-95 transition shadow-sm"
        >
          <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center text-2xl">
            🎁
          </div>
          <div className="text-left">
            <p className="font-semibold text-lg text-gray-900">โปรโมชั่น สิทธิประโยชน์</p>
            <p className="text-gray-400 text-sm">ดูโปรโมชั่นและสิทธิประโยชน์สมาชิก</p>
          </div>
        </button>

        <button
          onClick={() => router.push('/menu/history')}
          className="w-full flex items-center gap-4 bg-white border border-gray-100 px-5 py-4 rounded-2xl active:scale-95 transition shadow-sm"
        >
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl">
            🧾
          </div>
          <div className="text-left">
            <p className="font-semibold text-lg text-gray-900">ประวัติการซื้อ/เติมเงิน</p>
            <p className="text-gray-400 text-sm">รายการซื้อสินค้าและเติมเงินที่ผ่านมา</p>
          </div>
        </button>
      </div>
    </div>
  )
}
