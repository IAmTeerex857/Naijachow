/* ===========================================================================
   FOODS — the 60-dish catalogue (post-pivot finished dishes, 5 categories).
   Reconstructed from NaijaPlate-PRD.md §6. Shape: { id, name, emoji, cat, q }.
     - id  → image-cache key is `food:<id>` in Supabase. THESE MUST MATCH your
             curated Supabase rows exactly, or curated images silently miss.
     - q   → Google fallback search phrase for the food card image.
     - cat → one of: soup | swallow | carb | protein | fruit.

   Fried Plantain and Coleslaw were recategorised (carb / fruit) — they were
   filed under Protein, which skewed the pairing prompt and the nutrition read.

   ✅ IDS VERIFIED against the live Supabase image_cache (image_cache_rows.csv,
   2026-07). All 60 `food:<id>` keys resolve to a curated image. The 5 keys that
   use a longer name in Supabase are: whiterice, wheatswallow, boiledyam,
   friedplantain, stew (Tomato Stew). Extra curated rows not used as cards:
   food:stew is reused for Tomato Stew; food:pepperchicken is a leftover from a
   removed item and is intentionally unused.
   =========================================================================== */

export const CATEGORIES = [
  { key: 'all',      label: 'All' },
  { key: 'soup',     label: 'Soups' },
  { key: 'swallow',  label: 'Swallows' },
  { key: 'carb',     label: 'Carbs' },
  { key: 'protein',  label: 'Protein' },
  { key: 'fruit',    label: 'Fruits' },
]

export const FOODS = [
  // ── Soups (13) ──────────────────────────────────────────────────────────
  { id: 'egusi',        name: 'Egusi Soup',        emoji: '🍲', cat: 'soup', q: 'egusi soup nigerian' },
  { id: 'banga',        name: 'Banga Soup',        emoji: '🍲', cat: 'soup', q: 'banga soup nigerian' },
  { id: 'ofensala',     name: 'Ofe Nsala',         emoji: '🍲', cat: 'soup', q: 'ofe nsala white soup nigerian' },
  { id: 'ewedugbegiri', name: 'Ewedu & Gbegiri',   emoji: '🍲', cat: 'soup', q: 'ewedu gbegiri abula soup nigerian' },
  { id: 'bitterleaf',   name: 'Bitterleaf Soup',   emoji: '🍲', cat: 'soup', q: 'bitterleaf soup onugbu nigerian' },
  { id: 'oha',          name: 'Oha Soup',          emoji: '🍲', cat: 'soup', q: 'oha soup nigerian' },
  { id: 'afang',        name: 'Afang Soup',        emoji: '🍲', cat: 'soup', q: 'afang soup nigerian' },
  { id: 'edikangikong', name: 'Edikang Ikong',     emoji: '🍲', cat: 'soup', q: 'edikang ikong soup nigerian' },
  { id: 'eforiro',      name: 'Efo Riro',          emoji: '🍲', cat: 'soup', q: 'efo riro vegetable soup nigerian' },
  { id: 'ogbono',       name: 'Ogbono Soup',       emoji: '🍲', cat: 'soup', q: 'ogbono soup nigerian' },
  { id: 'okrasoup',     name: 'Okra Soup',         emoji: '🍲', cat: 'soup', q: 'okra soup nigerian' },
  { id: 'stew',         name: 'Tomato Stew',       emoji: '🍲', cat: 'soup', q: 'nigerian tomato stew' },
  { id: 'peppersoup',   name: 'Pepper Soup',       emoji: '🍲', cat: 'soup', q: 'nigerian pepper soup' },

  // ── Swallows (7) ────────────────────────────────────────────────────────
  { id: 'poundedyam',   name: 'Pounded Yam',       emoji: '🍚', cat: 'swallow', q: 'pounded yam swallow nigerian' },
  { id: 'eba',          name: 'Eba',               emoji: '🍚', cat: 'swallow', q: 'eba garri swallow nigerian' },
  { id: 'amala',        name: 'Amala',             emoji: '🍚', cat: 'swallow', q: 'amala swallow nigerian' },
  { id: 'fufu',         name: 'Fufu',              emoji: '🍚', cat: 'swallow', q: 'fufu swallow nigerian' },
  { id: 'semovita',     name: 'Semovita',          emoji: '🍚', cat: 'swallow', q: 'semovita swallow nigerian' },
  { id: 'wheatswallow', name: 'Wheat Swallow',     emoji: '🍚', cat: 'swallow', q: 'wheat swallow nigerian' },
  { id: 'tuwo',         name: 'Tuwo Shinkafa',     emoji: '🍚', cat: 'swallow', q: 'tuwo shinkafa rice swallow' },

  // ── Carbs (17) ──────────────────────────────────────────────────────────
  { id: 'jollof',       name: 'Jollof Rice',       emoji: '🍛', cat: 'carb', q: 'jollof rice nigerian' },
  { id: 'friedrice',    name: 'Fried Rice',        emoji: '🍛', cat: 'carb', q: 'nigerian fried rice' },
  { id: 'whiterice',    name: 'White Rice & Stew', emoji: '🍚', cat: 'carb', q: 'white rice and stew nigerian' },
  { id: 'ofada',        name: 'Ofada Rice',        emoji: '🍙', cat: 'carb', q: 'ofada rice and sauce nigerian' },
  { id: 'spaghetti',    name: 'Spaghetti',         emoji: '🍝', cat: 'carb', q: 'nigerian spaghetti jollof' },
  { id: 'moimoi',       name: 'Moi Moi',           emoji: '🫘', cat: 'carb', q: 'moi moi beans pudding nigerian' },
  { id: 'akara',        name: 'Akara',             emoji: '🧆', cat: 'carb', q: 'akara bean fritters nigerian' },
  { id: 'pap',          name: 'Pap',               emoji: '🥣', cat: 'carb', q: 'pap akamu ogi nigerian' },
  { id: 'custard',      name: 'Custard',           emoji: '🥣', cat: 'carb', q: 'custard nigerian breakfast' },
  { id: 'oats',         name: 'Oats',              emoji: '🥣', cat: 'carb', q: 'oatmeal bowl' },
  { id: 'bread',        name: 'Bread',             emoji: '🍞', cat: 'carb', q: 'agege bread loaf nigerian' },
  { id: 'toastbread',   name: 'Toast Bread',       emoji: '🍞', cat: 'carb', q: 'toast bread' },
  { id: 'boiledyam',    name: 'Yam',               emoji: '🍠', cat: 'carb', q: 'boiled yam nigerian' },
  { id: 'asaro',        name: 'Yam Porridge',      emoji: '🍠', cat: 'carb', q: 'asaro yam porridge nigerian' },
  { id: 'friedplantain', name: 'Fried Plantain',  emoji: '🍌', cat: 'carb',    q: 'fried plantain dodo nigerian' },
  { id: 'sweetpotato',  name: 'Sweet Potato',      emoji: '🍠', cat: 'carb', q: 'sweet potato' },
  { id: 'irishpotato',  name: 'Irish Potato',      emoji: '🥔', cat: 'carb', q: 'boiled irish potato' },

  // ── Protein (6) ─────────────────────────────────────────────────────────
  { id: 'friedfish',     name: 'Fried Fish',       emoji: '🐟', cat: 'protein', q: 'nigerian fried fish' },
  { id: 'beans',         name: 'Beans',            emoji: '🫘', cat: 'protein', q: 'nigerian beans porridge' },
  { id: 'grilledchicken', name: 'Chicken',         emoji: '🍗', cat: 'protein', q: 'grilled chicken nigerian' },
  { id: 'beef',          name: 'Beef / Assorted',  emoji: '🥩', cat: 'protein', q: 'assorted beef meat nigerian' },
  { id: 'eggs',          name: 'Eggs',             emoji: '🥚', cat: 'protein', q: 'fried eggs nigerian' },
  { id: 'turkey',        name: 'Turkey',           emoji: '🦃', cat: 'protein', q: 'nigerian turkey' },

  // ── Fruits (17) ─────────────────────────────────────────────────────────
  { id: 'banana',        name: 'Banana',           emoji: '🍌', cat: 'fruit', q: 'banana' },
  { id: 'orange',        name: 'Orange',           emoji: '🍊', cat: 'fruit', q: 'orange fruit' },
  { id: 'mango',         name: 'Mango',            emoji: '🥭', cat: 'fruit', q: 'mango fruit' },
  { id: 'pineapple',     name: 'Pineapple',        emoji: '🍍', cat: 'fruit', q: 'pineapple fruit' },
  { id: 'pawpaw',        name: 'Pawpaw',           emoji: '🍈', cat: 'fruit', q: 'pawpaw papaya fruit' },
  { id: 'watermelon',    name: 'Watermelon',       emoji: '🍉', cat: 'fruit', q: 'watermelon fruit' },
  { id: 'avocado',       name: 'Avocado',          emoji: '🥑', cat: 'fruit', q: 'avocado pear' },
  { id: 'guava',         name: 'Guava',            emoji: '🍈', cat: 'fruit', q: 'guava fruit' },
  { id: 'apple',         name: 'Apple',            emoji: '🍎', cat: 'fruit', q: 'apple fruit' },
  { id: 'grapes',        name: 'Grapes',           emoji: '🍇', cat: 'fruit', q: 'grapes fruit' },
  { id: 'lemon',         name: 'Lemon',            emoji: '🍋', cat: 'fruit', q: 'lemon fruit' },
  { id: 'lime',          name: 'Lime',             emoji: '🍈', cat: 'fruit', q: 'lime fruit' },
  { id: 'tangerine',     name: 'Tangerine',        emoji: '🍊', cat: 'fruit', q: 'tangerine fruit' },
  { id: 'strawberry',    name: 'Strawberry',       emoji: '🍓', cat: 'fruit', q: 'strawberry fruit' },
  { id: 'soursop',       name: 'Soursop',          emoji: '🍈', cat: 'fruit', q: 'soursop fruit' },
  { id: 'cucumber',      name: 'Cucumber',         emoji: '🥒', cat: 'fruit', q: 'cucumber' },
  { id: 'coleslaw',      name: 'Coleslaw',         emoji: '🥗', cat: 'fruit',   q: 'coleslaw salad' },
]

export const FOOD_BY_ID = Object.fromEntries(FOODS.map((f) => [f.id, f]))

/* For a generated meal (which may be a combo like "Egusi Soup with Pounded Yam"),
   pick the id of the best single selected dish to represent it visually — used as a
   fallback when no curated `dish:<combo>` image exists yet. Prefers the "hero" of the
   plate (soup/rice) over the side. Returns null if nothing matches. */
const MEAL_IMAGE_CAT_PRIORITY = { soup: 0, carb: 1, protein: 2, swallow: 3, fruit: 4 }
export function pickMealImageFoodId(meal) {
  const hay = `${meal?.dish_key || ''} ${meal?.name || ''}`.toLowerCase()
  const matches = FOODS.filter((f) => hay.includes(f.name.toLowerCase()))
  if (!matches.length) return null
  // Longest name first: "Pounded Yam" must beat the bare "Yam" it contains,
  // even though Yam's category (carb) outranks a swallow. Category priority
  // then picks the hero of a genuine combo — the soup over its swallow.
  matches.sort((a, b) => {
    const len = b.name.length - a.name.length
    if (len !== 0 && (a.name.includes(b.name) || b.name.includes(a.name))) return len
    const cat = (MEAL_IMAGE_CAT_PRIORITY[a.cat] ?? 9) - (MEAL_IMAGE_CAT_PRIORITY[b.cat] ?? 9)
    if (cat !== 0) return cat
    // Same category: whichever is named first is the hero of the plate
    // ("Jollof Rice & Fried Plantain" is a picture of jollof).
    return hay.indexOf(a.name.toLowerCase()) - hay.indexOf(b.name.toLowerCase())
  })
  return matches[0].id
}
