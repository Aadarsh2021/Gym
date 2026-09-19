import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  Layers,
  PieChart,
  ShieldCheck,
} from 'lucide-react';
import { FoodItem, MixedMealItem, MealSlot, NutritionProfile } from '@/types/nutrition.types';
import { calculateMixedMealTotals } from '@/domain/mixed-meal-analyzer';
import { foodDiaryService } from '@/services/food-diary.service';

interface MixedMealAnalyzerViewProps {
  catalog: FoodItem[];
  nutritionProfile: NutritionProfile | null;
  userId: string;
  onLogComplete?: () => void;
}

export const MixedMealAnalyzerView: React.FC<MixedMealAnalyzerViewProps> = ({
  catalog,
  nutritionProfile,
  userId,
  onLogComplete,
}) => {
  // Plate items state
  const [items, setItems] = useState<MixedMealItem[]>(() => {
    // Default to the authoritative test plate: 2 Roti + Dal + Paneer + Salad
    const roti = catalog.find(f => f.name.includes('Roti'));
    const dal = catalog.find(f => f.name.includes('Cooked Dal'));
    const paneer = catalog.find(f => f.name === 'Paneer (Cottage Cheese)');
    const salad = catalog.find(f => f.name.includes('Green Salad'));

    const initial: MixedMealItem[] = [];
    if (roti) initial.push({ id: 'plate-1', food: roti, servings: 2 });
    if (dal) initial.push({ id: 'plate-2', food: dal, servings: 1 });
    if (paneer) initial.push({ id: 'plate-3', food: paneer, servings: 1 });
    if (salad) initial.push({ id: 'plate-4', food: salad, servings: 1 });

    return initial.length > 0 ? initial : [];
  });

  const [selectedFoodId, setSelectedFoodId] = useState<string>(catalog[0]?.id || '');
  const [selectedServings, setSelectedServings] = useState<number>(1.0);
  const [targetSlot, setTargetSlot] = useState<MealSlot>('lunch');
  const [logging, setLogging] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const dailyTargets = useMemo(() => {
    if (!nutritionProfile) return { calories: 2200, proteinG: 140 };
    return {
      calories: nutritionProfile.targetCalories,
      proteinG: nutritionProfile.targetProteinG,
    };
  }, [nutritionProfile]);

  // Real-time deterministic calculation
  const analysis = useMemo(() => {
    return calculateMixedMealTotals(items, dailyTargets);
  }, [items, dailyTargets]);

  const handleAddItem = () => {
    const food = catalog.find(f => f.id === selectedFoodId);
    if (!food) return;

    // Check if already in plate -> increment serving
    const existingIdx = items.findIndex(i => i.food.id === food.id);
    if (existingIdx >= 0) {
      const updated = [...items];
      updated[existingIdx].servings =
        Math.round((updated[existingIdx].servings + selectedServings) * 4) / 4;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          id: `plate-${Date.now()}-${Math.random()}`,
          food,
          servings: selectedServings,
        },
      ]);
    }
  };

  const handleUpdateServings = (id: string, newServings: number) => {
    if (newServings <= 0) {
      handleRemoveItem(id);
      return;
    }
    setItems(items.map(i => (i.id === id ? { ...i, servings: newServings } : i)));
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const handleLoadClassicPlate = () => {
    const roti = catalog.find(f => f.name.includes('Roti')) || catalog[0];
    const dal = catalog.find(f => f.name.includes('Cooked Dal')) || catalog[1];
    const paneer = catalog.find(f => f.name.includes('Paneer')) || catalog[2];
    const salad = catalog.find(f => f.name.includes('Green Salad')) || catalog[3];

    setItems([
      { id: `classic-1`, food: roti, servings: 2 },
      { id: `classic-2`, food: dal, servings: 1 },
      { id: `classic-3`, food: paneer, servings: 1 },
      { id: `classic-4`, food: salad, servings: 1 },
    ]);
  };

  const handleLogEntireMeal = async () => {
    if (items.length === 0) return;
    setLogging(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      for (const it of items) {
        await foodDiaryService.logFoodEntry({
          userId,
          loggedDate: today,
          mealType: targetSlot,
          foodId: it.food.id,
          customFoodName: null,
          foodName: it.food.name,
          servings: it.servings,
          calories: Math.round(it.food.calories * it.servings),
          proteinG: Math.round(it.food.proteinG * it.servings * 10) / 10,
          carbsG: Math.round(it.food.carbsG * it.servings * 10) / 10,
          fatG: Math.round(it.food.fatG * it.servings * 10) / 10,
        });
      }

      setSuccessMsg(`Successfully logged entire mixed meal (${items.length} items) to ${targetSlot}!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      if (onLogComplete) onLogComplete();
    } catch {
      // Fallback
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* View Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
            <span className="badge badge-accent" style={{ fontSize: '0.72rem' }}>
              PREMIUM V1
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Multi-Ingredient Recipe & Plate Deconstruction</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.75rem' }}>Mixed Meal & Composite Plate Analyzer</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0', fontSize: '0.92rem' }}>
            Calculate combined macronutrients, dietary fiber, and individual ingredient contributions for complex Indian meals.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleLoadClassicPlate}
            title="Load standard 2 Roti + Dal + Paneer + Salad plate"
          >
            <Sparkles size={14} color="var(--accent-primary)" /> Load Classic Plate
          </button>
          {items.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setItems([])}
            >
              Clear Plate
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-success-muted)',
            border: '1px solid var(--color-success)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-success)',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Left Column: Plate Builder */}
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <h3 style={{ margin: '0 0 var(--space-4)', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Layers size={18} color="var(--accent-primary)" />
            <span>Plate Ingredients ({items.length})</span>
          </h3>

          {/* Add Item Bar */}
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-4)',
              flexWrap: 'wrap',
              background: 'var(--color-surface-subtle)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <select
              className="select select-sm"
              value={selectedFoodId}
              onChange={e => setSelectedFoodId(e.target.value)}
              style={{ flex: 1, minWidth: '180px' }}
            >
              {catalog.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.servingSize} {f.servingUnit})
                </option>
              ))}
            </select>

            <input
              type="number"
              step="0.25"
              min="0.25"
              max="10"
              value={selectedServings}
              onChange={e => setSelectedServings(parseFloat(e.target.value) || 1)}
              className="input input-sm"
              style={{ width: '70px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}
              title="Serving multiplier"
            />

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleAddItem}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={15} /> Add to Plate
            </button>
          </div>

          {/* Items List */}
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--text-muted)' }}>
              <p>Your mixed plate is empty. Add food items or click "Load Classic Plate" above.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {items.map(it => (
                <div
                  key={it.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--space-3)',
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {it.food.name}
                      </strong>
                      <span className="badge" style={{ fontSize: '0.65rem' }}>
                        {it.food.dietaryType}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                      {Math.round(it.food.calories * it.servings)} kcal •{' '}
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                        {Math.round(it.food.proteinG * it.servings * 10) / 10}g P
                      </span>{' '}
                      • {Math.round(it.food.carbsG * it.servings * 10) / 10}g C •{' '}
                      {Math.round(it.food.fatG * it.servings * 10) / 10}g F
                    </div>
                  </div>

                  {/* Quantity Controller */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      max="10"
                      value={it.servings}
                      onChange={e => handleUpdateServings(it.id, parseFloat(e.target.value) || 0)}
                      className="input input-sm"
                      style={{ width: '60px', textAlign: 'center', fontFamily: 'var(--font-mono)', padding: '4px' }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleRemoveItem(it.id)}
                      style={{ padding: '4px', color: '#EF4444' }}
                      title="Remove from meal"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Action: Log to Food Diary */}
          {items.length > 0 && (
            <div
              style={{
                marginTop: 'var(--space-6)',
                paddingTop: 'var(--space-4)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Log To:</span>
                <select
                  className="select select-sm"
                  value={targetSlot}
                  onChange={e => setTargetSlot(e.target.value as MealSlot)}
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="snack">Evening Snack</option>
                  <option value="dinner">Dinner</option>
                </select>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleLogEntireMeal}
                disabled={logging}
              >
                {logging ? 'Logging...' : 'Log Entire Plate to Diary →'}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Macro Analysis & Per-Food Contribution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Combined Totals Card */}
          <div className="card card-elevated" style={{ padding: 'var(--space-5)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Combined Plate Nutrition
            </span>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', margin: 'var(--space-2) 0 var(--space-4)' }}>
              <span style={{ fontSize: '2.4rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', lineHeight: 1 }}>
                {analysis.totalCalories}
              </span>
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>total kcal</span>
            </div>

            {/* Macro Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)', textAlign: 'center' }}>
              <div style={{ background: 'var(--color-surface-subtle)', padding: 'var(--space-2)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Protein</span>
                <strong style={{ fontSize: '1.1rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                  {analysis.totalProteinG}g
                </strong>
              </div>
              <div style={{ background: 'var(--color-surface-subtle)', padding: 'var(--space-2)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Carbs</span>
                <strong style={{ fontSize: '1.1rem', fontFamily: 'var(--font-mono)', color: '#38BDF8' }}>
                  {analysis.totalCarbsG}g
                </strong>
              </div>
              <div style={{ background: 'var(--color-surface-subtle)', padding: 'var(--space-2)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Fats</span>
                <strong style={{ fontSize: '1.1rem', fontFamily: 'var(--font-mono)', color: 'var(--color-warning)' }}>
                  {analysis.totalFatG}g
                </strong>
              </div>
              <div style={{ background: 'var(--color-surface-subtle)', padding: 'var(--space-2)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Dietary Fiber</span>
                <strong style={{ fontSize: '1.1rem', fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>
                  {analysis.totalFiberG}g
                </strong>
              </div>
            </div>

            {/* Daily Target Coverage Indicator */}
            {analysis.dailyCoverage && (
              <div
                style={{
                  marginTop: 'var(--space-4)',
                  paddingTop: 'var(--space-3)',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                  <strong>Daily Athlete Target Impact:</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span>Calorie Budget Coverage:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{analysis.dailyCoverage.percentOfDailyCalories}%</strong>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'var(--bg-input)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, analysis.dailyCoverage.percentOfDailyCalories)}%`, height: '100%', background: 'var(--text-primary)' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span>Protein Goal Coverage:</span>
                      <strong style={{ color: 'var(--accent-primary)' }}>{analysis.dailyCoverage.percentOfDailyProtein}%</strong>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'var(--bg-input)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, analysis.dailyCoverage.percentOfDailyProtein)}%`, height: '100%', background: 'var(--accent-primary)' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Per-Food Contribution Breakdown */}
          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <h4 style={{ margin: '0 0 var(--space-3)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <PieChart size={16} color="var(--accent-primary)" />
              <span>Ingredient Contribution Breakdown</span>
            </h4>

            {analysis.contributions.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Add items to see relative macronutrient contributions.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {analysis.contributions.map((c, idx) => (
                  <div key={idx} style={{ fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.foodName}</span>
                      <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {c.proteinG}g P ({c.percentOfMealProtein}%) • {c.calories} kcal ({c.percentOfMealCalories}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'var(--bg-input)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${c.percentOfMealProtein}%`,
                          height: '100%',
                          background: 'var(--accent-primary)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scientific Disclaimer */}
          <div
            style={{
              padding: 'var(--space-3)',
              background: 'rgba(59, 75, 107, 0.15)',
              border: '1px solid var(--accent-indigo)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              gap: 'var(--space-2)',
              alignItems: 'flex-start',
              fontSize: '0.73rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.45,
            }}
          >
            <ShieldCheck size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong style={{ color: 'var(--text-primary)' }}>Nutritional Reference: </strong>
              All food data is sourced from verified ICMR-NIN Indian Food Composition Tables (IFCT) and certified composite analyses. Intended for fitness planning and general health, not medical diagnosis or clinical dietetics.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
