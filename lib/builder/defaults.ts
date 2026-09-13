export type TenantSiteConfigData = {
  id?: string
  tenant_id: string
  logo_url: string | null
  banner_url: string | null
  headline_title: string | null
  headline_subtitle: string | null
  about_text: string | null
  font_family: string
  bg_texture: string
  primary_color: string
  background_color: string
  card_color: string
  gallery_photos: string[]
  amenities: string[]
  sections_visibility: {
    hero: boolean
    services: boolean
    barbers: boolean
    gallery: boolean
    about: boolean
    amenities: boolean
    location: boolean
  }
  updated_at?: string
}

export const DEFAULT_SITE_CONFIG: Omit<TenantSiteConfigData, 'tenant_id'> = {
  logo_url: null,
  banner_url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1400&q=80',
  headline_title: 'Tradição, Estilo e Atendimento de Primeira',
  headline_subtitle: 'Agende seu horário online em menos de 1 minuto sem complicação.',
  about_text: 'Nossa barbearia é especializada em cortes clássicos e modernos, barboterapia tradicional com toalha quente e tratamentos capilares exclusivos. Um ambiente feito para quem valoriza elegância e conforto.',
  font_family: 'font-sans',
  bg_texture: 'clean_dark',
  primary_color: '#D97706',
  background_color: '#09090b',
  card_color: '#18181b',
  gallery_photos: [
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1517832606589-7629c3395909?auto=format&fit=crop&w=800&q=80'
  ],
  amenities: ['Cerveja Gelada', 'Wi-Fi Grátis', 'Ar-Condicionado', 'Mesa de Sinuca'],
  sections_visibility: {
    hero: true,
    services: true,
    barbers: true,
    gallery: true,
    about: true,
    amenities: true,
    location: true,
  },
}
