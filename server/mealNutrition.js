// Approximate nutrition for one adult portion of each meal component, as typically
// served in Nigerian homes: [calories, protein g, carbs g, fat g, serving].
// Soups assume a usual amount of meat or fish in the pot. Review with a dietitian
// before presenting these as anything more precise than estimates.
const COMPONENT_NUTRITION = {
  egusi: [380, 20, 10, 30, '1 cup egusi soup with meat'],
  banga: [350, 15, 10, 28, '1 cup banga soup with fish'],
  ofensala: [220, 22, 8, 11, '1 cup ofe nsala with catfish'],
  ewedugbegiri: [260, 13, 25, 12, '1 cup ewedu and gbegiri'],
  bitterleaf: [280, 18, 10, 19, '1 cup bitterleaf soup with meat'],
  oha: [280, 18, 10, 19, '1 cup oha soup with meat'],
  afang: [320, 20, 9, 23, '1 cup afang soup with meat'],
  edikangikong: [330, 22, 9, 23, '1 cup edikang ikong with meat'],
  eforiro: [300, 18, 10, 21, '1 cup efo riro with meat'],
  ogbono: [340, 16, 10, 27, '1 cup ogbono soup with meat'],
  okrasoup: [230, 16, 12, 13, '1 cup okra soup with fish'],
  stew: [180, 3, 10, 14, '1/2 cup tomato stew'],
  peppersoup: [260, 30, 6, 12, '1 large bowl pepper soup with goat meat or fish'],
  poundedyam: [330, 4, 78, 1, '1 cup pounded yam'],
  eba: [320, 1, 78, 1, '1 cup eba'],
  amala: [280, 3, 66, 1, '1 cup amala'],
  fufu: [330, 1, 80, 1, '1 cup fufu'],
  semovita: [320, 11, 66, 1, '1 cup semovita'],
  wheatswallow: [300, 12, 62, 2, '1 cup wheat swallow'],
  tuwo: [270, 5, 59, 1, '1 cup tuwo shinkafa'],
  jollof: [380, 6, 60, 12, '1 1/2 cups jollof rice'],
  friedrice: [400, 8, 58, 15, '1 1/2 cups fried rice'],
  whiterice: [470, 7, 70, 16, '1 1/2 cups white rice with 1/2 cup stew'],
  ofada: [500, 10, 62, 22, '1 1/2 cups ofada rice with ayamase sauce'],
  spaghetti: [380, 10, 60, 10, '1 1/2 cups Nigerian spaghetti'],
  moimoi: [200, 11, 15, 10, '1 wrap moi moi'],
  akara: [280, 10, 20, 18, '5 akara balls'],
  pap: [180, 3, 38, 2, '1 1/2 cups pap with milk and sugar'],
  custard: [220, 5, 40, 5, '1 1/2 cups custard with milk and sugar'],
  oats: [230, 9, 35, 6, '1 cup cooked oats with milk'],
  bread: [250, 8, 48, 3, '3 slices agege bread'],
  toastbread: [220, 6, 30, 8, '2 slices buttered toast'],
  boiledyam: [240, 3, 56, 0, '3 slices boiled yam'],
  asaro: [400, 5, 70, 12, '1 1/2 cups yam porridge'],
  friedplantain: [280, 1, 48, 10, '1 ripe plantain, fried'],
  sweetpotato: [180, 4, 41, 0, '1 large boiled sweet potato'],
  irishpotato: [260, 6, 60, 0, '2 medium boiled potatoes'],
  friedfish: [300, 30, 0, 20, '1 medium piece fried fish'],
  beans: [380, 20, 60, 8, '1 1/2 cups beans porridge'],
  grilledchicken: [260, 28, 0, 16, '1 chicken quarter'],
  beef: [220, 26, 0, 13, '4 pieces beef or assorted meat'],
  eggs: [220, 13, 4, 17, '2 eggs as egg sauce'],
  turkey: [300, 32, 0, 19, '1 piece fried turkey'],
  coleslaw: [150, 1, 12, 11, '1/2 cup coleslaw'],
  banana: [105, 1, 27, 0, '1 medium banana'],
}

export function mealNutrition(foodIds) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 }
  const servings = []
  for (const id of foodIds) {
    const nutrition = COMPONENT_NUTRITION[id]
    if (!nutrition) return { calories: null, protein: null, carbs: null, fat: null, serving: null }
    const [calories, protein, carbs, fat, serving] = nutrition
    totals.calories += calories
    totals.protein += protein
    totals.carbs += carbs
    totals.fat += fat
    servings.push(serving)
  }
  return { ...totals, serving: servings.join(', ') }
}
