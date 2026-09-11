'use server'

import { requireOwner } from '@/lib/auth/guards'
import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function getGalleryPhotos(tenantId: string, isPublicOnly: boolean = true) {
  if (!UUID_PATTERN.test(tenantId)) return []

  const admin = createAdminClient()
  let query = admin
    .from('gallery_photos')
    .select(`
      id,
      storage_path,
      caption,
      is_public,
      created_at,
      barber:profiles!gallery_photos_barber_id_fkey(id, full_name, avatar_url),
      client:profiles!gallery_photos_client_id_fkey(id, full_name, avatar_url)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (isPublicOnly) {
    query = query.eq('is_public', true)
  }

  const { data, error } = await query
  if (error) {
    console.error('Erro ao buscar fotos da galeria:', error)
    return []
  }

  return data ?? []
}

export type AddGalleryPhotoInput = {
  tenantId: string
  storagePath: string
  caption?: string
  barberId?: string
  clientId?: string
  isPublic?: boolean
}

export async function addGalleryPhoto(input: AddGalleryPhotoInput) {
  if (!UUID_PATTERN.test(input.tenantId)) {
    return { success: false, message: 'Barbearia inválida.' }
  }

  if (!input.storagePath || input.storagePath.length < 5) {
    return { success: false, message: 'Imagem inválida.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('gallery_photos')
    .insert({
      tenant_id: input.tenantId,
      storage_path: input.storagePath,
      caption: input.caption?.trim() || null,
      barber_id: input.barberId && UUID_PATTERN.test(input.barberId) ? input.barberId : null,
      client_id: input.clientId && UUID_PATTERN.test(input.clientId) ? input.clientId : null,
      is_public: input.isPublic !== false,
    })
    .select('id, storage_path, caption')
    .single()

  if (error || !data) {
    return { success: false, message: 'Não foi possível registrar a foto na galeria.' }
  }

  return { success: true, data }
}

export async function deleteGalleryPhoto(photoId: string, tenantId: string) {
  if (!UUID_PATTERN.test(photoId) || !UUID_PATTERN.test(tenantId)) {
    return { success: false, message: 'Identificadores inválidos.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('gallery_photos')
    .delete()
    .eq('id', photoId)
    .eq('tenant_id', tenantId)

  if (error) {
    return { success: false, message: 'Erro ao excluir foto.' }
  }

  return { success: true, message: 'Foto removida com sucesso.' }
}
