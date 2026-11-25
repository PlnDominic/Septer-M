-- Starter catalogue. Safe to re-run: upserts by slug.
-- Stock numbers are placeholders. Ratings start at 0 (no reviews yet): the storefront shows a rating only when real reviews exist.

insert into public.categories (slug, label, position) values
  ('cleanser',    'Cleansers',    1),
  ('serum',       'Serums',       2),
  ('moisturiser', 'Moisturisers', 3),
  ('sunscreen',   'Sunscreen',    4),
  ('mask',        'Masks',        5)
on conflict (slug) do update set label = excluded.label, position = excluded.position;

with seed (slug, name, tagline, category, size_ml, skin_types, concerns, ingredients, how_to_use,
           is_new, best_seller, stock, rating_value, rating_count, gbp, ghs, was_gbp, was_ghs) as (values
  ('gentle-gel-cleanser', 'Gentle Gel Cleanser', 'Lifts dirt and SPF without stripping', 'cleanser', 150,
   array['All','Sensitive'], array['Everyday cleansing'],
   'Aqua, Glycerin, Coco-Glucoside, Aloe Barbadensis Leaf Juice, Panthenol, Allantoin',
   'Massage onto damp skin morning and evening, then rinse with lukewarm water.',
   false, true, 42, 0, 0, 1400, 18500, null::int, null::int),
  ('vitamin-c-brightening-serum', 'Vitamin C Brightening Serum', 'Visibly brighter, more even tone', 'serum', 30,
   array['Normal','Combination','Dull'], array['Dark spots','Dullness'],
   'Aqua, Ascorbyl Glucoside, Glycerin, Niacinamide, Sodium Hyaluronate, Ferulic Acid',
   'Apply 3-4 drops to clean skin in the morning, followed by moisturiser and SPF.',
   true, true, 18, 0, 0, 2800, 36000, null, null),
  ('niacinamide-clarifying-serum', 'Niacinamide Clarifying Serum', 'Balances oil and refines pores', 'serum', 30,
   array['Oily','Combination'], array['Blemishes','Excess oil','Pores'],
   'Aqua, Niacinamide, Zinc PCA, Propanediol, Panthenol, Allantoin',
   'Apply a few drops to clean skin morning or evening before moisturiser.',
   false, true, 7, 0, 0, 1800, 23500, null, null),
  ('barrier-repair-moisturiser', 'Barrier Repair Moisturiser', 'Rich, calming comfort for dry skin', 'moisturiser', 50,
   array['Dry','Sensitive'], array['Dryness','Redness'],
   'Aqua, Butyrospermum Parkii (Shea) Butter, Ceramide NP, Squalane, Glycerin, Panthenol',
   'Smooth over face and neck morning and night as the final step of your routine.',
   true, false, 25, 0, 0, 2200, 28500, null, null),
  ('light-gel-moisturiser', 'Light Gel Moisturiser', 'Weightless hydration that never feels greasy', 'moisturiser', 50,
   array['Oily','Combination','Normal'], array['Dehydration'],
   'Aqua, Sodium Hyaluronate, Glycerin, Aloe Barbadensis Leaf Juice, Squalane, Allantoin',
   'Apply to clean skin morning and evening.',
   false, false, 3, 0, 0, 1900, 24500, 2100, 27000),
  ('daily-sunscreen-spf-50', 'Daily Sunscreen SPF 50', 'Invisible on every skin tone', 'sunscreen', 50,
   array['All'], array['Sun protection','Dark spots'],
   'Aqua, Zinc Oxide, Caprylic/Capric Triglyceride, Glycerin, Tocopherol, Squalane',
   'Apply generously as the last step every morning and reapply every two hours in strong sun.',
   true, true, 56, 0, 0, 1600, 21000, null, null),
  ('overnight-hydration-mask', 'Overnight Hydration Mask', 'Wake up to plump, rested skin', 'mask', 75,
   array['Dry','Normal','Dull'], array['Dryness','Dullness'],
   'Aqua, Glycerin, Sodium Hyaluronate, Shea Butter, Squalane, Panthenol',
   'Apply a thin layer as the last step 2-3 nights a week. Rinse in the morning.',
   true, false, 12, 0, 0, 2400, 31000, null, null),
  ('clay-purifying-mask', 'Clay Purifying Mask', 'Deep clean without the tight feeling', 'mask', 75,
   array['Oily','Combination'], array['Blemishes','Pores'],
   'Aqua, Kaolin, Bentonite, Glycerin, Salicylic Acid, Allantoin',
   'Apply an even layer, leave 8-10 minutes, then rinse. Use once or twice weekly.',
   false, false, 0, 0, 0, 1700, 22000, 2000, 26000)
),
upserted as (
  insert into public.products (slug, name, tagline, category_id, size_ml, skin_types, concerns, ingredients,
                               how_to_use, image_path, is_new, best_seller, status, stock, rating_value, rating_count)
  select s.slug, s.name, s.tagline, c.id, s.size_ml, s.skin_types, s.concerns, s.ingredients, s.how_to_use,
         '/images/products/' || s.slug || '.jpg', s.is_new, s.best_seller, 'active', s.stock, s.rating_value, s.rating_count
  from seed s join public.categories c on c.slug = s.category
  on conflict (slug) do update set
    name = excluded.name, tagline = excluded.tagline, category_id = excluded.category_id, size_ml = excluded.size_ml,
    skin_types = excluded.skin_types, concerns = excluded.concerns, ingredients = excluded.ingredients,
    how_to_use = excluded.how_to_use, image_path = excluded.image_path, is_new = excluded.is_new,
    best_seller = excluded.best_seller
  returning id, slug
)
insert into public.product_prices (product_id, currency, amount, compare_at)
select u.id, p.currency, p.amount, p.compare_at
from upserted u
join seed s on s.slug = u.slug
cross join lateral (values
  ('GBP'::public.currency_code, s.gbp, s.was_gbp),
  ('GHS'::public.currency_code, s.ghs, s.was_ghs)
) as p (currency, amount, compare_at)
on conflict (product_id, currency) do update set amount = excluded.amount, compare_at = excluded.compare_at;
