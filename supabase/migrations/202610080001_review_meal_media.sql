alter table public.meal_media
  add column if not exists review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  add column if not exists composition text not null default 'uncertain'
    check (composition in ('exact_combo', 'single_component', 'raw_ingredient', 'uncertain')),
  add column if not exists reviewed_at timestamptz;

update public.meal_media
set review_status = 'approved',
    composition = 'exact_combo',
    reviewed_at = now()
where source_type = 'wikimedia'
  and dish_key in ('pap+akara', 'egusi+poundedyam');

update public.meal_media
set review_status = 'rejected',
    composition = 'uncertain',
    reviewed_at = now()
where source_type = 'youtube';

insert into public.meal_media (
  dish_key, meal_name, thumbnail_url, source_url, source_title, source_creator,
  credit, source_type, verified_at, review_status, composition, reviewed_at
) values
  (
    'bread+eggs', 'Bread and Egg',
    'https://upload.wikimedia.org/wikipedia/commons/9/9e/Egg_and_toast_bread.jpg',
    'https://commons.wikimedia.org/wiki/File:Egg_and_toast_bread.jpg',
    'Egg and toast bread.jpg', 'Fatimah Bello', 'Fatimah Bello, CC0, Wikimedia Commons',
    'wikimedia', now(), 'approved', 'exact_combo', now()
  ),
  (
    'toastbread+eggs', 'Toast and Egg',
    'https://upload.wikimedia.org/wikipedia/commons/9/9e/Egg_and_toast_bread.jpg',
    'https://commons.wikimedia.org/wiki/File:Egg_and_toast_bread.jpg',
    'Egg and toast bread.jpg', 'Fatimah Bello', 'Fatimah Bello, CC0, Wikimedia Commons',
    'wikimedia', now(), 'approved', 'exact_combo', now()
  ),
  (
    'ewedugbegiri+amala', 'Amala with Ewedu and Gbegiri',
    'https://upload.wikimedia.org/wikipedia/commons/1/1b/Amala_and_Gbegiri_with_Ewedu_soup.jpg',
    'https://commons.wikimedia.org/wiki/File:Amala_and_Gbegiri_with_Ewedu_soup.jpg',
    'Amala and Gbegiri with Ewedu soup.jpg', 'Bukky658', 'Bukky658, CC BY-SA 4.0, Wikimedia Commons',
    'wikimedia', now(), 'approved', 'exact_combo', now()
  ),
  (
    'jollof+grilledchicken', 'Jollof Rice and Chicken',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/A_Nigeria_Jollof_Rice_with_chicken.jpg/960px-A_Nigeria_Jollof_Rice_with_chicken.jpg',
    'https://commons.wikimedia.org/wiki/File:A_Nigeria_Jollof_Rice_with_chicken.jpg',
    'A Nigeria Jollof Rice with chicken.jpg', 'Ei''eke', 'Ei''eke, CC BY-SA 4.0, Wikimedia Commons',
    'wikimedia', now(), 'approved', 'exact_combo', now()
  ),
  (
    'friedrice+grilledchicken', 'Nigerian Fried Rice and Chicken',
    'https://upload.wikimedia.org/wikipedia/commons/2/29/Fried_rice_and_chicken_garnished_with_sweet_corn%2C_carrot_and_green_peas.jpg',
    'https://commons.wikimedia.org/wiki/File:Fried_rice_and_chicken_garnished_with_sweet_corn,_carrot_and_green_peas.jpg',
    'Fried rice and chicken garnished with sweet corn, carrot and green peas.jpg', 'Bukky658', 'Bukky658, CC BY-SA 4.0, Wikimedia Commons',
    'wikimedia', now(), 'approved', 'exact_combo', now()
  )
on conflict (dish_key) do update set
  meal_name = excluded.meal_name,
  thumbnail_url = excluded.thumbnail_url,
  source_url = excluded.source_url,
  source_title = excluded.source_title,
  source_creator = excluded.source_creator,
  credit = excluded.credit,
  source_type = excluded.source_type,
  verified_at = excluded.verified_at,
  review_status = excluded.review_status,
  composition = excluded.composition,
  reviewed_at = excluded.reviewed_at;
