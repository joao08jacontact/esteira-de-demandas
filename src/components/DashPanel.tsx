import React, { useEffect } from "react"
import { createPortal } from "react-dom"

type Props = {
  open: boolean
  onClose: () => void
}

function Panel({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = "" }
  }, [onClose])

  return (
    <div
      data-dash-panel
      className="fixed inset-0 z-[2147483647] bg-black"
      style={{ contain: "layout style", willChange: "transform" }}
    >
      <div className="h-14 flex items-center justify-between px-4 border-b border-neutral-800 bg-neutral-950">
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700"
          title="Voltar para a Esteira"
        >
          ← Voltar para a Esteira
        </button>
        <div className="text-sm text-neutral-400">DashRealtime</div>
        <div />
      </div>
      <iframe
        src="/dash/"
        className="w-full"
        style={{ height: "calc(100vh - 56px)", border: "none" }}
        rel="noopener"
        title="DashRealtime"
      />
    </div>
  )
}

export default function DashPanel({ open, onClose }: Props) {
  if (!open) return null
  const root = typeof document !== "undefined" ? document.body : null
  if (!root) return null
  return createPortal(<Panel onClose={onClose} />, root)
}
