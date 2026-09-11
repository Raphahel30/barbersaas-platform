import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import { defaultVisualSettings, type TenantVisualSettings } from '@/lib/whitelabel/settings'
import { getGalleryPhotos } from '@/app/actions/gallery'
import { GalleryGrid } from '@/components/gallery/GalleryGrid'

export default async function TenantHomePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const admin = createAdminClient()

  // Carrega barbearia
  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, slug, address, visual_settings, organization_id, organizations(name, is_multi_branch)')
    .eq('slug', tenantSlug)
    .maybeSingle()

  if (!tenant) redirect('/tenant-not-found')

  const visual: TenantVisualSettings = {
    ...defaultVisualSettings,
    ...((tenant.visual_settings && typeof tenant.visual_settings === 'object')
      ? (tenant.visual_settings as Partial<TenantVisualSettings>)
      : {}),
  }

  // Carrega serviços ativos, fotos públicas e filiais
  const [servicesResult, photos, branchesResult] = await Promise.all([
    admin
      .from('services')
      .select('id, name, description, duration_minutes, price, reservation_fee')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('price', { ascending: true }),
    getGalleryPhotos(tenant.id, true),
    admin
      .from('tenants')
      .select('id, name, slug')
      .eq('organization_id', tenant.organization_id)
      .in('status', ['trial', 'active']),
  ])

  const services = servicesResult.data ?? []
  const branches = branchesResult.data ?? []
  const hasMultipleBranches = Boolean((tenant.organizations as { is_multi_branch?: boolean } | null)?.is_multi_branch) && branches.length > 1

  return (
    <div className="min-h-screen flex flex-col justify-between max-w-lg mx-auto bg-zinc-950/80 border-x border-zinc-900 shadow-2xl relative">
      {/* Seletor de Filial (se multi-branch) */}
      {hasMultipleBranches && (
        <div className="bg-zinc-900/90 px-4 py-2 text-xs flex items-center justify-between border-b border-zinc-800">
          <span className="text-zinc-400">Unidade atual:</span>
          <div className="flex items-center gap-1.5 font-bold text-amber-500">
            <span>📍 {tenant.name}</span>
            <select
              className="bg-transparent text-xs text-zinc-300 font-normal outline-none cursor-pointer"
              onChange={(e) => {
                if (e.target.value) window.location.href = `/${e.target.value}`
              }}
              defaultValue=""
            >
              <option value="" disabled>Trocar filial...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.slug} className="bg-zinc-900 text-white">
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Header Banner com Logo */}
      <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={visual.bannerUrl}
          alt={tenant.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />

        {/* Logo / Badge sobreposto */}
        <div className="absolute -bottom-2 left-6 flex items-end gap-3 z-10">
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center font-extrabold text-2xl shadow-2xl overflow-hidden border-2 border-zinc-800"
            style={{
              background: `linear-gradient(135deg, ${visual.primaryColor} 0%, ${visual.secondaryColor} 100%)`,
              color: '#000',
            }}
          >
            {visual.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={visual.logoUrl} alt={tenant.name} className="w-full h-full object-cover" />
            ) : (
              tenant.name.charAt(0).toUpperCase()
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <main className="px-5 pt-5 pb-24 space-y-6">
        {/* Identificação e Endereço */}
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{tenant.name}</h1>
          <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">
            <span>📍</span> {visual.addressText || 'Endereço não informado'}
          </p>
          <p className="text-xs text-amber-500/90 font-medium mt-0.5">
            🕒 {visual.openingHoursText || 'Seg a Sáb: 09h às 20h'}
          </p>
        </div>

        {/* 2 BOTÕES DE ENTRADA DESTACADOS */}
        <div className="grid grid-cols-1 gap-3 pt-1">
          <Link
            href={`/${tenantSlug}/agendar`}
            className="w-full py-4 px-5 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 shadow-lg hover:opacity-95 transition-all text-center"
            style={{
              background: `linear-gradient(135deg, ${visual.primaryColor} 0%, ${visual.secondaryColor} 100%)`,
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Agendar Horário (Rápido / Sem Cadastro)
          </Link>

          <Link
            href={`/${tenantSlug}/cliente`}
            className="w-full py-3.5 px-5 rounded-xl font-semibold text-xs sm:text-sm text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center gap-2 transition-all text-center"
          >
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Área do Cliente (Selos de Fidelidade & VIP)
          </Link>
        </div>

        {/* Vitrine de Serviços */}
        <div className="space-y-3 pt-2">
          <h2 className="text-base font-bold text-zinc-100 flex items-center justify-between">
            <span>Serviços Disponíveis</span>
            <span className="text-xs text-zinc-500 font-normal">{services.length} itens</span>
          </h2>

          <div className="space-y-2.5">
            {services.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">Nenhum serviço cadastrado no momento.</p>
            ) : (
              services.map((s) => (
                <div
                  key={s.id}
                  className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                >
                  <div>
                    <h3 className="text-sm font-bold text-zinc-200">{s.name}</h3>
                    {s.description && (
                      <p className="text-xs text-zinc-400 line-clamp-1 font-light">{s.description}</p>
                    )}
                    <span className="text-[11px] text-zinc-500 font-medium">⏱ {s.duration_minutes} min</span>
                  </div>

                  <div className="text-right whitespace-nowrap">
                    <p className="text-sm font-extrabold text-amber-400 font-outfit">
                      R$ {Number(s.price).toFixed(2).replace('.', ',')}
                    </p>
                    {Number(s.reservation_fee) > 0 && (
                      <p className="text-[10px] text-zinc-500">
                        Sinal: R$ {Number(s.reservation_fee).toFixed(2).replace('.', ',')}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Galeria de Cortes Pública */}
        {photos.length > 0 && (
          <div className="pt-2">
            <GalleryGrid photos={photos} title="Nossos Cortes Recentes" />
          </div>
        )}
      </main>

      {/* Botão Flutuante de WhatsApp (wa.me) */}
      {visual.whatsapp && (
        <aside aria-label="Contato rápido" className="fixed bottom-6 right-6 z-40">
          <a
            href={`https://wa.me/55${visual.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Gostaria de tirar uma dúvida sobre a ${tenant.name}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 flex items-center justify-center text-2xl transition-transform hover:scale-110"
            aria-label="Falar no WhatsApp"
          >
            💬
          </a>
        </aside>
      )}
    </div>
  )
}
