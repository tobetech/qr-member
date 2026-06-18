'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useSessionGuard } from '@/lib/hooks/useSessionGuard'
interface Transaction {
  id: string
  tx_id: string
  product_name: string
  amount: number
  status: string
  created_at: string
}

interface TopupOrder {
  id: string
  mch_order_no: string
  amount: number
  status: string
  created_at: string
}

const purchaseStatusLabel: Record<string, { text: string; color: string }> = {
  completed: { text: 'สำเร็จ', color: 'text-green-600 bg-green-50' },
  dispensing: { text: 'กำลังจ่าย', color: 'text-yellow-600 bg-yellow-50' },
  failed_refunded: { text: 'คืนเงินแล้ว', color: 'text-red-600 bg-red-50' },
  pending: { text: 'รอดำเนินการ', color: 'text-gray-600 bg-gray-50' },
}

const topupStatusLabel: Record<string, { text: string; color: string }> = {
  completed: { text: 'สำเร็จ', color: 'text-green-600 bg-green-50' },
  pending: { text: 'รอชำระเงิน', color: 'text-yellow-600 bg-yellow-50' },
  failed: { text: 'ไม่สำเร็จ', color: 'text-red-600 bg-red-50' },
  expired: { text: 'หมดอายุ', color: 'text-gray-600 bg-gray-50' },
}

type Tab = 'purchase' | 'topup'

export default function HistoryPage() {
  const router = useRouter()
  const supabase = createClient()
  useSessionGuard();
  const [tab, setTab] = useState<Tab>('purchase')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [topups, setTopups] = useState<TopupOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: txData }, { data: topupData }] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('vending_topup_orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      setTransactions(txData || [])
      setTopups(topupData || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-6 pt-12 pb-4 flex items-center gap-3 border-b">
        <button onClick={() => router.back()} className="text-indigo-600 font-medium">← กลับ</button>
        <h1 className="font-bold text-lg text-gray-900">ประวัติการใช้งาน</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white px-6 pb-3 flex gap-2 border-b">
        <button
          onClick={() => setTab('purchase')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${
            tab === 'purchase' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          ซื้อสินค้า
        </button>
        <button
          onClick={() => setTab('topup')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${
            tab === 'topup' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          เติมเงิน
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'purchase' ? (
        transactions.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">🧾</p>
            <p>ยังไม่มีประวัติการซื้อ</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {transactions.map(tx => {
              const s = purchaseStatusLabel[tx.status] || { text: tx.status, color: 'text-gray-600 bg-gray-50' }
              return (
                <div key={tx.id} className="bg-white px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{tx.product_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(tx.created_at).toLocaleString('th-TH')}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${s.color}`}>
                      {s.text}
                    </span>
                  </div>
                  <p className="font-bold text-gray-900">฿{tx.amount.toFixed(2)}</p>
                </div>
              )
            })}
          </div>
        )
      ) : (
        topups.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">💳</p>
            <p>ยังไม่มีประวัติการเติมเงิน</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {topups.map(order => {
              const s = topupStatusLabel[order.status] || { text: order.status, color: 'text-gray-600 bg-gray-50' }
              return (
                <div key={order.id} className="bg-white px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">เติมเงินผ่าน PromptPay</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(order.created_at).toLocaleString('th-TH')}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${s.color}`}>
                      {s.text}
                    </span>
                  </div>
                  <p className="font-bold text-gray-900">฿{order.amount.toFixed(2)}</p>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}