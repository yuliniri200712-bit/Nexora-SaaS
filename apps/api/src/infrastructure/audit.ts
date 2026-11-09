import type { Transaction } from './database.js';
import type { TenantContext } from '../core/context.js';
export function audit(tx: Transaction, context: TenantContext, action: string, resourceId: string) {
  return tx.auditEvent.create({
    data: {
      tenantId: context.tenantId,
      actorId: context.membershipId,
      action,
      resourceId,
      requestId: context.requestId,
    },
  });
}
