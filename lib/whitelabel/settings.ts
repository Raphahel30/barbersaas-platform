export type TenantVisualSettings = {
  logoUrl: string
  faviconUrl: string
  bannerUrl: string
  primaryColor: string
  secondaryColor: string
  fontFamily: 'sans' | 'serif' | 'mono' | 'vintage'
  texture: 'wood' | 'vintage' | 'minimal' | 'geometric' | 'none'
  instagram?: string
  whatsapp?: string
  phone?: string
  addressText?: string
  openingHoursText?: string
  onboardingCompleted?: boolean
}

export const defaultVisualSettings: TenantVisualSettings = {
  logoUrl: '',
  faviconUrl: '',
  bannerUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=80',
  primaryColor: '#f59e0b',
  secondaryColor: '#d97706',
  fontFamily: 'sans',
  texture: 'vintage',
  instagram: '',
  whatsapp: '',
  phone: '',
  addressText: '',
  openingHoursText: 'Seg a Sáb: 09h às 20h',
}
