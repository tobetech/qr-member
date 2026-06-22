'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useSessionGuard } from '@/lib/hooks/useSessionGuard'

interface Reward {
  id: string
  name: string
  description: string | null
  image_url: string | null
  points_cost: number
  tier_required: string
  is_active: boolean
}

interface Redemption {
  id: string
  reward_name: string
  points_used: number
  created_at: string
}

interface Tier {
  tier_name: string
  min_points: number
  sort_order: number
}

export default function RewardsPage() {
  const router = useRouter()
  const supabase = createClient()
  useSessionGuard()

  const [rewards, setRewards] = useState<Reward[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [points, setPoints] = useState(0)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [userTier, setUserTier] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<Reward | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tab, setTab] = useState<'rewards' | 'history'>('rewards')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [userRes, rewardsRes, tiersRes, redemptionsRes] = await Promise.all([
      supabase.from('users').select('loyalty_points').eq('id', user.id).single(),
      supabase.from('rewards').select('*').eq('is_active', true).order('points_cost'),
      supabase.from('loyalty_tiers').select('*').order('sort_order'),
      supabase.from('loyalty_redemptions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    ])

    const userPoints = userRes.data?.loyalty_points || 0
    const tiersData = tiersRes.data || []

    // หา tier ปัจจุบัน
    const sorted = [...tiersData].sort((a, b) => b.min_points - a.min_points)
    const currentTier = sorted.find(t => userPoints >= t.min_points)?.tier_name || ''

    setPoints(userPoints)
    setTiers(tiersData)
    setUserTier(currentTier)
    setRewards(rewardsRes.data || [])
    setRedemptions(redemptionsRes.data || [])
    setLoading(false)
  }

  async function handleRedeem() {
    if (!confirming) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setRedeeming(true)
    setError('')
    try {
      // เช็คคะแนนล่าสุดอีกครั้ง
      const { data: userData } = await supabase
        .from('users').select('loyalty_points').eq('id', user.id).single()
      const currentPoints = userData?.loyalty_points || 0

      if (currentPoints < confirming.points_cost) {
        setError('คะแนนไม่เพียงพอ')
        setConfirming(null)
        setRedeeming(false)
        return
      }

      // หักคะแนน
      const newPoints = currentPoints - confirming.points_cost
      const { error: updateErr } = await supabase
        .from('users')
        .update({ loyalty_points: newPoints })
        .eq('id', user.id)
      if (updateErr) throw new Error(updateErr.message)

      // บันทึกประวัติ
      const { error: insertErr } = await supabase
        .from('loyalty_redemptions')
        .insert({
          user_id: user.id,
          reward_id: confirming.id,
          reward_name: confirming.name,
          points_used: confirming.points_cost,
        })
      if (insertErr) throw new Error(insertErr.message)

      setPoints(newPoints)
      setSuccess(`แลก "${confirming.name}" สำเร็จ! ใช้ ${confirming.points_cost} คะแนน`)
      setConfirming(null)
      await loadData()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRedeeming(false)
    }
  }

  const tierColors: Record<string, string> = {
    Bronze: 'text-orange-400',
    Silver: 'text-gray-400',
    Gold: 'text-yellow-400',
  }

  const canRedeem = (r: Reward) => {
    if (points < r.points_cost) return false
    // เช็ค tier
    const tierOrder = tiers.map(t => t.tier_name)
    const userTierIdx = tierOrder.indexOf(userTier)
    const reqTierIdx = tierOrder.indexOf(r.tier_required)
    return userTierIdx >= reqTierIdx
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* Header */}
      <div className="bg-indigo-600 px-6 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="text-indigo-200 font-medium text-sm">← กลับ</button>
          <h1 className="text-white font-bold text-lg">แลกคะแนนสะสม</h1>
        </div>
        {/* ยอดคะแนน */}
        <div className="bg-white/15 backdrop-blur rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm">คะแนนของคุณ</p>
            <p className="text-white text-3xl font-bold mt-0.5">⭐ {points.toLocaleString()}</p>
          </div>
          {userTier && (
            <div className="text-right">
              <p className="text-indigo-200 text-xs">ระดับ</p>
              <p className={`font-bold text-lg ${tierColors[userTier] || 'text-white'}`}>★ {userTier}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6 py-3 flex gap-2">
        {(['rewards', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {t === 'rewards' ? '🎁 ของรางวัล' : '📋 ประวัติการแลก'}
          </button>
        ))}
      </div>

      {/* Success/Error */}
      {success && (
        <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
          ✅ {success}
        </div>
      )}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Rewards Tab */}
      {tab === 'rewards' && (
        <div className="flex-1 px-6 py-5 space-y-4">
          {rewards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <p className="text-4xl mb-3">🎁</p>
              <p>ยังไม่มีของรางวัล</p>
            </div>
          ) : rewards.map(r => {
            const eligible = canRedeem(r)
            const notEnoughPoints = points < r.points_cost
            const notEnoughTier = !notEnoughPoints && !eligible
            return (
              <div key={r.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${!eligible ? 'opacity-60' : 'border-gray-100'}`}>
                {r.image_url && (
                  <img src={r.image_url} alt={r.name} className="w-full h-36 object-cover" />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900">{r.name}</p>
                        <span className={`text-xs font-medium ${tierColors[r.tier_required] || 'text-gray-500'}`}>
                          ★ {r.tier_required}
                        </span>
                      </div>
                      {r.description && <p className="text-sm text-gray-500">{r.description}</p>}
                      <p className="text-indigo-600 font-bold mt-2">⭐ {r.points_cost.toLocaleString()} คะแนน</p>
                    </div>
                    <button
                      onClick={() => { setError(''); setSuccess(''); setConfirming(r) }}
                      disabled={!eligible}
                      className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition active:scale-95 ${
                        eligible
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      แลก
                    </button>
                  </div>
                  {notEnoughPoints && (
                    <p className="text-xs text-red-400 mt-2">คะแนนไม่เพียงพอ (ต้องการอีก {(r.points_cost - points).toLocaleString()} คะแนน)</p>
                  )}
                  {notEnoughTier && (
                    <p className="text-xs text-orange-400 mt-2">ต้องการระดับ {r.tier_required} ขึ้นไป</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="flex-1 px-6 py-5">
          {redemptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p>ยังไม่มีประวัติการแลก</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {redemptions.map(r => (
                <div key={r.id} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{r.reward_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(r.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className="text-red-500 font-semibold">-⭐ {r.points_used.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirm Modal */}
      {confirming && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">ยืนยันการแลกคะแนน</h3>
            <div className="bg-indigo-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 text-sm">ของรางวัล</span>
                <span className="font-semibold text-gray-900 text-sm">{confirming.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 text-sm">คะแนนที่ใช้</span>
                <span className="font-semibold text-indigo-600 text-sm">⭐ {confirming.points_cost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-indigo-100 pt-2 mt-2">
                <span className="text-gray-600 text-sm">คะแนนคงเหลือ</span>
                <span className="font-bold text-gray-900 text-sm">⭐ {(points - confirming.points_cost).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(null)}
                disabled={redeeming}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleRedeem}
                disabled={redeeming}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold active:scale-95 transition disabled:opacity-50"
              >
                {redeeming ? 'กำลังแลก...' : 'ยืนยันแลก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
