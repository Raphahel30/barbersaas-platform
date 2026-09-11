'use client'

import { useState } from 'react'
import type { AuditLogItem } from '@/lib/logs/audit'

interface AuditLogsViewerProps {
  logs: AuditLogItem[]
  title?: string
  subtitle?: string
}

const ACTION_LABELS: Record<string, string> = {
  gateway_credentials_updated: 'Atualização de Gateway de Pagamento',
  gateway_disconnected: 'Desconexão de Gateway de Pagamento',
  cash_closing_settled: 'Quitação e Fechamento de Caixa',
  team_member_removed: 'Exclusão de Membro da Equipe',
  manual_credit_applied: 'Concessão Manual de Crédito ao Cliente',
  refund_issued: 'Estorno de Pagamento Realizado',
  onboarding_completed: 'Conclusão de Onboarding da Barbearia',
  tenant_status_changed: 'Alteração de Status do Tenant',
  visual_settings_updated: 'Atualização de Identidade Visual',
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  security: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    label: 'Segurança',
  },
  financial: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    label: 'Financeiro',
  },
  team: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    label: 'Equipe',
  },
  system: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    label: 'Sistema',
  },
}

export function AuditLogsViewer({
  logs,
  title = 'Trilha de Auditoria & Observabilidade',
  subtitle = 'Histórico cronológico de operações sensíveis e alterações administrativas',
}: AuditLogsViewerProps) {
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')

  const filteredLogs = logs.filter((log) => {
    if (filterCategory === 'all') return true
    return log.category === filterCategory
  })

  function formatDate(iso: string) {
    try {
      const d = new Date(iso)
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="glass-card border-zinc-800 overflow-hidden">
      {/* Header do Visualizador */}
      <div className="p-4 sm:p-6 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            {title}
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
        </div>

        {/* Filtro por Categoria */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'security', 'financial', 'team', 'system'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium border transition-colors ${
                filterCategory === cat
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {cat === 'all' ? 'Todos' : CATEGORY_STYLES[cat]?.label ?? cat}
            </button>
          ))}
        </div>
      </div>

      {/* Lista / Tabela de Logs */}
      {filteredLogs.length === 0 ? (
        <div className="p-8 text-center text-zinc-500 text-xs">
          Nenhum evento de auditoria registrado para esta categoria.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/90 text-zinc-400 uppercase tracking-wider font-semibold border-b border-zinc-800">
              <tr>
                <th className="p-3.5">Data / Hora</th>
                <th className="p-3.5">Categoria</th>
                <th className="p-3.5">Ação Realizada</th>
                <th className="p-3.5">Responsável</th>
                <th className="p-3.5 text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-sans">
              {filteredLogs.map((log) => {
                const style = CATEGORY_STYLES[log.category] || {
                  bg: 'bg-zinc-800',
                  text: 'text-zinc-300',
                  border: 'border-zinc-700',
                  label: log.category,
                }
                const label = ACTION_LABELS[log.action] || log.action

                return (
                  <tr key={log.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="p-3.5 text-zinc-400 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${style.bg} ${style.text} ${style.border}`}>
                        {style.label}
                      </span>
                    </td>
                    <td className="p-3.5 font-medium text-white max-w-[280px] truncate">
                      {label}
                    </td>
                    <td className="p-3.5 text-zinc-300 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-200">{log.actor_email}</span>
                        <span className="text-[10px] text-zinc-500 uppercase">{log.actor_role}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-[11px] px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors border border-zinc-700"
                      >
                        Inspecionar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Inspeção JSON */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h4 className="font-bold text-white text-sm">
                  {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                </h4>
                <p className="text-[11px] text-zinc-400">
                  {formatDate(selectedLog.created_at)} • ID: {selectedLog.id.slice(0, 8)}...
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-zinc-400 hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-800/50">
                <span className="text-zinc-500">Responsável:</span>
                <span className="text-zinc-200 font-mono">{selectedLog.actor_email} ({selectedLog.actor_role})</span>
              </div>
              {selectedLog.tenant_id && (
                <div className="flex justify-between py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-500">Tenant ID:</span>
                  <span className="text-zinc-200 font-mono">{selectedLog.tenant_id}</span>
                </div>
              )}
              {selectedLog.target_id && (
                <div className="flex justify-between py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-500">Alvo (Target ID):</span>
                  <span className="text-zinc-200 font-mono">{selectedLog.target_id}</span>
                </div>
              )}
              {selectedLog.ip_address && (
                <div className="flex justify-between py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-500">IP de Origem:</span>
                  <span className="text-zinc-200 font-mono">{selectedLog.ip_address}</span>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-zinc-400 mb-1">Payload Estruturado:</p>
              <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="text-xs px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
