'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Profile {
  full_name: string
  balance: number
}

export default function MenuPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('users')
        .select('full_name, balance')
        .eq('id', user.id)
        .single()

      setProfile(data)
      setLoading(false)
    }
    load()

    // Realtime balance update
    const channel = supabase
      .channel('balance')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
      }, payload => {
        setProfile(prev => prev ? { ...prev, balance: payload.new.balance } : prev)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function handleLogout() {
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-indigo-600 px-6 pt-12 pb-8">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-indigo-200 text-sm">สวัสดี</p>
            <h2 className="text-white text-xl font-bold">{profile?.full_name || 'ผู้ใช้'}</h2>
          </div>
          <button
            onClick={handleLogout}
            className="text-indigo-200 text-sm hover:text-white"
          >
            ออกจากระบบ
          </button>
        </div>

        {/* Wallet Card */}
        <div className="mt-6 bg-white/15 backdrop-blur rounded-2xl p-5">
          <p className="text-indigo-100 text-sm">ยอดเงินคงเหลือ</p>
          <p className="text-white text-4xl font-bold mt-1">
            ฿{profile?.balance?.toFixed(2) || '0.00'}
          </p>
        </div>
      </div>

      {/* Menu Grid */}
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

        <button
          onClick={() => router.push('/menu/history')}
          className="w-full flex items-center gap-4 bg-white border border-gray-100 px-5 py-4 rounded-2xl active:scale-95 transition shadow-sm"
        >
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl">
            🧾
          </div>
          <div className="text-left">
            <p className="font-semibold text-lg text-gray-900">ประวัติการซื้อ</p>
            <p className="text-gray-400 text-sm">รายการซื้อสินค้าที่ผ่านมา</p>
          </div>
        </button>
      </div>
    </div>
  )
}