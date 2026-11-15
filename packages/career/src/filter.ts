import type { Career } from '@savanna/contracts';

export interface CareerFilters {
  location?: string | null;
  accommodationsOnly?: boolean;
}

/**
 * Filter a list of career opportunities by location and accommodation note presence.
 */
export function filterCareers(careers: readonly Career[], filters: CareerFilters): Career[] {
  const targetLocation = filters.location?.trim().toLowerCase();
  const accommodationsOnly = Boolean(filters.accommodationsOnly);

  return careers.filter((job) => {
    if (targetLocation && targetLocation !== '') {
      const jobLocation = (job.location ?? '').trim().toLowerCase();
      if (jobLocation !== targetLocation) return false;
    }
    if (accommodationsOnly) {
      const acc = (job.accommodations ?? '').trim();
      if (acc === '') return false;
    }
    return true;
  });
}
