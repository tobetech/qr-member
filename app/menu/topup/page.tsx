"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const AMOUNTS = [20, 50, 100, 200, 500];

export default function TopupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [amount, setAmount] = useState(100);
  const [custom, setCustom] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [status, setStatus] = useState<
    "idle" | "creating" | "waiting" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const finalAmount = custom ? parseInt(custom) : amount;

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreateOrder() {
    if (isSubmitting) return;
    if (!finalAmount || finalAmount <= 0) return;

    setIsSubmitting(true);
    setStatus("creating");
    setErrorMsg("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/topup/create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id, amount: finalAmount }),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");

      setQrUrl(data.qr_code);
      setOrderNo(data.mch_order_no);
      setStatus("waiting");

      pollRef.current = setInterval(async () => {
        const r = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/topup/status/${data.mch_order_no}`,
        );
        const d = await r.json();
        if (d.status === "completed") {
          clearInterval(pollRef.current!);
          setStatus("success");
        }
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  function reset() {
    if (pollRef.current) clearInterval(pollRef.current);
    setStatus("idle");
    setQrUrl("");
    setOrderNo("");
  }

  function handleSaveQR() {
    if (!qrUrl) return;

    const link = document.createElement("a");
    link.href = qrUrl;
    link.download = `promptpay-qr-${orderNo}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-6 pt-12 pb-4 flex items-center gap-3 border-b">
        <button
          onClick={() => router.back()}
          className="text-indigo-600 font-medium"
        >
          ← กลับ
        </button>
        <h1 className="font-bold text-lg text-gray-900">เติมเงิน</h1>
      </div>

      {status === "idle" && (
        <div className="px-6 py-6 space-y-6">
          <div>
            <p className="text-sm text-gray-500 mb-3">เลือกจำนวนเงิน</p>
            <div className="grid grid-cols-3 gap-3">
              {AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => {
                    setAmount(a);
                    setCustom("");
                  }}
                  className={`py-3 rounded-xl font-semibold text-sm border transition active:scale-95
                    ${
                      amount === a && !custom
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-700 border-gray-200"
                    }`}
                >
                  ฿{a}
                </button>
              ))}
              <input
                type="number"
                placeholder="กำหนดเอง"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="py-3 px-2 rounded-xl border border-gray-200 text-center text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
            <p className="text-sm text-yellow-700">เติมเงิน</p>
            <p className="text-3xl font-bold text-yellow-800 mt-1">
              ฿{finalAmount || 0}
            </p>
          </div>

          <button
            onClick={handleCreateOrder}
            disabled={!finalAmount || isSubmitting}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-lg active:scale-95 transition disabled:opacity-50"
          >
            สร้าง QR PromptPay
          </button>
        </div>
      )}

      {status === "creating" && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">กำลังสร้าง QR Code...</p>
        </div>
      )}

      {status === "waiting" && (
        <div className="px-6 py-6 flex flex-col items-center gap-6">
          <div className="text-center">
            <p className="text-gray-500 text-sm">สแกนเพื่อเติมเงิน</p>
            <p className="text-2xl font-bold text-gray-900">฿{finalAmount}</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200">
            {qrUrl && (
              <img
                src={qrUrl}
                alt="PromptPay QR"
                className="w-64 h-64"
                id="qr-image"
              />
            )}
          </div>

          <button
            onClick={handleSaveQR}
            className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium flex items-center gap-2 active:scale-95 transition"
          >
            💾 บันทึกรูป QR
          </button>

          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
            <span>กำลังรอการชำระเงิน...</span>
          </div>

          <button onClick={reset} className="text-gray-400 text-sm underline">
            ยกเลิก
          </button>
        </div>
      )}

      {status === "success" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 py-20">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white text-5xl">✓</span>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              เติมเงินสำเร็จ!
            </h2>
            <p className="text-gray-500 mt-1">
              ฿{finalAmount} เข้า wallet แล้ว
            </p>
          </div>
          <button
            onClick={() => router.push("/menu")}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-lg active:scale-95 transition"
          >
            กลับหน้าหลัก
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 py-20">
          <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-5xl">✕</span>
          </div>
          <p className="text-gray-600 text-center">{errorMsg}</p>
          <button
            onClick={reset}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold"
          >
            ลองใหม่
          </button>
        </div>
      )}
    </div>
  );
}
