// src/app/actions/cache.ts
'use server';

import { revalidateTag } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users } from '../../../drizzle'; 
import { eq } from 'drizzle-orm';

/**
 * Securely clears the Next.js cache for a specific data prefix for the current company.
 * @param cachePrefix e.g., 'dealers', 'mason-pc', 'bags-lift'
 */
export async function refreshCompanyCache(cachePrefix: string) {
  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) throw new Error('Unauthorized');

    const result = await db
      .select({ companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = result[0];

    if (!currentUser) throw new Error('User not found');

    // Define tags that are global and shouldn't get a companyId attached
    const globalTags = ['technical-sites',];
    
    // If it's a global tag, use it exactly as is. Otherwise, append the companyId.
    const targetTag = globalTags.includes(cachePrefix) 
      ? cachePrefix 
      : `${cachePrefix}-${currentUser.companyId}`;
    
    // Nuke the cache!
    revalidateTag(targetTag, 'max');
    
    return { success: true, message: `Cache cleared for ${targetTag}` };
  } catch (error) {
    console.error('Error clearing cache:', error);
    return { success: false, error: 'Failed to clear cache' };
  }
}