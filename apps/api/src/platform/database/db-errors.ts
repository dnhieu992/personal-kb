/** mysql2 error codes we translate into HTTP problems. */
export function mysqlCode(e: unknown): string | undefined {
  const err = e as { code?: string; driverError?: { code?: string } };
  return err?.driverError?.code ?? err?.code;
}
export const isDuplicate = (e: unknown) => mysqlCode(e) === 'ER_DUP_ENTRY';
export const isRowReferenced = (e: unknown) =>
  mysqlCode(e) === 'ER_ROW_IS_REFERENCED_2' || mysqlCode(e) === 'ER_ROW_IS_REFERENCED';
export const isCheckViolation = (e: unknown) => mysqlCode(e) === 'ER_CHECK_CONSTRAINT_VIOLATED';
