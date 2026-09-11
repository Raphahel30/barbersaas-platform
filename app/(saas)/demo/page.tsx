'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Sparkles, 
  Smartphone, 
  LayoutDashboard, 
  Scissors, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  ArrowRight, 
  DollarSign, 
  Bell, 
  Check, 
  Star, 
  ShieldCheck, 
  RotateCcw,
  Zap,
  ChevronRight,
  Receipt,
  Flame
} from 'lucide-react';

interface MockAppointment {
  id: string;
  clientName: string;
  clientPhone: string;
  service: string;
  price: number;
  time: string;
  barber: string;
  status: 'confirmed' | 'completed' | 'in_progress';
}

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<'client' | 'barber'>('client');
  const [step, setStep] = useState<number>(1);
  const [selectedService, setSelectedService] = useState<{ id: string; name: string; price: number; time: string } | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<string>('Marcos Silva');
  const [selectedTime, setSelectedTime] = useState<string>('14:30');
  const [clientName, setClientName] = useState('Gabriel Souza');
  const [clientPhone, setClientPhone] = useState('(11) 98765-4321');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationSoundPlayed, setNotificationSoundPlayed] = useState(false);

  // Barber dashboard interactive state
  const [appointments, setAppointments] = useState<MockAppointment[]>([
    {
      id: 'apt-1',
      clientName: 'Roberto Alves',
      clientPhone: '(11) 97123-4567',
      service: 'Corte Degradê Navalhado',
      price: 55,
      time: '13:00',
      barber: 'Marcos Silva',
      status: 'completed',
    },
    {
      id: 'apt-2',
      clientName: 'Lucas Ferreira',
      clientPhone: '(11) 99887-1122',
      service: 'Barba Terapia Completa',
      price: 45,
      time: '13:45',
      barber: 'Marcos Silva',
      status: 'completed',
    },
    {
      id: 'apt-3',
      clientName: 'Daniel Rocha',
      clientPhone: '(11) 98444-2233',
      service: 'Combo Cabelo + Barba',
      price: 90,
      time: '15:15',
      barber: 'Marcos Silva',
      status: 'confirmed',
    },
  ]);

  const services = [
    { id: 's1', name: 'Corte Degradê Navalhado', price: 55, time: '35 min', desc: 'Acabamento milimétrico, lavagem especial e finalização com pomada matte.' },
    { id: 's2', name: 'Barba Terapia com Toalha Quente', price: 45, time: '30 min', desc: 'Esfoliação, hidratação profunda com óleos nobres e navalha descartável.' },
    { id: 's3', name: 'Combo Cabelo + Barba VIP', price: 90, time: '60 min', desc: 'Experiência completa com bebida de cortesia e alinhamento capilar.' },
    { id: 's4', name: 'Camuflagem de Fios Brancos', price: 65, time: '25 min', desc: 'Coloração sutil e natural para disfarce imediato de grisalhos.' },
  ];

  const barbers = [
    { name: 'Marcos Silva', role: 'Master Barber & Fundador', rating: 4.9, avatar: 'MS' },
    { name: 'Arthur Lima', role: 'Especialista em Navalha', rating: 4.8, avatar: 'AL' },
    { name: 'Bruno Castro', role: 'Visagista Capilar', rating: 5.0, avatar: 'BC' },
  ];

  const times = ['10:00', '10:45', '11:30', '14:30', '16:00', '17:15', '18:00'];

  const handleCreateBooking = () => {
    if (!selectedService) return;
    
    const newApt: MockAppointment = {
      id: `apt-${Date.now()}`,
      clientName: clientName || 'Gabriel Souza',
      clientPhone: clientPhone || '(11) 98765-4321',
      service: selectedService.name,
      price: selectedService.price,
      time: selectedTime,
      barber: selectedBarber,
      status: 'confirmed',
    };

    setAppointments(prev => [newApt, ...prev]);
    setBookingSuccess(true);
    setShowNotification(true);
    setNotificationSoundPlayed(true);

    // Auto dismiss toast after 6 seconds
    setTimeout(() => {
      setShowNotification(false);
    }, 6000);
  };

  const handleCheckoutAppointment = (id: string) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'completed' } : a));
  };

  const completedRevenue = appointments
    .filter(a => a.status === 'completed')
    .reduce((acc, curr) => acc + curr.price, 0);

  const pendingRevenue = appointments
    .filter(a => a.status !== 'completed')
    .reduce((acc, curr) => acc + curr.price, 0);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans w-full items-center">
      {/* Top Banner Navigation */}
      <header className="sticky top-0 z-50 bg-neutral-900/90 backdrop-blur border-b border-neutral-800 px-4 py-3 sm:px-6 w-full">
        <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-amber-400 font-bold text-lg hover:text-amber-300 transition">
              <Scissors className="w-5 h-5" />
              <span>BarberSaaS</span>
            </Link>
            <span className="bg-amber-500/10 text-amber-400 text-xs px-2.5 py-1 rounded-full border border-amber-500/20 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Sandbox Interativo
            </span>
          </div>

          {/* View Mode Toggle Buttons */}
          <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800">
            <button
              onClick={() => setActiveTab('client')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'client'
                  ? 'bg-amber-500 text-neutral-950 shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              1. Visão do Cliente (PWA)
            </button>
            <button
              onClick={() => setActiveTab('barber')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition relative ${
                activeTab === 'barber'
                  ? 'bg-amber-500 text-neutral-950 shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              2. Painel do Barbeiro
              {notificationSoundPlayed && appointments.some(a => a.status === 'confirmed') && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/onboarding"
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs sm:text-sm px-4 py-2 rounded-lg shadow-lg shadow-amber-500/10 transition flex items-center gap-1.5"
            >
              Criar Minha Barbearia Grátis
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Floating Push Notification Simulator */}
      {showNotification && (
        <div className="fixed top-20 right-4 z-50 max-w-sm bg-neutral-900 border border-emerald-500/40 rounded-xl p-4 shadow-2xl animate-in slide-in-from-top-4 flex items-start gap-3">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
            <Bell className="w-5 h-5 animate-bounce" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-bold text-white text-sm">🔔 Novo Agendamento Confirmado!</p>
            <p className="text-neutral-400 mt-1">
              <span className="text-amber-400 font-semibold">{clientName}</span> reservou{' '}
              <span className="text-neutral-200">{selectedService?.name}</span> para às{' '}
              <span className="text-emerald-400 font-semibold">{selectedTime}</span>.
            </p>
            <button
              onClick={() => {
                setActiveTab('barber');
                setShowNotification(false);
              }}
              className="mt-2 text-amber-400 font-semibold hover:underline flex items-center gap-1"
            >
              Abrir Painel do Barbeiro <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Sandbox Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Helper Banner */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-sm sm:text-base">
                Você está no Sandbox da &quot;Barbearia Vintage Club&quot;
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Experimente o agendamento em 2 cliques como cliente e veja a notificação cair instantaneamente no caixa do barbeiro.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto">
            <button
              onClick={() => {
                setStep(1);
                setSelectedService(null);
                setBookingSuccess(false);
              }}
              className="flex-1 md:flex-none px-3 py-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 rounded-lg transition flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reiniciar Simulação
            </button>
          </div>
        </div>

        {/* TAB 1: CLIENT VIEW (PWA) */}
        {activeTab === 'client' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Explanation Column */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col gap-4">
                <span className="text-xs uppercase font-bold tracking-wider text-amber-500">
                  Experiência Sem Atrito
                </span>
                <h3 className="text-xl font-bold text-white">
                  Como seu cliente marca horário em segundos
                </h3>
                <ul className="space-y-3 text-xs text-neutral-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Sem download:</strong> Abre direto no navegador pelo link do Instagram ou QR Code da bancada.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Holds inteligentes:</strong> A vaga fica reservada por 15 minutos enquanto o cliente confirma.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Lembrete automático:</strong> O cliente recebe confirmação no WhatsApp com link de remarcação.</span>
                  </li>
                </ul>

                <div className="mt-4 pt-4 border-t border-neutral-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-neutral-400">
                    <span>Taxa de conversão estimada:</span>
                    <span className="text-emerald-400 font-bold text-sm">84.2%</span>
                  </div>
                  <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full w-[84%]" />
                  </div>
                </div>
              </div>

              {/* Conversion card */}
              <div className="bg-gradient-to-br from-amber-500/10 via-neutral-900 to-neutral-900 border border-amber-500/30 rounded-2xl p-6">
                <h4 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                  <Flame className="w-4 h-4" /> Quer essa experiência na sua loja?
                </h4>
                <p className="text-xs text-neutral-300 mt-2">
                  Configure a sua marca, equipe e serviços em menos de 5 minutos.
                </p>
                <Link
                  href="/dashboard/onboarding"
                  className="mt-4 block w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl text-center transition"
                >
                  Começar Teste Real de 7 Dias
                </Link>
              </div>
            </div>

            {/* Right Interactive Mock PWA Frame */}
            <div className="lg:col-span-8 flex justify-center">
              <div className="w-full max-w-md bg-neutral-900 border-4 border-neutral-800 rounded-[2.5rem] shadow-2xl p-4 overflow-hidden relative">
                {/* Smartphone speaker notch */}
                <div className="w-36 h-4 bg-neutral-800 mx-auto rounded-b-xl mb-4" />

                {/* PWA App Content */}
                <div className="flex flex-col gap-4">
                  {/* Shop Header */}
                  <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-serif font-black text-amber-400 text-lg">
                        VC
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base">Vintage Club Barbershop</h4>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                          <span className="flex items-center text-amber-400 font-bold">
                            <Star className="w-3 h-3 fill-amber-400 mr-0.5" /> 4.9
                          </span>
                          <span>•</span>
                          <span>Jardins, São Paulo</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Flow Stages */}
                  {!bookingSuccess ? (
                    <>
                      {/* Step 1: Select Service */}
                      {step === 1 && (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-neutral-400 uppercase">1. Escolha o Serviço</span>
                            <span className="text-[11px] text-amber-400">Toque para selecionar</span>
                          </div>

                          <div className="flex flex-col gap-2.5">
                            {services.map(s => {
                              const isSelected = selectedService?.id === s.id;
                              return (
                                <div
                                  key={s.id}
                                  onClick={() => setSelectedService(s)}
                                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                                    isSelected
                                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-sm'
                                      : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 text-neutral-200'
                                  }`}
                                >
                                  <div>
                                    <div className="font-semibold text-sm flex items-center gap-2">
                                      {s.name}
                                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                                    </div>
                                    <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1">{s.desc}</p>
                                    <span className="text-[10px] text-neutral-500 flex items-center gap-1 mt-1">
                                      <Clock className="w-3 h-3" /> {s.time}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold text-sm text-amber-400">R$ {s.price},00</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <button
                            disabled={!selectedService}
                            onClick={() => setStep(2)}
                            className="mt-3 w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                          >
                            Continuar para Horário
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Step 2: Select Barber and Time */}
                      {step === 2 && (
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-neutral-400 uppercase">2. Barbeiro & Horário</span>
                            <button onClick={() => setStep(1)} className="text-[11px] text-amber-400 hover:underline">
                              Trocar serviço
                            </button>
                          </div>

                          {/* Barbers list */}
                          <div className="grid grid-cols-3 gap-2">
                            {barbers.map(b => (
                              <div
                                key={b.name}
                                onClick={() => setSelectedBarber(b.name)}
                                className={`p-2.5 rounded-xl border text-center cursor-pointer transition flex flex-col items-center gap-1.5 ${
                                  selectedBarber === b.name
                                    ? 'bg-amber-500/20 border-amber-500 text-white'
                                    : 'bg-neutral-950/60 border-neutral-800 text-neutral-400'
                                }`}
                              >
                                <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-xs text-amber-400">
                                  {b.avatar}
                                </div>
                                <span className="text-xs font-semibold leading-tight line-clamp-1">{b.name}</span>
                              </div>
                            ))}
                          </div>

                          {/* Time Slots */}
                          <div>
                            <span className="text-[11px] font-semibold text-neutral-400 block mb-2">Horários Disponíveis Hoje:</span>
                            <div className="grid grid-cols-4 gap-2">
                              {times.map(t => (
                                <button
                                  key={t}
                                  onClick={() => setSelectedTime(t)}
                                  className={`py-2 text-xs font-semibold rounded-lg border transition ${
                                    selectedTime === t
                                      ? 'bg-amber-500 text-neutral-950 border-amber-500 font-bold'
                                      : 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                                  }`}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>

                          <button
                            onClick={() => setStep(3)}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                          >
                            Confirmar Dados
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Step 3: Checkout / Hold */}
                      {step === 3 && (
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-neutral-400 uppercase">3. Seus Dados</span>
                            <button onClick={() => setStep(2)} className="text-[11px] text-amber-400 hover:underline">
                              Voltar
                            </button>
                          </div>

                          {/* Summary pill */}
                          <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-xl text-xs flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-white">{selectedService?.name}</p>
                              <p className="text-neutral-400">{selectedBarber} • Hoje às {selectedTime}</p>
                            </div>
                            <span className="text-amber-400 font-bold text-sm">R$ {selectedService?.price},00</span>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Seu Nome</label>
                              <input
                                type="text"
                                value={clientName}
                                onChange={e => setClientName(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">WhatsApp para Lembretes</label>
                              <input
                                type="text"
                                value={clientPhone}
                                onChange={e => setClientPhone(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>

                          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-[11px] text-amber-300">
                            <ShieldCheck className="w-4 h-4 shrink-0" />
                            <span>Horário pré-bloqueado por 15 min sem cobrança antecipada.</span>
                          </div>

                          <button
                            onClick={handleCreateBooking}
                            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-1.5"
                          >
                            Finalizar Agendamento Grátis
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Booking Success Screen */
                    <div className="py-6 flex flex-col items-center text-center gap-3 animate-in zoom-in-95">
                      <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-bold text-white">Agendamento Realizado!</h4>
                      <p className="text-xs text-neutral-400 max-w-xs">
                        Tudo certo, {clientName}. Seu horário foi registrado para às{' '}
                        <strong className="text-amber-400">{selectedTime}</strong> com{' '}
                        <strong className="text-white">{selectedBarber}</strong>.
                      </p>

                      <div className="w-full mt-3 p-3 bg-neutral-950/80 border border-neutral-800 rounded-xl text-left text-xs space-y-1">
                        <div className="flex justify-between text-neutral-400">
                          <span>WhatsApp:</span>
                          <span className="text-white">{clientPhone}</span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>Status do Hold:</span>
                          <span className="text-emerald-400 font-bold">Confirmado</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setActiveTab('barber')}
                        className="mt-4 w-full py-3 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                      >
                        Ver no Painel do Barbeiro
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BARBER DASHBOARD VIEW */}
        {activeTab === 'barber' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Explanation Column */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col gap-4">
                <span className="text-xs uppercase font-bold tracking-wider text-amber-500">
                  Gestão Operacional Descomplicada
                </span>
                <h3 className="text-xl font-bold text-white">
                  Controle total do caixa e comissões da bancada
                </h3>
                <p className="text-xs text-neutral-300">
                  Quando o cliente marca pelo link, a agenda atualiza em tempo real. Ao finalizar o atendimento, clique em <strong>&quot;Baixar Caixa&quot;</strong> para lançar a receita e acumular selos de fidelidade.
                </p>

                {/* Real-time metrics widget */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                    <span className="text-[11px] text-neutral-500 block">Faturado Hoje</span>
                    <span className="text-lg font-bold text-emerald-400">R$ {completedRevenue},00</span>
                  </div>
                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                    <span className="text-[11px] text-neutral-500 block">A Receber</span>
                    <span className="text-lg font-bold text-amber-400">R$ {pendingRevenue},00</span>
                  </div>
                </div>
              </div>

              {/* Conversion Box */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                <h4 className="font-bold text-white text-sm">Gostou da agilidade do sistema?</h4>
                <p className="text-xs text-neutral-400 mt-2">
                  Tenha seu próprio domínio, link na bio, WhatsApp automático e relatórios financeiros sem taxa de adesão.
                </p>
                <Link
                  href="/dashboard/onboarding"
                  className="mt-4 block w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl text-center transition"
                >
                  Cadastrar Minha Barbearia Agora
                </Link>
              </div>
            </div>

            {/* Right Interactive Dashboard Content */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-amber-400" />
                      Grade do Dia - Marcos Silva
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Exibindo agendamentos e baixas de comandas em tempo real.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Agenda Online Ativa
                    </span>
                  </div>
                </div>

                {/* Appointments Table / List */}
                <div className="mt-4 space-y-3">
                  {appointments.map(apt => {
                    const isCompleted = apt.status === 'completed';
                    return (
                      <div
                        key={apt.id}
                        className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isCompleted
                            ? 'bg-neutral-950/40 border-neutral-800/60 opacity-70'
                            : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="p-2.5 bg-neutral-800 rounded-xl text-center min-w-[50px]">
                            <span className="text-xs font-bold text-white block">{apt.time}</span>
                            <span className="text-[10px] text-neutral-400 uppercase">Hoje</span>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-white text-sm">{apt.clientName}</h4>
                              <span className="text-[11px] text-neutral-500">{apt.clientPhone}</span>
                            </div>
                            <p className="text-xs text-neutral-400 mt-0.5">
                              {apt.service} • <span className="text-amber-400 font-semibold">R$ {apt.price},00</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg font-medium border border-emerald-500/20">
                              <CheckCircle2 className="w-4 h-4" /> Caixa Fechado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleCheckoutAppointment(apt.id)}
                              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs rounded-lg transition shadow-md flex items-center gap-1.5"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              Baixar Caixa (R$ {apt.price})
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 p-4 bg-neutral-950/60 border border-neutral-800/80 rounded-xl flex items-center justify-between text-xs">
                  <div className="text-neutral-400">
                    Comissão estimada do barbeiro (50%):{' '}
                    <strong className="text-white">R$ {(completedRevenue * 0.5).toFixed(2)}</strong>
                  </div>
                  <button
                    onClick={() => setActiveTab('client')}
                    className="text-amber-400 hover:underline font-semibold flex items-center gap-1"
                  >
                    Simular outro agendamento como cliente <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Call to Action */}
      <footer className="border-t border-neutral-800 bg-neutral-900/50 py-8 px-4 mt-12 w-full">
        <div className="max-w-4xl mx-auto w-full text-center flex flex-col items-center gap-4">
          <h3 className="text-xl sm:text-2xl font-bold text-white">
            Pronto para acabar com os buracos na agenda da sua barbearia?
          </h3>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-xl">
            Crie sua conta agora mesmo. Seus clientes vão adorar agendar com facilidade e você terá controle financeiro total na palma da mão.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
            <Link
              href="/dashboard/onboarding"
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-sm rounded-xl shadow-xl transition"
            >
              Começar Agora Gratuitamente
            </Link>
            <Link
              href="/"
              className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-sm rounded-xl transition"
            >
              Voltar para a Página Inicial
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
