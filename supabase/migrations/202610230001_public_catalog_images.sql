-- Catalogue photos are licensed for public reuse, so serve them from public URLs that
-- browsers and the CDN can cache, instead of signed URLs that change on every request.
update storage.buckets set public = true where id = 'catalog-assets';

create index if not exists assets_dish_review_idx
  on public.assets (dish_id, review_status, created_at desc)
  where dish_id is not null;
