/**
 * Shared helper used by all /events/[slug]/* pages to produce generateStaticParams.
 * For static export we must provide at least one param for dynamic segments.
 * Keep this minimal so all real event pages are still resolved client-side.
 */
export async function getEventStaticParams(): Promise<Array<{ slug: string }>> {
  return [{ slug: "placeholder" }];
}
