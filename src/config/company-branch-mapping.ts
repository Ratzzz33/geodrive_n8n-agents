/**
 * Маппинг company_id из RentProg → branch name
 */

export const COMPANY_ID_TO_BRANCH: Record<number, string> = {
  9247: 'tbilisi',
  9248: 'kutaisi',
  9506: 'batumi',
  11163: 'service-center',
};

/**
 * Определяет branch по company_id из данных сущности
 */
export function getBranchByCompanyId(companyId: number | null | undefined): string | null {
  if (!companyId) return null;
  return COMPANY_ID_TO_BRANCH[companyId] || null;
}

