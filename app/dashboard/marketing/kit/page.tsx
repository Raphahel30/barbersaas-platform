'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function MarketingKitPage() {
  const [tenantName, setTenantName] = useState('Barbearia Imperial')
  const [tenantSlug, setTenantSlug] = useState('imperial-matriz')
  const [primaryColor, setPrimaryColor] = useState('#f59e0b')
  const [templateSize, setTemplateSize] = useState<'acrylic' | 'a5' | 'a4'>('acrylic')

  // Wi-Fi Options
  const [enableWifi, setEnableWifi] = useState(true)
  const [wifiSsid, setWifiSsid] = useState('Barbearia_VIP_5G')
  const [wifiPass, setWifiPass] = useState('corte1234')

  // Custom text
  const [headline, setHeadline] = useState('Agende sem Filas')
  const [subheadline, setSubheadline] = useState('Aproxime a câmera do seu celular para agendar seu próximo corte em 2 cliques sem baixar app.')

  const [bookingUrl, setBookingUrl] = useState('')

  useEffect(() => {
    async function loadTenant() {
      try {
        const res = await fetch('/api/tenant/me')
        const data = await res.json()
        if (data?.tenantName) setTenantName(data.tenantName)

        const origin = window.location.origin
        const slug = data?.tenantSlug || 'imperial-matriz'
        setTenantSlug(slug)
        setBookingUrl(`${origin}/${slug}`)
      } catch {
        setBookingUrl(`https://barbersaas.com.br/${tenantSlug}`)
      }
    }
    loadTenant()
  }, [tenantSlug])

  const qrBookingSrc = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&format=svg&data=${encodeURIComponent(
    bookingUrl || 'https://barbersaas.com.br',
  )}`

  const wifiPayload = `WIFI:S:${wifiSsid};T:WPA;P:${wifiPass};;`
  const qrWifiSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=svg&data=${encodeURIComponent(
    wifiPayload,
  )}`

  function handlePrint() {
    window.print()
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8 font-sans">
      {/* Controles de Configuração (Ocultos na Impressão) */}
      <div className="max-w-6xl mx-auto space-y-6 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
                Marketing de Balcão & PDV
              </span>
              <span className="text-xs text-zinc-500">Impressão em Alta Resolução</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-outfit">
              Gerador de Display de Balcão (QR Code)
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Personalize o display físico da sua barbearia para o cliente agendar pelo celular e conectar no Wi-Fi.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/agenda"
              className="text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 transition-colors"
            >
              ← Voltar à Agenda
            </Link>
            <button
              onClick={handlePrint}
              className="gold-button text-xs sm:text-sm px-5 py-2.5 shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir / Salvar em PDF
            </button>
          </div>
        </div>

        {/* Barra de Customização */}
        <div className="glass-card p-5 border-zinc-800 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-zinc-400 font-semibold mb-1">Formato do Material</label>
            <select
              value={templateSize}
              onChange={(e) => setTemplateSize(e.target.value as any)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="acrylic">Display de Acrílico (10x15 cm)</option>
              <option value="a5">Flyer de Mesa (A5)</option>
              <option value="a4">Cartaz de Parede (A4)</option>
            </select>
          </div>

          <div>
            <label className="block text-zinc-400 font-semibold mb-1">Título Principal</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-white focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-400 font-semibold mb-1">Cor Primária</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-9 h-9 rounded bg-transparent border-0 cursor-pointer"
              />
              <span className="font-mono text-zinc-400">{primaryColor}</span>
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 font-semibold mb-1">QR Code de Wi-Fi</label>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableWifi}
                onChange={(e) => setEnableWifi(e.target.checked)}
                className="rounded border-zinc-700 text-amber-500 focus:ring-0"
              />
              <span className="text-zinc-300 font-medium">Incluir Wi-Fi no display</span>
            </label>
          </div>

          {enableWifi && (
            <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-800/60 pt-3">
              <div>
                <label className="block text-zinc-400 mb-1">Nome da Rede Wi-Fi (SSID)</label>
                <input
                  type="text"
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                  placeholder="Ex: Barbearia_Clientes"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">Senha do Wi-Fi</label>
                <input
                  type="text"
                  value={wifiPass}
                  onChange={(e) => setWifiPass(e.target.value)}
                  placeholder="Ex: cortesaudavel"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ÁREA DE IMPRESSÃO / PRÉ-VISUALIZAÇÃO */}
      <div className="max-w-xl mx-auto my-8 print:m-0 print:max-w-none print:w-full">
        <div
          id="print-card"
          className="bg-zinc-950 text-white border-2 rounded-2xl shadow-2xl p-8 sm:p-10 flex flex-col items-center justify-between text-center relative overflow-hidden"
          style={{
            borderColor: primaryColor,
            minHeight: templateSize === 'acrylic' ? '600px' : templateSize === 'a5' ? '700px' : '900px',
          }}
        >
          {/* Decoração Vintage Sutil */}
          <div
            className="absolute top-0 left-0 right-0 h-3"
            style={{ backgroundColor: primaryColor }}
          />

          {/* Cabeçalho do Display */}
          <div className="space-y-2 mt-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border-2 mb-1" style={{ borderColor: primaryColor }}>
              <span className="text-xl font-black" style={{ color: primaryColor }}>✂</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider font-outfit">
              {tenantName}
            </h2>
            <div className="h-0.5 w-16 mx-auto rounded" style={{ backgroundColor: primaryColor }} />
            <h3 className="text-lg sm:text-xl font-bold text-zinc-100 pt-2">
              {headline}
            </h3>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
              {subheadline}
            </p>
          </div>

          {/* QR Code Principal de Agendamento */}
          <div className="my-6 p-4 bg-white rounded-2xl shadow-xl flex flex-col items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrBookingSrc}
              alt="QR Code de Agendamento"
              className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
            />
            <p className="text-[10px] font-mono text-zinc-900 font-bold uppercase mt-2">
              Aponte a câmera do seu celular
            </p>
          </div>

          {/* Bloco de Wi-Fi Opcional */}
          {enableWifi ? (
            <div className="w-full border-t border-zinc-800 pt-4 flex items-center justify-between px-4 bg-zinc-900/60 rounded-xl p-3">
              <div className="text-left space-y-0.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Wi-Fi Grátis da Barbearia
                </span>
                <p className="text-xs font-bold text-white">Rede: {wifiSsid}</p>
                <p className="text-xs font-mono text-zinc-400">Senha: <span className="text-white font-bold">{wifiPass}</span></p>
              </div>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrWifiSrc}
                alt="QR Code Wi-Fi"
                className="w-16 h-16 bg-white p-1 rounded-lg object-contain shadow"
              />
            </div>
          ) : (
            <div className="text-center pt-2">
              <p className="text-xs font-mono font-semibold" style={{ color: primaryColor }}>
                {bookingUrl}
              </p>
            </div>
          )}

          {/* Rodapé do Display */}
          <div className="text-[10px] text-zinc-500 tracking-wider uppercase mt-4">
            Agendamento Rápido em 2 Cliques • Sem Filas e Sem Senha
          </div>
        </div>
      </div>

      {/* Estilos CSS específicos para Impressão */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          #print-card {
            border: 2px solid #000000 !important;
            box-shadow: none !important;
            margin: 0 auto !important;
            page-break-inside: avoid;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  )
}
