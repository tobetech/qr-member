'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useSessionGuard } from '@/lib/hooks/useSessionGuard'

const AMOUNTS = [20, 50, 100, 200, 500]

export default function TopupPage() {
  const router = useRouter()
  const supabase = createClient()
  useSessionGuard()

  const [amount, setAmount] = useState(100)
  const [custom, setCustom] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [orderNo, setOrderNo] = useState('')
  const [status, setStatus] = useState<'idle' | 'creating' | 'waiting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const finalAmount = custom ? parseInt(custom) : amount

  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current) } }, [])

  async function handleCreateOrder() {
    if (isSubmitting || !finalAmount || finalAmount <= 0) return
    setIsSubmitting(true)
    setStatus('creating')
    setErrorMsg('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/topup/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, amount: finalAmount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')

      setQrUrl(data.qr_code)
      setOrderNo(data.mch_order_no)
      setStatus('waiting')

      pollRef.current = setInterval(async () => {
        const r = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/topup/status/${data.mch_order_no}`)
        const d = await r.json()
        if (d.status === 'completed') { clearInterval(pollRef.current!); setStatus('success') }
      }, 3000)
    } catch (err: any) {
      setErrorMsg(err.message)
      setStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  function reset() {
    if (pollRef.current) clearInterval(pollRef.current)
    setStatus('idle')
    setQrUrl('')
    setOrderNo('')
    setCustom('')
  }

  function handleSaveQR() {
    if (!qrUrl) return
    const link = document.createElement('a')
    link.href = qrUrl
    link.download = `promptpay-qr-${orderNo}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* Header — เหมือนหน้า menu */}
      <div className="bg-indigo-600 px-6 pt-12 pb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-indigo-200 font-medium text-sm">
            ← กลับ
          </button>
          <h1 className="text-white font-bold text-lg">เติมเงิน</h1>
        </div>
      </div>

      {/* IDLE */}
      {status === 'idle' && (
        <div className="flex-1 px-6 py-6 space-y-5">
          {/* เลือกจำนวน */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-medium text-gray-500 mb-3">เลือกจำนวนเงิน</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {AMOUNTS.map(a => (
                <button
                  key={a}
                  onClick={() => { setAmount(a); setCustom('') }}
                  className={`py-3 rounded-xl font-semibold text-sm border transition active:scale-95 ${
                    amount === a && !custom
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  ฿{a}
                </button>
              ))}
              <input
                type="number"
                placeholder="กำหนดเอง"
                value={custom}
                onChange={e => setCustom(e.target.value)}
                className="py-3 px-2 rounded-xl border border-gray-200 text-center text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 col-span-3"
              />
            </div>
          </div>

          {/* สรุปยอด */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 text-center">
            <p className="text-sm text-indigo-500 font-medium">ยอดที่จะเติม</p>
            <p className="text-4xl font-bold text-indigo-700 mt-1">฿{finalAmount || 0}</p>
          </div>

          <button
            onClick={handleCreateOrder}
            disabled={!finalAmount || finalAmount <= 0 || isSubmitting}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-lg active:scale-95 transition disabled:opacity-50"
          >
            สร้าง QR PromptPay
          </button>
        </div>
      )}

      {/* CREATING */}
      {status === 'creating' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">กำลังสร้าง QR Code...</p>
        </div>
      )}

      {/* WAITING */}
      {status === 'waiting' && (
        <div className="flex-1 px-6 py-6 flex flex-col items-center gap-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 w-full text-center">
            <p className="text-sm text-gray-500 mb-1">สแกนเพื่อเติมเงิน</p>
            <p className="text-3xl font-bold text-indigo-700 mb-5">฿{finalAmount}</p>

            {qrUrl && (
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-white border border-gray-200 rounded-2xl inline-block">
                  <img src={qrUrl} alt="PromptPay QR" className="w-56 h-56" />
                </div>
              </div>
            )}

            <button
              onClick={handleSaveQR}
              className="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-full text-sm font-medium active:scale-95 transition inline-flex items-center gap-2"
            >
              💾 บันทึกรูป QR
            </button>
          </div>

          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
            <span>กำลังรอการชำระเงิน...</span>
          </div>

          <button onClick={reset} className="text-gray-400 text-sm underline">
            ยกเลิก
          </button>
        </div>
      )}

      {/* SUCCESS */}
      {status === 'success' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 py-20">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-white text-5xl">✓</span>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">เติมเงินสำเร็จ!</h2>
            <p className="text-gray-500 mt-1">฿{finalAmount} เข้า wallet แล้ว</p>
          </div>
          <button
            onClick={() => router.push('/menu')}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-lg active:scale-95 transition"
          >
            กลับหน้าหลัก
          </button>
        </div>
      )}

      {/* ERROR */}
      {status === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 py-20">
          <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-white text-5xl">✕</span>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900">เกิดข้อผิดพลาด</h2>
            <p className="text-gray-500 mt-1 text-sm">{errorMsg}</p>
          </div>
          <button
            onClick={reset}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold"
          >
            ลองใหม่
          </button>
        </div>
      )}

    </div>
  )
}
