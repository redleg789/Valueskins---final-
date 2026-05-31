import { query } from './db-pool';
import { logger } from './logger';

export type AuditOperation = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'DELETE_REQUESTED';

export async function auditLog(
  operation: AuditOperation,
  tableName: string,
  userId: string,
  resourceId?: string,
  oldValues?: any,
  newValues?: any,
  ipAddress?: string
) {
  try {
    await query(
      `INSERT INTO audit_logs (operation, table_name, user_id, resource_id, old_values, new_values, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [operation, tableName, userId, resourceId, JSON.stringify(oldValues), JSON.stringify(newValues), ipAddress]
    );
  } catch (error) {
    logger.error('Audit log failed', error as Error, { operation, tableName, userId });
  }
}

export async function getAuditLog(userId: string, limit: number = 100) {
  try {
    const result = await query(
      `SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  } catch (error) {
    logger.error('Get audit log failed', error as Error);
    return [];
  }
}
