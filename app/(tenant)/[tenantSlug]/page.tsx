import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import { getGalleryPhotos } from '@/app/actions/gallery'
import { getSiteConfig } from '@/app/actions/site-builder'
import { DEFAULT_SITE_CONFIG, type TenantSiteConfigData } from '@/lib/builder/defaults'
import {
  Scissors,
  MapPin,
  Clock,
  Star,
  Users,
  Image as ImageIcon,
  CheckCircle2,
  ExternalLink,
  Phone,
  MessageCircle,
  Building2,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Award,
} from 'lucide-react'

// Texture Style Helper
function getTextureStyles(textureId?: string, bgColor: string = '#09090b') {
  switch (textureId) {
    case 'carbon':
      return {
        backgroundColor: bgColor,
        backgroundImage: 'radial-gradient(#27272a 1px, transparent 1px)',
        backgroundSize: '16px 16px',
      }
    case 'dark_wood':
      return {
        backgroundColor: '#120d09',
        backgroundImage: 'linear-gradient(to bottom, #17100b 0%, #0d0906 100%)',
      }
    case 'dark_brick':
      return {
        backgroundColor: '#141010',
        backgroundImage: 'radial-gradient(#261717 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }
    case 'noise_grain':
      return {
        backgroundColor: bgColor,
        backgroundImage: 'radial-gradient(#3f3f46 0.75px, transparent 0.75px)',
        backgroundSize: '8px 8px',
      }
    case 'clean_dark':
    default:
      return {
        backgroundColor: bgColor,
      }
  }
}

// Typography Class Helper
function getTypographyClass(fontId?: string) {
  switch (fontId) {
    case 'font-serif':
      return 'font-serif'
    case 'font-cinzel':
      return 'font-serif tracking-wide'
    case 'font-bebas':
      return 'font-sans font-black tracking-wide'
    case 'font-sans':
    default:
      return 'font-sans'
  }
}

export default async function TenantCustomerStorefrontPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const admin = createAdminClient()

  // 1. Carregamento Server-Side Resiliente da Barbearia
  const { data: tenant } = await admin
    .from('tenants')
    .select(
      'id, name, slug, address_street, address_number, address_neighborhood, address_city, address_state, address_cep, gateway_credentials, organization_id, organizations(name, is_multi_branch)'
    )
    .eq('slug', tenantSlug)
    .maybeSingle()

  if (!tenant) {
    redirect('/tenant-not-found')
  }

  // 2. Busca configuração de estilo e dados do construtor com fallback
  const { config = { ...DEFAULT_SITE_CONFIG, tenant_id: tenant.id } } = await getSiteConfig(
    tenant.id
  )

  // 3. Carrega serviços ativos, equipe e fotos públicas em paralelo
  const [servicesResult, photosResult, barbersResult, branchesResult] = await Promise.all([
    admin
      .from('services')
      .select('id, name, description, duration_minutes, price, reservation_fee')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('price', { ascending: true }),
    getGalleryPhotos(tenant.id, true),
    admin
      .from('profiles')
      .select('id, full_name, avatar_url, seniority_tier, role')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .in('role', ['barber', 'owner']),
    admin
      .from('tenants')
      .select('id, name, slug')
      .eq('organization_id', tenant.organization_id)
      .in('status', ['trial', 'active']),
  ])

  const services = servicesResult.data ?? []
  const uploadedPhotos = photosResult ?? []
  const barbers = barbersResult.data ?? []
  const branches = branchesResult.data ?? []
  const hasMultipleBranches =
    Boolean((tenant.organizations as { is_multi_branch?: boolean } | null)?.is_multi_branch) &&
    branches.length > 1

  // Configurações de cores e texturas
  const primaryColor = config.primary_color || '#D97706'
  const backgroundColor = config.background_color || '#09090b'
  const cardColor = config.card_color || '#18181b'
  const fontClass = getTypographyClass(config.font_family)
  const textureStyle = getTextureStyles(config.bg_texture, backgroundColor)

  // Montagem do Endereço Completo
  const addressParts = [
    tenant.address_street
      ? `${tenant.address_street}${tenant.address_number ? `, ${tenant.address_number}` : ''}`
      : '',
    tenant.address_neighborhood,
    tenant.address_city && tenant.address_state
      ? `${tenant.address_city} - ${tenant.address_state}`
      : tenant.address_city,
    tenant.address_cep ? `CEP: ${tenant.address_cep}` : '',
  ].filter(Boolean)

  const fullAddress = addressParts.join(', ')
  const googleMapsUrl = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${tenant.name}, ${fullAddress}`
      )}`
    : null

  // Combina fotos da galeria salvas na config com fotos enviadas
  const allGalleryPhotos = [
    ...(config.gallery_photos || []),
    ...uploadedPhotos.map((p) => p.storage_path),
  ].filter((v, i, a) => a.indexOf(v) === i)

  // Resgate de WhatsApp
  const gatewayCreds = (tenant.gateway_credentials as Record<string, unknown>) || {}
  const whatsappNumber =
    typeof gatewayCreds.whatsapp === 'string'
      ? gatewayCreds.whatsapp
      : typeof gatewayCreds.phone === 'string'
      ? gatewayCreds.phone
      : ''

  const sections = config.sections_visibility || DEFAULT_SITE_CONFIG.sections_visibility

  return (
    <div
      className={`min-h-screen text-zinc-100 flex flex-col justify-between max-w-lg mx-auto border-x border-zinc-900 shadow-2xl relative overflow-x-hidden selection:bg-amber-500 selection:text-zinc-950 ${fontClass}`}
      style={textureStyle}
    >
      {/* SELETOR DE FILIAIS (SE ORGANIZAÇÃO MULTI-BRANCH) */}
      {hasMultipleBranches && (
        <aside
          aria-label="Filiais"
          className="bg-zinc-900/90 backdrop-blur px-4 py-2.5 text-xs flex items-center justify-between border-b border-zinc-800 sticky top-0 z-50"
        >
          <span className="text-zinc-400 font-medium">Unidade Selecionada:</span>
          <div className="flex items-center gap-1.5 font-bold" style={{ color: primaryColor }}>
            <MapPin className="w-3.5 h-3.5" />
            <span>{tenant.name}</span>
            <select
              aria-label="Trocar filial"
              className="bg-transparent text-xs text-zinc-300 font-normal outline-none cursor-pointer ml-1"
              onChange={(e) => {
                if (e.target.value) window.location.href = `/${e.target.value}`
              }}
              defaultValue=""
            >
              <option value="" disabled className="bg-zinc-900">
                Trocar unidade...
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.slug} className="bg-zinc-900 text-white">
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </aside>
      )}

      {/* 1. SEÇÃO HERO / BANNER */}
      {sections.hero !== false && (
        <header className="relative h-52 sm:h-60 w-full overflow-hidden bg-zinc-900">
          {/* Imagem de Capa */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={config.banner_url || DEFAULT_SITE_CONFIG.banner_url!}
            alt={`Capa da ${tenant.name}`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />

          {/* Logo / Monograma sobreposto */}
          <div className="absolute -bottom-2 left-6 flex items-end gap-3 z-10">
            <div
              className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center font-black text-2xl shadow-2xl overflow-hidden border-2 border-zinc-800 bg-zinc-900 text-white"
              style={{
                boxShadow: `0 10px 25px -5px ${primaryColor}33`,
              }}
            >
              {config.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={config.logo_url}
                  alt={tenant.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span style={{ color: primaryColor }}>
                  {tenant.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </header>
      )}

      {/* CONTEÚDO PRINCIPAL DA BARBEARIA */}
      <main className="px-5 pt-5 pb-24 space-y-6">
        {/* IDENTIFICAÇÃO PRINCIPAL & HEADLINE */}
        <section aria-labelledby="barbershop-heading" className="space-y-1.5">
          <h1 id="barbershop-heading" className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {tenant.name}
          </h1>

          <p className="text-xs sm:text-sm font-bold" style={{ color: primaryColor }}>
            {config.headline_title || DEFAULT_SITE_CONFIG.headline_title}
          </p>

          <p className="text-xs text-zinc-400 leading-relaxed">
            {config.headline_subtitle || DEFAULT_SITE_CONFIG.headline_subtitle}
          </p>

          {fullAddress && (
            <p className="text-xs text-zinc-400 pt-1 flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: primaryColor }} />
              <span>{fullAddress}</span>
            </p>
          )}
        </section>

        {/* 2 BOTÕES DE AÇÃO DESTACADOS */}
        <section aria-label="Ações de agendamento" className="grid grid-cols-1 gap-3 pt-1">
          <Link
            href={`/${tenantSlug}/agendar`}
            className="w-full py-4 px-5 rounded-2xl font-black text-sm text-zinc-950 flex items-center justify-center gap-2 shadow-xl hover:brightness-110 active:scale-[0.99] transition-all text-center"
            style={{
              backgroundColor: primaryColor,
              boxShadow: `0 10px 20px -5px ${primaryColor}40`,
            }}
          >
            <Scissors className="w-5 h-5" />
            <span>Agendar Horário (Rápido / Sem Cadastro)</span>
          </Link>

          <Link
            href={`/${tenantSlug}/cliente`}
            className="w-full py-3.5 px-5 rounded-2xl font-semibold text-xs sm:text-sm text-zinc-200 border border-zinc-800 hover:border-zinc-700 flex items-center justify-center gap-2 transition-all text-center"
            style={{ backgroundColor: cardColor }}
          >
            <Star className="w-4 h-4" style={{ color: primaryColor }} />
            <span>Área do Cliente (Selos de Fidelidade & VIP)</span>
          </Link>
        </section>

        {/* 2. COMODIDADES & DIFERENCIAIS */}
        {sections.amenities !== false && config.amenities && config.amenities.length > 0 && (
          <section
            aria-labelledby="amenities-heading"
            className="p-4 rounded-2xl border border-zinc-800/80 shadow-md space-y-2.5"
            style={{ backgroundColor: cardColor }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" style={{ color: primaryColor }} />
              <h2 id="amenities-heading" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Diferenciais da Casa
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {config.amenities.map((item, idx) => (
                <span
                  key={idx}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border border-zinc-700/60 bg-zinc-900/60 text-zinc-300 flex items-center gap-1.5 shadow-sm"
                >
                  <span style={{ color: primaryColor }}>★</span> {item}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* 3. VITRINE DE SERVIÇOS & PROCEDIMENTOS */}
        {sections.services !== false && (
          <section aria-labelledby="services-heading" className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4" style={{ color: primaryColor }} />
                <h2 id="services-heading" className="text-base font-bold text-zinc-100">
                  Serviços & Procedimentos
                </h2>
              </div>
              <span className="text-xs text-zinc-500 font-medium">{services.length} disponíveis</span>
            </div>

            <div className="space-y-2.5">
              {services.length === 0 ? (
                <div
                  style={{ backgroundColor: cardColor }}
                  className="p-6 rounded-2xl border border-zinc-800/80 text-center text-xs text-zinc-500"
                >
                  Nenhum serviço cadastrado no momento.
                </div>
              ) : (
                services.map((s) => (
                  <div
                    key={s.id}
                    style={{ backgroundColor: cardColor }}
                    className="p-4 rounded-2xl border border-zinc-800/80 flex items-center justify-between gap-3 hover:border-zinc-700 transition-all shadow-md group"
                  >
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-zinc-100 group-hover:text-white transition-colors">
                        {s.name}
                      </h3>
                      {s.description && (
                        <p className="text-xs text-zinc-400 line-clamp-2 font-light">{s.description}</p>
                      )}
                      <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        {s.duration_minutes} min
                      </span>
                    </div>

                    <div className="text-right whitespace-nowrap shrink-0">
                      <p className="text-sm sm:text-base font-black font-mono" style={{ color: primaryColor }}>
                        R$ {Number(s.price).toFixed(2).replace('.', ',')}
                      </p>
                      {Number(s.reservation_fee) > 0 && (
                        <p className="text-[10px] text-zinc-500">
                          Sinal: R$ {Number(s.reservation_fee).toFixed(2).replace('.', ',')}
                        </p>
                      )}
                      <Link
                        href={`/${tenantSlug}/agendar`}
                        className="inline-block mt-1.5 px-3 py-1 rounded-lg text-xs font-bold text-zinc-950 transition-transform hover:scale-105 shadow-sm"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Agendar
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* 4. EQUIPE DE BARBEIROS */}
        {sections.barbers !== false && barbers.length > 0 && (
          <section aria-labelledby="team-heading" className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: primaryColor }} />
              <h2 id="team-heading" className="text-base font-bold text-zinc-100">
                Equipe de Especialistas
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {barbers.map((b) => (
                <div
                  key={b.id}
                  style={{ backgroundColor: cardColor }}
                  className="p-3.5 rounded-2xl border border-zinc-800/80 flex items-center gap-3 shadow-md"
                >
                  <div className="w-11 h-11 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700 shrink-0">
                    {b.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.avatar_url}
                        alt={b.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-black text-xs text-zinc-300">
                        {b.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-200 truncate">{b.full_name}</p>
                    <span className="text-[10px] text-zinc-400 capitalize block">
                      {b.seniority_tier || (b.role === 'owner' ? 'Proprietário' : 'Barbeiro')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5. GALERIA DE FOTOS DO ESPAÇO & CORTES */}
        {sections.gallery !== false && allGalleryPhotos.length > 0 && (
          <section aria-labelledby="gallery-heading" className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" style={{ color: primaryColor }} />
                <h2 id="gallery-heading" className="text-base font-bold text-zinc-100">
                  Nossos Trabalhos & Espaço
                </h2>
              </div>
              <span className="text-xs text-zinc-500 font-medium">
                {allGalleryPhotos.length} fotos
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {allGalleryPhotos.slice(0, 8).map((photo, idx) => (
                <div
                  key={idx}
                  className="h-28 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-md group relative"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt={`Corte ${idx + 1}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 6. SOBRE A BARBEARIA */}
        {sections.about !== false && config.about_text && (
          <section aria-labelledby="about-heading" className="space-y-2 pt-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" style={{ color: primaryColor }} />
              <h2 id="about-heading" className="text-base font-bold text-zinc-100">
                Sobre a Barbearia
              </h2>
            </div>
            <div
              style={{ backgroundColor: cardColor }}
              className="p-5 rounded-2xl border border-zinc-800/80 text-xs sm:text-sm text-zinc-300 leading-relaxed shadow-md"
            >
              {config.about_text}
            </div>
          </section>
        )}

        {/* 7. ENDEREÇO & LOCALIZAÇÃO */}
        {sections.location !== false && fullAddress && (
          <section
            aria-labelledby="location-heading"
            style={{ backgroundColor: cardColor }}
            className="p-5 rounded-2xl border border-zinc-800/80 space-y-3 shadow-md"
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" style={{ color: primaryColor }} />
              <h2 id="location-heading" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Localização & Como Chegar
              </h2>
            </div>

            <p className="text-xs sm:text-sm text-zinc-200 font-medium">{fullAddress}</p>

            {googleMapsUrl && (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 pt-1"
              >
                <span>Abrir rota no Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </section>
        )}
      </main>

      {/* BOTÃO FLUTUANTE DE WHATSAPP */}
      {whatsappNumber && (
        <aside aria-label="Atendimento rápido" className="fixed bottom-6 right-6 z-40">
          <a
            href={`https://wa.me/55${whatsappNumber.replace(
              /\D/g,
              ''
            )}?text=${encodeURIComponent(
              `Olá! Gostaria de tirar uma dúvida sobre a ${tenant.name}.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-2xl shadow-emerald-500/30 flex items-center justify-center text-2xl transition-transform hover:scale-110"
            aria-label="Falar no WhatsApp"
          >
            💬
          </a>
        </aside>
      )}

      {/* RODAPÉ */}
      <footer className="border-t border-zinc-900 py-6 text-center text-[11px] text-zinc-500">
        © {new Date().getFullYear()} {tenant.name}. Todos os direitos reservados.
        <span className="block text-[10px] text-zinc-600 mt-1">Plataforma por Navalio SaaS</span>
      </footer>
    </div>
  )
}
