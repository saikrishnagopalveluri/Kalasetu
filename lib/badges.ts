// Server-only badge-award logic. Import only from API routes (uses
// supabaseAdmin) — never from client components. Awarding is idempotent via
// the artisan_badges primary key (user_id, badge_id), so calling this
// multiple times for the same event is always safe.
import { supabaseAdmin } from './supabaseAdmin'

export type BadgeEvent =
  | 'STORY_PUBLISHED'
  | 'REFERRAL_REWARD_UNLOCKED'
  | 'LEVEL1_COMPLETE'

async function award(userId: string, badgeId: string) {
  if (!supabaseAdmin) return
  await supabaseAdmin.from('artisan_badges').upsert(
    { user_id: userId, badge_id: badgeId },
    { onConflict: 'user_id,badge_id', ignoreDuplicates: true }
  )
}

export async function checkAndAwardBadges(userId: string, event: BadgeEvent) {
  if (!supabaseAdmin) return

  if (event === 'STORY_PUBLISHED') {
    const { count } = await supabaseAdmin
      .from('stories').select('id', { count: 'exact', head: true })
      .eq('author_id', userId).eq('status', 'PUBLISHED')
    if ((count ?? 0) >= 5) await award(userId, 'storyteller')

    const { data: culturalStory } = await supabaseAdmin
      .from('stories').select('id').eq('author_id', userId).eq('status', 'PUBLISHED')
      .in('category', ['My Village / Tradition', 'Traditional Craft Knowledge']).limit(1).maybeSingle()
    if (culturalStory) await award(userId, 'cultural_keeper')

    const { data: popularStory } = await supabaseAdmin
      .from('stories').select('id, likes_count, rating_sum, rating_count').eq('author_id', userId).eq('status', 'PUBLISHED')
    const isPopular = (popularStory ?? []).some(
      (s) => s.likes_count >= 25 || (s.rating_count >= 10 && s.rating_sum / s.rating_count >= 4.5)
    )
    if (isPopular) await award(userId, 'community_star')
  }

  if (event === 'REFERRAL_REWARD_UNLOCKED') {
    await award(userId, 'kalasetu_saathi')
    const { count } = await supabaseAdmin
      .from('saathi_rewards').select('id', { count: 'exact', head: true }).eq('saathi_id', userId)
    if ((count ?? 0) >= 3) await award(userId, 'mentor')
  }

  if (event === 'LEVEL1_COMPLETE') {
    await award(userId, 'digital_artisan')
  }

  // Master Artisan is a rollup — cheap enough to just check every time any
  // event fires, rather than wiring a separate trigger for it.
  const [{ count: productCount }, { data: profile }, { count: level3Count }] = await Promise.all([
    supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabaseAdmin.from('artisan_profiles').select('catalogue_published').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('module_progress').select('module_id', { count: 'exact', head: true })
      .eq('user_id', userId).like('module_id', 'l3-%'),
  ])
  if ((productCount ?? 0) >= 10 && profile?.catalogue_published && (level3Count ?? 0) >= 5) {
    await award(userId, 'master_artisan')
  }
}
