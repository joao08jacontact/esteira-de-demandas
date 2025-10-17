import React from "react"

type Props = { onClose: () => void }

export default function DashOnlyScreen({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[2147483647] bg-black">
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
