import type { TranslationKey } from './translations'

// Shared between the story composer (app/community/new) and the story list
// filter (app/community/CommunityListView) so both always agree on the same
// value/translation-key pairs. `value` is what's stored in stories.category
// and used for filtering; `key` is only ever used for display.
export const STORY_CATEGORIES: { value: string; key: TranslationKey }[] = [
  { value: 'My Craft Story', key: 'community.category.craftStory' },
  { value: 'How I Make My Products', key: 'community.category.howIMake' },
  { value: 'My Village / Tradition', key: 'community.category.village' },
  { value: 'Materials & Techniques', key: 'community.category.materials' },
  { value: 'Festival Stories', key: 'community.category.festival' },
  { value: 'Behind the Product', key: 'community.category.behind' },
  { value: 'My Business Journey', key: 'community.category.business' },
  { value: 'Tips for Other Artisans', key: 'community.category.tips' },
  { value: 'Traditional Craft Knowledge', key: 'community.category.traditional' },
]
