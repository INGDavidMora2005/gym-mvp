'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { AuditAction, Owner } from '@/types';

/**
 * Registra una acción en la tabla audit_log para auditoría.
 * Si el insert falla (ej: error de BD), solo registra en consola sin lanzar.
 * La operación principal ya se completó, así que no se debe romper aquí.
 *
 * No se almacenan datos sensibles como teléfonos o direcciones.
 */
export async function logAudit(params: {
  owner: Owner;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // No incluimos teléfono ni dirección en details por seguridad
  const safeDetails = JSON.stringify(params.details || {});

  const { error } = await supabase.from('audit_log').insert({
    owner_id: params.owner.id,
    owner_name: params.owner.name,
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId,
    details: safeDetails,
  });

  if (error) {
    console.error('[audit]', `Fallo al registrar auditoría: ${error.message}`);
  }
}