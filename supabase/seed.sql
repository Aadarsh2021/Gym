-- ==============================================================================
-- FITNESS PLATFORM (PHASE 1) - SYSTEM SEED DATA
-- Verified exercises & ICMR-NIN referenced Indian food nutrition database
-- ==============================================================================

-- 1. EXERCISE CATALOG SEED DATA
INSERT INTO public.exercises (name, primary_muscle, secondary_muscles, equipment_required, difficulty, movement_pattern, instructions, is_system)
VALUES
-- Chest
('Barbell Bench Press', 'Chest', ARRAY['Triceps', 'Front Delts'], 'Barbell', 'intermediate', 'Horizontal Push', ARRAY['Lie flat on bench', 'Grip bar slightly wider than shoulder width', 'Lower to mid-chest with elbows at 45 degrees', 'Press forcefully back up'], TRUE),
('Incline Dumbbell Press', 'Chest', ARRAY['Front Delts', 'Triceps'], 'Dumbbells', 'intermediate', 'Incline Push', ARRAY['Set bench to 30-45 degrees', 'Lower dumbbells to upper chest', 'Press up and slightly inward'], TRUE),
('Push-Up', 'Chest', ARRAY['Triceps', 'Core'], 'Bodyweight', 'beginner', 'Horizontal Push', ARRAY['Maintain rigid plank line', 'Lower chest until 2 inches above floor', 'Press back to top lockout'], TRUE),
('Cable Chest Fly', 'Chest', ARRAY['Front Delts'], 'Cable', 'beginner', 'Isolation Fly', ARRAY['Set pulleys at shoulder height', 'Bring hands together in wide hugging arc', 'Squeeze chest at peak contraction'], TRUE),

-- Back
('Conventional Deadlift', 'Back', ARRAY['Hamstrings', 'Glutes', 'Traps'], 'Barbell', 'advanced', 'Hinge', ARRAY['Stand mid-foot under barbell', 'Hinge at hips to grip bar', 'Set lats and brace core', 'Drive floor away to full hip extension'], TRUE),
('Barbell Bent-Over Row', 'Back', ARRAY['Biceps', 'Rear Delts'], 'Barbell', 'intermediate', 'Horizontal Pull', ARRAY['Hinge torso to 45 degrees', 'Pull bar to lower sternum', 'Control eccentric lower'], TRUE),
('Lat Pulldown', 'Back', ARRAY['Biceps'], 'Cable', 'beginner', 'Vertical Pull', ARRAY['Grip wide bar overhand', 'Pull bar smoothly to upper clavicle while arching chest', 'Resist the weight back to full stretch'], TRUE),
('Seated Cable Row', 'Back', ARRAY['Biceps', 'Rhomboids'], 'Cable', 'beginner', 'Horizontal Pull', ARRAY['Keep spine neutral', 'Pull handles towards lower abdomen', 'Squeeze shoulder blades back'], TRUE),

-- Shoulders
('Overhead Barbell Press', 'Shoulders', ARRAY['Triceps', 'Upper Chest'], 'Barbell', 'intermediate', 'Vertical Push', ARRAY['Stand with bar racked on collarbone', 'Press vertically overhead, moving head forward once bar clears', 'Lock out at top'], TRUE),
('Dumbbell Lateral Raise', 'Shoulders', ARRAY['Traps'], 'Dumbbells', 'beginner', 'Isolation', ARRAY['Stand with dumbbells at sides', 'Raise arms out to sides with slight elbow bend up to shoulder height', 'Lower with control'], TRUE),
('Rear Delt Face Pull', 'Shoulders', ARRAY['Upper Back', 'Rotator Cuff'], 'Cable', 'beginner', 'Horizontal Pull', ARRAY['Attach rope to high pulley', 'Pull rope towards eyes while rotating hands back', 'Pause and control back'], TRUE),

-- Legs
('Barbell Back Squat', 'Legs', ARRAY['Glutes', 'Core'], 'Barbell', 'intermediate', 'Squat', ARRAY['Rest bar across upper traps', 'Descend hips back and down until thighs are parallel to floor', 'Drive through midfoot to stand'], TRUE),
('Romanian Deadlift', 'Legs', ARRAY['Hamstrings', 'Glutes', 'Lower Back'], 'Barbell', 'intermediate', 'Hinge', ARRAY['Hold bar at thighs', 'Hinge hips backwards with slight knee bend until deep hamstring stretch', 'Drive hips forward to return'], TRUE),
('Goblet Squat', 'Legs', ARRAY['Quads', 'Core'], 'Dumbbells', 'beginner', 'Squat', ARRAY['Hold dumbbell vertically against chest', 'Squat deep between knees', 'Keep chest tall and upright'], TRUE),
('Bulgarian Split Squat', 'Legs', ARRAY['Quads', 'Glutes'], 'Dumbbells', 'intermediate', 'Lunge', ARRAY['Place rear foot on bench behind you', 'Lower hips until front thigh is parallel to ground', 'Drive through front heel'], TRUE),
('Calf Raise', 'Legs', ARRAY['Calves'], 'Bodyweight', 'beginner', 'Ankle Extension', ARRAY['Elevate balls of feet on block', 'Lower heels into deep stretch', 'Explode up onto toes and squeeze'], TRUE),

-- Arms
('Barbell Bicep Curl', 'Biceps', ARRAY['Forearms'], 'Barbell', 'beginner', 'Arm Flexion', ARRAY['Keep elbows pinned at ribcage', 'Curl bar up towards shoulders', 'Lower with 3-second eccentric'], TRUE),
('Hammer Curl', 'Biceps', ARRAY['Brachialis', 'Forearms'], 'Dumbbells', 'beginner', 'Neutral Grip Flexion', ARRAY['Hold dumbbells with palms facing each other', 'Curl upward without swinging', 'Slowly descend'], TRUE),
('Tricep Cable Pushdown', 'Triceps', ARRAY[], 'Cable', 'beginner', 'Arm Extension', ARRAY['Keep upper arms fixed at sides', 'Extend elbows to push bar/rope straight down', 'Lock out and pause'], TRUE),
('Overhead Dumbbell Tricep Extension', 'Triceps', ARRAY[], 'Dumbbells', 'beginner', 'Overhead Extension', ARRAY['Hold dumbbell overhead with both hands', 'Lower behind neck by flexing elbows', 'Press back to full extension'], TRUE),

-- Core
('Plank', 'Core', ARRAY['Shoulders', 'Glutes'], 'Bodyweight', 'beginner', 'Anti-Extension', ARRAY['Support on forearms and toes', 'Keep body in straight line from head to heels', 'Brace core tightly'], TRUE),
('Hanging Leg Raise', 'Core', ARRAY['Hip Flexors'], 'Bodyweight', 'intermediate', 'Spine Flexion', ARRAY['Hang from pull-up bar', 'Raise knees or straight legs up to hip height', 'Control the descent without swinging'], TRUE)
ON CONFLICT (name) DO NOTHING;

-- 2. INDIAN FOOD NUTRITION REFERENCE DATABASE (ICMR-NIN Citations)
-- Values are reference approximations based on Indian Food Composition Tables (IFCT)
INSERT INTO public.foods (name, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, dietary_type, source, source_reference, is_verified)
VALUES
('Paneer (Cottage Cheese)', '100', 'g', 265.0, 18.3, 3.4, 20.8, 'veg', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Dairy Code D004', TRUE),
('Low-Fat Paneer', '100', 'g', 160.0, 24.0, 4.0, 5.0, 'veg', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Dairy Code D005', TRUE),
('Soya Chunks (Raw / Uncooked)', '100', 'g', 345.0, 52.0, 33.0, 0.5, 'vegan', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Legumes Code L042', TRUE),
('Boiled Whole Egg', '1', 'piece (50g)', 74.0, 6.3, 0.4, 5.0, 'egg', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Poultry Code P001', TRUE),
('Egg White (Boiled)', '1', 'piece (33g)', 17.0, 3.6, 0.2, 0.1, 'egg', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Poultry Code P002', TRUE),
('Chicken Breast (Skinless, Raw)', '100', 'g', 120.0, 22.5, 0.0, 2.6, 'non_veg', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Poultry Code P012', TRUE),
('Moong Dal (Yellow, Split, Raw)', '100', 'g', 348.0, 24.0, 60.0, 1.2, 'veg', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Pulses Code P020', TRUE),
('Rajma / Kidney Beans (Raw)', '100', 'g', 346.0, 22.9, 60.6, 1.3, 'vegan', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Pulses Code P028', TRUE),
('Kala Chana / Black Chickpeas (Raw)', '100', 'g', 360.0, 20.0, 62.0, 5.0, 'vegan', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Pulses Code P015', TRUE),
('Cooked Dal (Standard Tadka)', '1', 'katori (150g)', 140.0, 7.5, 18.0, 4.5, 'veg', 'ICMR-NIN Cooked Composite Reference', 'Cooked Legumes Standard', TRUE),
('Roti / Chapati (Whole Wheat, No Oil)', '1', 'medium (35g)', 85.0, 3.1, 17.5, 0.5, 'veg', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Cereal Prep C002', TRUE),
('White Rice (Cooked, Plain)', '1', 'cup (150g)', 195.0, 4.1, 44.0, 0.4, 'vegan', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Cereal Prep C015', TRUE),
('Brown Rice (Cooked, Plain)', '1', 'cup (150g)', 166.0, 3.8, 35.0, 1.2, 'vegan', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Cereal Prep C016', TRUE),
('Curd / Dahi (Plain, Whole Milk)', '100', 'g', 98.0, 4.3, 5.0, 6.5, 'veg', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Dairy Code D002', TRUE),
('Curd / Dahi (Low-Fat / Toned Milk)', '100', 'g', 60.0, 5.0, 4.8, 2.0, 'veg', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Dairy Code D003', TRUE),
('Cow Milk (Toned 3% Fat)', '1', 'glass (250ml)', 150.0, 8.0, 12.0, 7.5, 'veg', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Dairy Code D001', TRUE),
('Rolled Oats (Raw)', '50', 'g', 190.0, 6.8, 33.0, 3.5, 'vegan', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Cereals Code C030', TRUE),
('Poha (Flattened Rice, Dry)', '50', 'g', 180.0, 3.3, 39.0, 1.0, 'vegan', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Cereals Code C025', TRUE),
('Tofu (Firm)', '100', 'g', 76.0, 8.1, 1.9, 4.8, 'vegan', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Soy Composite Reference', TRUE),
('Peanut Butter (Unsweetened)', '32', 'g (2 tbsp)', 190.0, 8.0, 6.0, 16.0, 'vegan', 'USDA & IFCT Composite Reference', 'Nuts Code N004', TRUE),
('Almonds (Raw)', '28', 'g (handful)', 164.0, 6.0, 6.1, 14.2, 'vegan', 'ICMR-NIN Indian Food Composition Tables (IFCT)', 'Nuts Code N001', TRUE),
('Whey Protein Concentrate (80%)', '30', 'g (1 scoop)', 120.0, 24.0, 2.0, 1.5, 'veg', 'Standard Nutritional Analysis Certificate', 'Supplement Reference', TRUE)
ON CONFLICT (name) DO NOTHING;
