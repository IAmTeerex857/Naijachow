insert into public.dishes (id, name, category, image_query) values
('egusi','Egusi Soup','soup','egusi soup nigerian'),('banga','Banga Soup','soup','banga soup nigerian'),
('ofensala','Ofe Nsala','soup','ofe nsala white soup nigerian'),('ewedugbegiri','Ewedu & Gbegiri','soup','ewedu gbegiri abula soup nigerian'),
('bitterleaf','Bitterleaf Soup','soup','bitterleaf soup onugbu nigerian'),('oha','Oha Soup','soup','oha soup nigerian'),
('afang','Afang Soup','soup','afang soup nigerian'),('edikangikong','Edikang Ikong','soup','edikang ikong soup nigerian'),
('eforiro','Efo Riro','soup','efo riro vegetable soup nigerian'),('ogbono','Ogbono Soup','soup','ogbono soup nigerian'),
('okrasoup','Okra Soup','soup','okra soup nigerian'),('stew','Tomato Stew','soup','nigerian tomato stew'),
('peppersoup','Pepper Soup','soup','nigerian pepper soup'),('poundedyam','Pounded Yam','swallow','pounded yam swallow nigerian'),
('eba','Eba','swallow','eba garri swallow nigerian'),('amala','Amala','swallow','amala swallow nigerian'),
('fufu','Fufu','swallow','fufu swallow nigerian'),('semovita','Semovita','swallow','semovita swallow nigerian'),
('wheatswallow','Wheat Swallow','swallow','wheat swallow nigerian'),('tuwo','Tuwo Shinkafa','swallow','tuwo shinkafa rice swallow'),
('jollof','Jollof Rice','carb','jollof rice nigerian'),('friedrice','Fried Rice','carb','nigerian fried rice'),
('whiterice','White Rice & Stew','carb','white rice and stew nigerian'),('ofada','Ofada Rice','carb','ofada rice and sauce nigerian'),
('spaghetti','Spaghetti','carb','nigerian spaghetti jollof'),('moimoi','Moi Moi','carb','moi moi beans pudding nigerian'),
('akara','Akara','carb','akara bean fritters nigerian'),('pap','Pap','carb','pap akamu ogi nigerian'),
('custard','Custard','carb','custard nigerian breakfast'),('oats','Oats','carb','oatmeal bowl'),
('bread','Bread','carb','agege bread loaf nigerian'),('toastbread','Toast Bread','carb','toast bread'),
('boiledyam','Yam','carb','boiled yam nigerian'),('asaro','Yam Porridge','carb','asaro yam porridge nigerian'),
('friedplantain','Fried Plantain','carb','fried plantain dodo nigerian'),('sweetpotato','Sweet Potato','carb','sweet potato'),
('irishpotato','Irish Potato','carb','boiled irish potato'),('friedfish','Fried Fish','protein','nigerian fried fish'),
('beans','Beans','protein','nigerian beans porridge'),('grilledchicken','Chicken','protein','grilled chicken nigerian'),
('beef','Beef / Assorted','protein','assorted beef meat nigerian'),('eggs','Eggs','protein','fried eggs nigerian'),
('turkey','Turkey','protein','nigerian turkey'),('banana','Banana','fruit','banana'),
('orange','Orange','fruit','orange fruit'),('mango','Mango','fruit','mango fruit'),
('pineapple','Pineapple','fruit','pineapple fruit'),('pawpaw','Pawpaw','fruit','pawpaw papaya fruit'),
('watermelon','Watermelon','fruit','watermelon fruit'),('avocado','Avocado','fruit','avocado pear'),
('guava','Guava','fruit','guava fruit'),('apple','Apple','fruit','apple fruit'),
('grapes','Grapes','fruit','grapes fruit'),('lemon','Lemon','fruit','lemon fruit'),
('lime','Lime','fruit','lime fruit'),('tangerine','Tangerine','fruit','tangerine fruit'),
('strawberry','Strawberry','fruit','strawberry fruit'),('soursop','Soursop','fruit','soursop fruit'),
('cucumber','Cucumber','fruit','cucumber'),('coleslaw','Coleslaw','fruit','coleslaw salad')
on conflict (id) do update set name = excluded.name, category = excluded.category, image_query = excluded.image_query;

insert into public.dish_aliases (dish_id, alias) values
('friedplantain', 'dodo'), ('pap', 'akamu'), ('pap', 'ogi'), ('ofensala', 'white soup'),
('bitterleaf', 'onugbu'), ('grilledchicken', 'chicken'), ('boiledyam', 'boiled yam')
on conflict (alias) do nothing;
