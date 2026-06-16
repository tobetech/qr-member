'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const AMOUNTS = [20, 50, 100, 200, 500]

export default function TopupPage() {
  const router = useRouter()
  const [amount, setAmount] = useState(100)
  const [custom, setCustom] = useState('')

  const finalAmount = custom ? parseInt(custom) : amount

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-6 pt-12 pb-4 flex items-center gap-3 border-b">
        <button onClick={() => router.back()} className="text-indigo-600 font-medium">← กลับ</button>
        <h1 className="font-bold text-lg text-gray-900">เติมเงิน</h1>
      </div>

      <div className="px-6 py-6 space-y-6">
        <div>
          <p className="text-sm text-gray-500 mb-3">เลือกจำนวนเงิน</p>
          <div className="grid grid-cols-3 gap-3">
            {AMOUNTS.map(a => (
              <button
                key={a}
                onClick={() => { setAmount(a); setCustom('') }}
                className={`py-3 rounded-xl font-semibold text-sm border transition active:scale-95
                  ${amount === a && !custom
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-200'}`}
              >
                ฿{a}
              </button>
            ))}
            <input
              type="number"
              placeholder="กำหนดเอง"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              className="py-3 px-2 rounded-xl border border-gray-200 text-center text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
          <p className="text-sm text-yellow-700">เติมเงิน</p>
          <p className="text-3xl font-bold text-yellow-800 mt-1">฿{finalAmount || 0}</p>
        </div>

        <div className="bg-blue-50 rounded-2xl p-4 text-sm text-blue-700">
          <p className="font-medium mb-1">📌 วิธีเติมเงิน</p>
          <p>ติดต่อผู้ดูแลระบบเพื่อเติมเงินเข้า Wallet<br />หรือรอระบบ PromptPay (เร็วๆนี้)</p>
        </div>

        <p className="text-center text-xs text-gray-400">ระบบเติมเงินอัตโนมัติจะพร้อมใช้งานเร็วๆนี้</p>
      </div>
    </div>
  )
}