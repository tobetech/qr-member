'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type ScanState = 'scanning' | 'processing' | 'success' | 'error'

interface Result {
  tx_id?: string
  product?: string
  amount?: number
  balance?: number
  error?: string
}

export default function ScanPage() {
  const router = useRouter()
  const supabase = createClient()
  const [state, setState] = useState<ScanState>('scanning')
  const [result, setResult] = useState<Result>({})
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true  // ง่ายที่สุด ไม่มี constraint เพิ่ม
    })
    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      scanningRef.current = true
      animFrameRef.current = requestAnimationFrame(scanFrame)
    }
  } catch (err: any) {
    console.log('Camera error name:', err.name)
    console.log('Camera error message:', err.message)
    setResult({ error: `${err.name}: ${err.message}` })
    setState('error')
  }
}

  function stopCamera() {
    scanningRef.current = false
    cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
  }

  async function scanFrame() {
    if (!scanningRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState !== 4) {
      animFrameRef.current = requestAnimationFrame(scanFrame)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // ใช้ BarcodeDetector API (รองรับบน Chrome/Safari mobile)
    if ('BarcodeDetector' in window) {
      try {
        // @ts-ignore
        const detector = new BarcodeDetector({ formats: ['qr_code'] })
        // @ts-ignore
        const codes = await detector.detect(canvas)
        if (codes.length > 0 && scanningRef.current) {
          scanningRef.current = false
          stopCamera()
          await processQR(codes[0].rawValue)
          return
        }
      } catch {}
    }

    animFrameRef.current = requestAnimationFrame(scanFrame)
  }

  async function processQR(decodedText: string) {
    setState('processing')
    try {
      const url = new URL(decodedText)
      const token = url.searchParams.get('token')
      const machine = url.searchParams.get('machine')

      if (!token || !machine) throw new Error('QR Code ไม่ถูกต้อง')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, user_id: user.id }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')

      const finalResult = await pollTransaction(data.tx_id)
      setResult({ ...data, ...finalResult })
      setState('success')

    } catch (err: any) {
      setResult({ error: err.message })
      setState('error')
    }
  }

  async function pollTransaction(tx_id: string): Promise<{ balance?: number }> {
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1000))
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/transaction/${tx_id}`)
      const data = await res.json()
      if (data.status === 'completed') {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('users').select('balance').eq('id', user.id).single()
          return { balance: profile?.balance }
        }
        return {}
      }
      if (data.status === 'failed_refunded') {
        throw new Error('จ่ายสินค้าไม่สำเร็จ ระบบคืนเงินแล้ว')
      }
    }
    return {}
  }

  function handleRetry() {
    setState('scanning')
    startCamera()
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4 z-10 relative">
        <button
          onClick={() => { stopCamera(); router.push('/menu') }}
          className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white text-xl"
        >
          ←
        </button>
        <h1 className="text-white font-semibold text-lg">สแกน QR จากตู้</h1>
      </div>

      {/* Camera View */}
      {state === 'scanning' && (
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <video
            ref={videoRef}
            className="w-full h-full object-cover absolute inset-0"
            playsInline
            muted
            autoPlay
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Overlay frame */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-64 h-64 relative">
              <div className="absolute inset-0 border-2 border-white/30 rounded-2xl" />
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />
              {/* Scan line animation */}
              <div className="absolute left-2 right-2 h-0.5 bg-indigo-400 animate-bounce top-1/2" />
            </div>
            <p className="text-white/80 text-sm mt-6 text-center px-8">
              วาง QR Code จากตู้ไว้ในกรอบ
            </p>
          </div>
        </div>
      )}

      {/* Processing */}
      {state === 'processing' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="w-16 h-16 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-white text-lg font-medium">กำลังดำเนินการ...</p>
          <p className="text-gray-400 text-sm">กรุณารอสักครู่</p>
        </div>
      )}

      {/* Success */}
      {state === 'success' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white text-5xl">✓</span>
          </div>
          <div className="text-center">
            <h2 className="text-white text-2xl font-bold">สำเร็จ!</h2>
            <p className="text-gray-400 mt-1">กรุณารับสินค้าจากตู้</p>
          </div>
          <div className="w-full bg-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">สินค้า</span>
              <span className="text-white font-medium">{result.product}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">ราคา</span>
              <span className="text-white font-medium">฿{result.amount?.toFixed(2)}</span>
            </div>
            <div className="border-t border-white/10 pt-3 flex justify-between">
              <span className="text-gray-400">ยอดเงินคงเหลือ</span>
              <span className="text-green-400 font-bold text-lg">
                ฿{result.balance?.toFixed(2)}
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push('/menu')}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-lg active:scale-95 transition"
          >
            กลับหน้าหลัก
          </button>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-5xl">✕</span>
          </div>
          <div className="text-center">
            <h2 className="text-white text-2xl font-bold">เกิดข้อผิดพลาด</h2>
            <p className="text-gray-400 mt-2 text-sm">{result.error}</p>
          </div>
          <div className="flex flex-col w-full gap-3">
            <button
              onClick={handleRetry}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold active:scale-95 transition"
            >
              สแกนใหม่
            </button>
            <button
              onClick={() => router.push('/menu')}
              className="w-full py-4 bg-white/10 text-white rounded-2xl font-semibold active:scale-95 transition"
            >
              กลับหน้าหลัก
            </button>
          </div>
        </div>
      )}
    </div>
  )
}