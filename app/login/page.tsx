'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const PHONE_DOMAIN = '@vending.local'

function phoneToEmail(phone: string) {
  return `${phone}${PHONE_DOMAIN}`
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fakeEmail = phoneToEmail(phone)
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password,
    })

    if (authError || !data.user) {
      setError('เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง')
      setLoading(false)
      return
    }

    // เช็คว่ามีคนใช้งานบัญชีนี้อยู่ที่อื่นไหม
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sessions/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: data.user.id,
          device_info: navigator.userAgent,
        }),
      })

      const sessionData = await res.json()

      if (!res.ok) {
        // มีคนใช้งานอยู่ - sign out ออกจาก auth ด้วย ไม่ให้ login ค้างอยู่
        await supabase.auth.signOut()
        setError(sessionData.error || 'ไม่สามารถเข้าสู่ระบบได้')
        setLoading(false)
        return
      }

      // เก็บ session_token ไว้ใช้ heartbeat ต่อไป
      sessionStorage.setItem('session_token', sessionData.session_token)
      sessionStorage.setItem('user_id', data.user.id)
    } catch {
      await supabase.auth.signOut()
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่')
      setLoading(false)
      return
    }

    router.push('/menu')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12">
      <div className="mb-10 text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
          <span className="text-white text-3xl">🏪</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Vending App</h1>
        <p className="text-gray-500 text-sm mt-1">เข้าสู่ระบบเพื่อซื้อสินค้า</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
            required
            inputMode="numeric"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-gray-50"
            placeholder="0812345678"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-gray-50"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-base hover:bg-indigo-700 active:scale-95 transition disabled:opacity-50"
        >
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>

        <button
          type="button"
          onClick={() => router.push('/signup')}
          className="w-full py-3 text-indigo-600 text-sm font-medium"
        >
          ยังไม่มีบัญชี? สมัครสมาชิก
        </button>
      </form>
    </div>
  )
}