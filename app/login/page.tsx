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
  const [showForceLogin, setShowForceLogin] = useState(false)
  const [pendingUserId, setPendingUserId] = useState('')

  async function createSession(userId: string, force: boolean) {
    const endpoint = force ? 'sessions/force-login' : 'sessions/login'
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        device_info: navigator.userAgent,
      }),
    })
    const data = await res.json()
    return { ok: res.ok, status: res.status, data }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setShowForceLogin(false)

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

    const session = await createSession(data.user.id, false)

    if (!session.ok) {
      if (session.status === 409) {
        setPendingUserId(data.user.id)
        setShowForceLogin(true)
        setError(session.data.error || 'บัญชีนี้กำลังถูกใช้งานอยู่ในอุปกรณ์อื่น')
      } else {
        await supabase.auth.signOut()
        setError(session.data.error || 'ไม่สามารถเข้าสู่ระบบได้')
      }
      setLoading(false)
      return
    }

    sessionStorage.setItem('session_token', session.data.session_token)
    sessionStorage.setItem('user_id', data.user.id)

    router.push('/menu')
    router.refresh()
  }

  async function handleForceLogin() {
    setLoading(true)
    setError('')

    const session = await createSession(pendingUserId, true)

    if (!session.ok) {
      await supabase.auth.signOut()
      setError(session.data.error || 'ไม่สามารถเข้าสู่ระบบได้')
      setShowForceLogin(false)
      setLoading(false)
      return
    }

    sessionStorage.setItem('session_token', session.data.session_token)
    sessionStorage.setItem('user_id', pendingUserId)

    router.push('/menu')
    router.refresh()
  }

  function handleCancelForceLogin() {
    supabase.auth.signOut()
    setShowForceLogin(false)
    setError('')
    setPendingUserId('')
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

      {!showForceLogin ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
              required
              inputMode="numeric"
              autoComplete="username"
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
      ) : (
        <div className="space-y-4">
          <div className="bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-xl">
            {error}
            <p className="mt-2">หากนี่คือคุณที่กำลังเปลี่ยนอุปกรณ์ สามารถออกจากระบบอุปกรณ์เดิมและเข้าใช้งานที่นี่ได้</p>
          </div>

          <button
            onClick={handleForceLogin}
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-base hover:bg-indigo-700 active:scale-95 transition disabled:opacity-50"
          >
            {loading ? 'กำลังดำเนินการ...' : 'ออกจากอุปกรณ์เดิม และเข้าใช้งานที่นี่'}
          </button>

          <button
            onClick={handleCancelForceLogin}
            disabled={loading}
            className="w-full py-3 text-gray-500 text-sm font-medium"
          >
            ยกเลิก
          </button>
        </div>
      )}
    </div>
  )
}
