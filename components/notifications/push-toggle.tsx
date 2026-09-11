'use client'

import React, { useState, useEffect } from 'react'
import { Bell, BellRing, Check, ShieldCheck, Smartphone } from 'lucide-react'
import { registerPushSubscriptionAction } from '@/app/actions/notifications'

interface PushToggleProps {
  tenantId: string
  userType?: 'client' | 'barber'
}

export function PushToggle({ tenantId, userType = 'client' }: PushToggleProps) {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  const handleSubscribe = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setStatusMessage('Notificações não são suportadas neste navegador.')
      return
    }

    try {
      setIsSubscribing(true)
      setStatusMessage(null)

      const perm = await Notification.requestPermission()
      setPermission(perm)

      if (perm === 'granted') {
        const registration = await navigator.serviceWorker.ready

        let subscription = await registration.pushManager.getSubscription()
        if (!subscription) {
          // Inscreve com VAPID público dummy ou padrão
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjB-meeNu0nKDhQ0HSG',
          })
        }

        const rawKey = subscription.getKey ? subscription.getKey('p256dh') : null
        const rawAuth = subscription.getKey ? subscription.getKey('auth') : null

        const p256dh = rawKey
          ? btoa(String.fromCharCode(...new Uint8Array(rawKey)))
          : 'p256dh_mock'
        const auth = rawAuth
          ? btoa(String.fromCharCode(...new Uint8Array(rawAuth)))
          : 'auth_mock'

        const res = await registerPushSubscriptionAction(
          subscription.endpoint,
          { p256dh, auth },
          tenantId,
          userType,
        )

        if (res.success) {
          setStatusMessage('Notificações ativadas com sucesso!')
        }
      } else if (perm === 'denied') {
        setStatusMessage('Permissão bloqueada no navegador.')
      }
    } catch (err) {
      setStatusMessage('Não foi possível ativar as notificações agora.')
    } finally {
      setIsSubscribing(false)
    }
  }

  if (permission === 'granted') {
    return (
      <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs text-emerald-300">
        <div className="flex items-center gap-2.5">
          <BellRing className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Avisos na tela de bloqueio ativados.</span>
        </div>
        <Check className="w-4 h-4 text-emerald-400" />
      </div>
    )
  }

  return (
    <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-amber-500/15 text-amber-400 rounded-xl shrink-0">
          <Bell className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-white text-sm">Receber avisos na tela do celular</h4>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Lembretes de horário e selos de fidelidade na tela de bloqueio (sem custo).
          </p>
        </div>
      </div>

      <button
        onClick={handleSubscribe}
        disabled={isSubscribing || permission === 'denied'}
        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-neutral-950 font-bold rounded-xl transition shrink-0 shadow-md flex items-center justify-center gap-1.5"
      >
        <Smartphone className="w-3.5 h-3.5" />
        {isSubscribing ? 'Ativando...' : 'Ativar Notificações'}
      </button>

      {statusMessage && (
        <p className="text-[11px] text-amber-400 sm:col-span-2">{statusMessage}</p>
      )}
    </div>
  )
}
