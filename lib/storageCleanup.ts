import { supabase } from '@/lib/supabase'

// Supabase public URLs look like:
// https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
// Deleting a row doesn't remove the uploaded file behind it, so every
// delete flow (products, product gallery, designs, profile photos) needs
// to also remove the underlying storage object or it's orphaned forever.
function pathFromPublicUrl(bucket: string, url: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`
  const index = url.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(url.slice(index + marker.length))
}

export async function removeFromStorage(bucket: string, urls: (string | null | undefined)[]) {
  if (!supabase) return
  const paths = urls
    .filter((u): u is string => !!u)
    .map((u) => pathFromPublicUrl(bucket, u))
    .filter((p): p is string => !!p)
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(bucket).remove(paths)
  if (error) console.error(`Failed to remove ${bucket} file(s):`, error.message)
}
