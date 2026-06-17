'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const PHONE_DOMAIN = '@vending.local'

function phoneToEmail(phone: string) {
  return `${phone}${PHONE_DOMAIN}`
}

function isValidThaiPhone(phone: string) {
  return /^0[0-9]{9}$/.test(phone)
}

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!isValidThaiPhone(phone)) {
      setError('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (10 หลัก เริ่มด้วย 0)')
      return
    }

    setLoading(true)
    const fakeEmail = phoneToEmail(phone)

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: fakeEmail,
      password,
    })

    if (signUpError) {
      setError(signUpError.message.includes('already registered')
        ? 'เบอร์นี้ถูกใช้สมัครไปแล้ว'
        : 'ไม่สามารถสมัครสมาชิกได้: ' + signUpError.message)
      setLoading(false)
      return
    }

    const userId = signUpData.user?.id
    if (!userId) {
      setError('ไม่สามารถสร้างผู้ใช้ได้ กรุณาลองใหม่')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        phone,
        full_name: fullName || phone,
        balance: 0,
      })

    if (insertError) {
      setError('สมัครสมาชิกสำเร็จ แต่สร้าง wallet ไม่ได้ กรุณาติดต่อผู้ดูแลระบบ')
      setLoading(false)
      return
    }

    if (signUpData.session) {
      router.push('/menu')
      router.refresh()
    } else {
      router.push('/login')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12">
      <div className="mb-10 text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
          <span className="text-white text-3xl">🏪</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">สมัครสมาชิก</h1>
        <p className="text-gray-500 text-sm mt-1">สร้างบัญชีด้วยเบอร์โทรศัพท์</p>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อที่แสดง</label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-gray-50"
            placeholder="ชื่อเล่นของคุณ"
          />
        </div>

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
            minLength={6}
            autoComplete="new-password"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-gray-50"
            placeholder="อย่างน้อย 6 ตัวอักษร"
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
          {loading ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
        </button>

        <button
          type="button"
          onClick={() => router.push('/login')}
          className="w-full py-3 text-indigo-600 text-sm font-medium"
        >
          มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
        </button>
      </form>
    </div>
  )
}