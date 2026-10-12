'use server'

import { randomUUID } from 'node:crypto'
import { requireTenantStaff } from '@/lib/auth/guards'
import { createAdminClient } from '@/utils/supabase/admin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_GALLERY_IMAGE_BYTES = 8 * 1024 * 1024
const GALLERY_DATA_URL_PATTERN = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/

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

  try {
    await requireTenantStaff(input.tenantId)
  } catch {
    return { success: false, message: 'Não autorizado.' }
  }

  const imageMatch = input.storagePath.match(GALLERY_DATA_URL_PATTERN)
  if (!imageMatch) {
    return { success: false, message: 'Formato inválido. Envie PNG, JPEG ou WEBP.' }
  }

  const imageBuffer = Buffer.from(imageMatch[2], 'base64')
  if (imageBuffer.length === 0 || imageBuffer.length > MAX_GALLERY_IMAGE_BYTES) {
    return { success: false, message: 'A imagem deve ter no máximo 8MB.' }
  }

  const admin = createAdminClient()

  const linkedProfileIds = [input.barberId, input.clientId].filter((id): id is string => Boolean(id))
  if (linkedProfileIds.some((id) => !UUID_PATTERN.test(id))) {
    return { success: false, message: 'Perfil vinculado inválido.' }
  }
  if (linkedProfileIds.length > 0) {
    const { data: linkedProfiles, error: linkedProfilesError } = await admin
      .from('profiles')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .in('id', linkedProfileIds)
    if (linkedProfilesError || linkedProfiles?.length !== new Set(linkedProfileIds).size) {
      return { success: false, message: 'O perfil vinculado não pertence a esta barbearia.' }
    }
  }

  const imageType = imageMatch[1]
  const extension = imageType === 'jpeg' ? 'jpg' : imageType
  const objectPath = `tenants/${input.tenantId}/gallery/${randomUUID()}.${extension}`
  const { error: uploadError } = await admin.storage
    .from('barbershop-media')
    .upload(objectPath, imageBuffer, {
      contentType: `image/${imageType}`,
      upsert: false,
    })
  if (uploadError) {
    return { success: false, message: 'Não foi possível enviar a imagem da galeria.' }
  }

  const { data: publicUrl } = admin.storage.from('barbershop-media').getPublicUrl(objectPath)
  const { data, error } = await admin
    .from('gallery_photos')
    .insert({
      tenant_id: input.tenantId,
      storage_path: publicUrl.publicUrl,
      caption: input.caption?.trim() || null,
      barber_id: input.barberId && UUID_PATTERN.test(input.barberId) ? input.barberId : null,
      client_id: input.clientId && UUID_PATTERN.test(input.clientId) ? input.clientId : null,
      is_public: input.isPublic !== false,
    })
    .select('id, storage_path, caption')
    .single()

  if (error || !data) {
    await admin.storage.from('barbershop-media').remove([objectPath])
    return { success: false, message: 'Não foi possível registrar a foto na galeria.' }
  }

  return { success: true, data }
}

export async function deleteGalleryPhoto(photoId: string, tenantId: string) {
  if (!UUID_PATTERN.test(photoId) || !UUID_PATTERN.test(tenantId)) {
    return { success: false, message: 'Identificadores inválidos.' }
  }

  try {
    await requireTenantStaff(tenantId)
  } catch {
    return { success: false, message: 'Não autorizado.' }
  }

  const admin = createAdminClient()
  const { data: photo, error: findError } = await admin
    .from('gallery_photos')
    .select('storage_path')
    .eq('id', photoId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (findError || !photo) {
    return { success: false, message: 'Foto não encontrada.' }
  }

  const { error } = await admin
    .from('gallery_photos')
    .delete()
    .eq('id', photoId)
    .eq('tenant_id', tenantId)

  if (error) {
    return { success: false, message: 'Erro ao excluir foto.' }
  }

  const publicPrefix = '/storage/v1/object/public/barbershop-media/'
  const publicPrefixIndex = photo.storage_path.indexOf(publicPrefix)
  if (publicPrefixIndex >= 0) {
    const objectPath = decodeURIComponent(photo.storage_path.slice(publicPrefixIndex + publicPrefix.length))
    const { error: storageError } = await admin.storage.from('barbershop-media').remove([objectPath])
    if (storageError) {
      console.error('[Gallery] Registro removido, mas o objeto não pôde ser excluído.', { code: storageError.name })
    }
  }

  return { success: true, message: 'Foto removida com sucesso.' }
}
