'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  CalendarDays,
  Shuffle,
  Coffee,
  HeartPulse,
  Palmtree,
  Check,
  X,
} from 'lucide-react'
import {
  listBarbersForScheduleAction,
  listBarberTimeOffAction,
  createBarberTimeOffAction,
  deleteBarberTimeOffAction,
  reassignAppointmentAction,
  cancelAffectedAppointmentAction,
  generateWeekendRotationAction,
  type BarberTimeOffItem,
  type AffectedAppointmentItem,
  type TimeOffReason,
} from '@/app/actions/schedules'

export default function BarberSchedulesPage() {
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Dados
  const [barbers, setBarbers] = useState<Array<{ id: string; name: string; avatarUrl: string | null }>>([])
  const [timeOffList, setTimeOffList] = useState<BarberTimeOffItem[]>([])

  // Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modal de Nova Folga/Afastamento
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [selectedBarberId, setSelectedBarberId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().substring(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().substring(0, 10))
  const [reason, setReason] = useState<TimeOffReason>('folga_semanal')
  const [notes, setNotes] = useState('')

  // Modal de Alerta Inteligente de Remanejamento
  const [affectedModalOpen, setAffectedModalOpen] = useState(false)
  const [affectedAppointments, setAffectedAppointments] = useState<AffectedAppointmentItem[]>([])
  const [reassignTargetBarberId, setReassignTargetBarberId] = useState('')

  // Modal de Revezamento de Fins de Semana
  const [rotationModalOpen, setRotationModalOpen] = useState(false)
  const [rotationBarberIds, setRotationBarberIds] = useState<string[]>([])
  const [rotationStartDate, setRotationStartDate] = useState(new Date().toISOString().substring(0, 10))
  const [rotationWeeks, setRotationWeeks] = useState(4)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const [barbersRes, timeOffRes] = await Promise.all([
        listBarbersForScheduleAction(),
        listBarberTimeOffAction(),
      ])

      if (barbersRes.success && barbersRes.data) {
        setBarbers(barbersRes.data)
        if (barbersRes.data.length > 0 && !selectedBarberId) {
          setSelectedBarberId(barbersRes.data[0].id)
        }
        setRotationBarberIds(barbersRes.data.map((b) => b.id))
      }
      if (timeOffRes.success && timeOffRes.data) {
        setTimeOffList(timeOffRes.data)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar escalas')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTimeOff = () => {
    if (!selectedBarberId) {
      setErrorMsg('Selecione o profissional.')
      return
    }
    if (!startDate || !endDate) {
      setErrorMsg('Informe as datas de início e fim.')
      return
    }

    setErrorMsg(null)
    setSuccessMsg(null)

    startTransition(async () => {
      const res = await createBarberTimeOffAction({
        barberId: selectedBarberId,
        startDate,
        endDate,
        reason,
        notes,
      })

      if (res.success && res.data) {
        setIsNewModalOpen(false)
        await loadData()

        if (res.data.affectedAppointments && res.data.affectedAppointments.length > 0) {
          setAffectedAppointments(res.data.affectedAppointments)
          setAffectedModalOpen(true)
          setSuccessMsg(
            `Folga registrada! ATENÇÃO: Há ${res.data.affectedAppointments.length} agendamento(s) marcado(s) neste período.`
          )
        } else {
          setSuccessMsg('Folga / afastamento registrado e grade bloqueada com sucesso!')
        }
      } else {
        setErrorMsg(res.error || 'Erro ao registrar folga')
      }
    })
  }

  const handleDeleteTimeOff = async (id: string) => {
    if (!confirm('Deseja realmente remover esta folga e liberar os horários na grade pública?')) return
    const res = await deleteBarberTimeOffAction(id)
    if (res.success) {
      setTimeOffList((prev) => prev.filter((t) => t.id !== id))
      setSuccessMsg('Folga removida. Horários liberados na grade de agendamentos!')
    } else {
      setErrorMsg(res.error || 'Erro ao excluir folga')
    }
  }

  const handleReassign = async (appointmentId: string) => {
    if (!reassignTargetBarberId) {
      alert('Selecione o barbeiro substituto para remanejar.')
      return
    }

    const res = await reassignAppointmentAction(appointmentId, reassignTargetBarberId)
    if (res.success) {
      setAffectedAppointments((prev) => prev.filter((a) => a.id !== appointmentId))
      setSuccessMsg('Agendamento remanejado com sucesso!')
    } else {
      setErrorMsg(res.error || 'Erro ao remanejar')
    }
  }

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!confirm('Deseja cancelar o agendamento do cliente e notificar?')) return
    const res = await cancelAffectedAppointmentAction(appointmentId)
    if (res.success) {
      setAffectedAppointments((prev) => prev.filter((a) => a.id !== appointmentId))
      setSuccessMsg('Agendamento cancelado com sucesso.')
    } else {
      setErrorMsg(res.error || 'Erro ao cancelar')
    }
  }

  const handleGenerateRotation = async () => {
    if (rotationBarberIds.length < 2) {
      setErrorMsg('Selecione pelo menos 2 barbeiros para criar o revezamento.')
      return
    }

    startTransition(async () => {
      const res = await generateWeekendRotationAction({
        barberIds: rotationBarberIds,
        startDate: rotationStartDate,
        weeksCount: rotationWeeks,
      })

      if (res.success && res.data) {
        setRotationModalOpen(false)
        setSuccessMsg(`Revezamento criado com sucesso! ${res.data.generatedCount} sábados programados.`)
        await loadData()
      } else {
        setErrorMsg(res.error || 'Falha ao gerar escala rotativa')
      }
    })
  }

  const getReasonBadge = (r: TimeOffReason) => {
    switch (r) {
      case 'folga_semanal':
        return {
          icon: <Coffee className="w-3.5 h-3.5" />,
          label: 'Folga Semanal',
          style: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        }
      case 'ferias':
        return {
          icon: <Palmtree className="w-3.5 h-3.5" />,
          label: 'Férias',
          style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        }
      case 'atestado':
        return {
          icon: <HeartPulse className="w-3.5 h-3.5" />,
          label: 'Atestado Médico',
          style: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        }
      default:
        return {
          icon: <Clock className="w-3.5 h-3.5" />,
          label: 'Outros',
          style: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        }
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                Escalas da Equipe, Folgas & Atestados
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  Bloqueio Automático da Grade
                </span>
              </h1>
              <p className="text-zinc-400 text-sm mt-0.5">
                Organize turnos, automatize o revezamento de sábados e remaneje clientes afetados por imprevistos.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setRotationModalOpen(true)}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl text-sm font-semibold text-zinc-200 flex items-center gap-2 transition-all shadow-sm"
            >
              <Shuffle className="w-4 h-4 text-amber-400" />
              Revezamento de Sábados
            </button>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-sm flex items-center gap-2 transition-all shadow-lg shadow-amber-500/10"
            >
              <Plus className="w-4 h-4" />
              Lançar Folga / Atestado
            </button>
          </div>
        </div>

        {/* FEEDBACK */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{successMsg}</span>
          </div>
        )}

        {/* Lista de Barbeiros e Folgas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Card dos Membros da Equipe */}
          <div className="lg:col-span-4 bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              Profissionais Cadastrados ({barbers.length})
            </h3>

            <div className="space-y-2">
              {barbers.map((b) => {
                const countOff = timeOffList.filter((t) => t.barberId === b.id).length
                return (
                  <div
                    key={b.id}
                    className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-white text-sm">
                        {b.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-semibold text-sm text-white block">{b.name}</span>
                        <span className="text-xs text-zinc-400">Ativo na grade</span>
                      </div>
                    </div>

                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800">
                      {countOff} folga(s)
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Card de Folgas Cadastradas e Histórico */}
          <div className="lg:col-span-8 bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-amber-400" />
                Folgas, Férias e Afastamentos Programados
              </h3>
              <button
                onClick={loadData}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizar
              </button>
            </div>

            {timeOffList.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                Nenhuma folga ou afastamento registrado. Toda a equipe está 100% ativa na grade de agendamento.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                {timeOffList.map((item) => {
                  const badge = getReasonBadge(item.reason)
                  const isSingleDay = item.startDate === item.endDate
                  return (
                    <div
                      key={item.id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{item.barberName}</span>
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${badge.style}`}
                          >
                            {badge.icon}
                            {badge.label}
                          </span>
                        </div>

                        <div className="text-xs text-zinc-400 flex items-center gap-3">
                          <span>
                            Período:{' '}
                            <strong className="text-zinc-200">
                              {isSingleDay
                                ? new Date(item.startDate + 'T00:00:00').toLocaleDateString('pt-BR')
                                : `${new Date(item.startDate + 'T00:00:00').toLocaleDateString('pt-BR')} até ${new Date(
                                    item.endDate + 'T00:00:00'
                                  ).toLocaleDateString('pt-BR')}`}
                            </strong>
                          </span>
                          {item.notes && <span className="italic text-zinc-500">({item.notes})</span>}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteTimeOff(item.id)}
                        className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all self-end sm:self-center"
                        title="Excluir folga e reabrir horários"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* MODAL 1: LANÇAR NOVA FOLGA */}
        {isNewModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-amber-400" />
                  Lançar Folga ou Afastamento
                </h3>
                <button
                  onClick={() => setIsNewModalOpen(false)}
                  className="p-1 text-zinc-400 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Barbeiro</label>
                  <select
                    value={selectedBarberId}
                    onChange={(e) => setSelectedBarberId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    {barbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">Data Início</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value)
                        if (e.target.value > endDate) setEndDate(e.target.value)
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">Data Fim</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Tipo de Afastamento</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as TimeOffReason)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="folga_semanal">Folga Semanal / Revezamento</option>
                    <option value="ferias">Férias</option>
                    <option value="atestado">Atestado Médico / Licença</option>
                    <option value="outros">Outros Motivos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Observações (Opcional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: Atestado entregue / Folga combinada"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleCreateTimeOff}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-xs font-bold transition-all"
                >
                  {isPending ? 'Salvando...' : 'Confirmar e Bloquear Grade'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: ALERTA INTELIGENTE DE REMANEJAMENTO DE CLIENTES AFETADOS */}
        {affectedModalOpen && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-amber-500/40 rounded-2xl p-6 max-w-2xl w-full space-y-5 shadow-2xl">
              <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
                <div className="p-3 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Alerta Inteligente de Remanejamento</h3>
                  <p className="text-xs text-zinc-400">
                    Existem <strong>{affectedAppointments.length} clientes agendados</strong> durante o período desta folga.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-zinc-400">
                  Selecione o barbeiro substituto para remanejar com 1 clique:
                </div>
                <select
                  value={reassignTargetBarberId}
                  onChange={(e) => setReassignTargetBarberId(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white"
                >
                  <option value="">Selecione Barbeiro Substituto</option>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lista dos Clientes */}
              <div className="max-h-60 overflow-y-auto divide-y divide-zinc-800 border border-zinc-800 rounded-xl">
                {affectedAppointments.map((appt) => (
                  <div key={appt.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold text-white block">{appt.clientName}</span>
                      <span className="text-zinc-400 font-mono">
                        {new Date(appt.appointmentDate + 'T00:00:00').toLocaleDateString('pt-BR')} às {appt.startTime} ({appt.serviceName})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReassign(appt.id)}
                        disabled={!reassignTargetBarberId}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold rounded-lg flex items-center gap-1 transition-all"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Remanejar
                      </button>
                      <button
                        onClick={() => handleCancelAppointment(appt.id)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg flex items-center gap-1 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancelar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setAffectedModalOpen(false)}
                  className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl text-xs"
                >
                  Concluir / Fechar Alerta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: GERADOR DE REVEZAMENTO DE FINS DE SEMANA */}
        {rotationModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Shuffle className="w-5 h-5 text-amber-400" />
                  Revezamento de Sábados Automático
                </h3>
                <button
                  onClick={() => setRotationModalOpen(false)}
                  className="p-1 text-zinc-400 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-zinc-400">
                O sistema intercala as folgas de sábado automaticamente entre os barbeiros selecionados.
              </p>

              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">A partir de qual data?</label>
                  <input
                    type="date"
                    value={rotationStartDate}
                    onChange={(e) => setRotationStartDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Número de Semanas</label>
                  <select
                    value={rotationWeeks}
                    onChange={(e) => setRotationWeeks(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 text-xs"
                  >
                    <option value={4}>4 semanas (1 mês)</option>
                    <option value={8}>8 semanas (2 meses)</option>
                    <option value={12}>12 semanas (3 meses)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRotationModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleGenerateRotation}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-xs font-bold transition-all"
                >
                  {isPending ? 'Gerando...' : 'Gerar Escala de Sábados'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
