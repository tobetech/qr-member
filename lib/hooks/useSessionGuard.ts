'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const HEARTBEAT_INTERVAL_MS = 60 * 1000 // 1 นาที

export function useSessionGuard() {
  const router = useRouter()
  const supabase = createClient()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function sendHeartbeat() {
      const userId = sessionStorage.getItem('user_id')
      const sessionToken = sessionStorage.getItem('session_token')

      if (!userId || !sessionToken) {
        return
      }

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sessions/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, session_token: sessionToken }),
        })

        if (!res.ok) {
          // session ถูกแทนที่จากอุปกรณ์อื่น หรือหมดอายุ - บังคับ logout
          sessionStorage.removeItem('user_id')
          sessionStorage.removeItem('session_token')
          await supabase.auth.signOut()
          alert('คุณถูกออกจากระบบ เนื่องจากมีการเข้าใช้งานบัญชีนี้จากอุปกรณ์อื่น')
          router.push('/login')
        }
      } catch {
        // เน็ตมีปัญหาชั่วคราว - ไม่ต้อง logout ทันที รอ heartbeat รอบถัดไป
      }
    }

    sendHeartbeat()
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])
}
