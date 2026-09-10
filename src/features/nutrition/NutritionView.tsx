import React, { useState, useEffect } from 'react';
import { Search, Utensils, Info, ShieldCheck } from 'lucide-react';
import { nutritionService } from '@/services/nutrition.service';
import { FoodItem, NutritionProfile } from '@/types/nutrition.types';

interface NutritionViewProps {
  nutritionProfile: NutritionProfile | null;
}

export const NutritionView: React.FC<NutritionViewProps> = ({ nutritionProfile }) => {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [search, setSearch] = useState('');
  const [dietFilter, setDietFilter] = useState('all');

  useEffect(() => {
    async function loadFoods() {
      const data = await nutritionService.getFoods(search, dietFilter);
      setFoods(data);
    }
    loadFoods();
  }, [search, dietFilter]);

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-6) var(--space-4)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
          <span className="badge badge-cyan">Indian Nutrition System</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ICMR-NIN Reference</span>
        </div>
        <h1>Personalized Nutrition & Protein Analyzer</h1>
        <p>Deterministic macronutrient targets and reference nutritional analysis for Indian foods.</p>
      </div>

      {/* Target Macros Cards */}
      <div className="card card-elevated" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <div className="card">
          <small>Target Calories</small>
          <h2>{nutritionProfile ? nutritionProfile.targetCalories : 2200} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>kcal</span></h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Daily Energy Requirement</span>
        </div>

        <div className="card" style={{ borderColor: 'rgba(0, 240, 255, 0.3)' }}>
          <small style={{ color: 'var(--accent-secondary)' }}>Target Protein</small>
          <h2 style={{ color: 'var(--accent-secondary)' }}>
            {nutritionProfile ? nutritionProfile.targetProteinG : 140} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>g</span>
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hypertrophy / Recovery</span>
        </div>

        <div className="card">
          <small>Carbohydrates</small>
          <h2>{nutritionProfile ? nutritionProfile.targetCarbsG : 240} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>g</span></h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Clean Energy Stores</span>
        </div>

        <div className="card">
          <small>Healthy Fats</small>
          <h2>{nutritionProfile ? nutritionProfile.targetFatG : 60} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>g</span></h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hormonal Balance (25%)</span>
        </div>
      </div>

      {/* Sample Personalized Indian Meal Structure */}
      <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <Utensils size={20} color="var(--accent-primary)" />
          <h3>Sample Daily High-Protein Meal Plan</h3>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
          {[
            { meal: 'Breakfast', foods: '3 Boiled Eggs (or 100g Tofu) + 50g Rolled Oats with Milk', protein: '~25g' },
            { meal: 'Lunch', foods: '2 Whole Wheat Rotis + 1 Katori Moong Dal + 100g Low-Fat Paneer + Salad', protein: '~35g' },
            { meal: 'Evening Snack', foods: '50g Roasted Chana or 1 Scoop Whey + 1 Banana', protein: '~26g' },
            { meal: 'Dinner', foods: '50g Cooked Soya Chunks (or 150g Chicken Breast) + 1 Cup Rice + Curd', protein: '~38g' },
          ].map((item, idx) => (
            <div key={idx} style={{ padding: 'var(--space-3)', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{item.meal}</span>
                <span className="badge badge-lime">{item.protein}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.foods}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Indian Food Database / Protein Analyzer */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div>
            <h3>Indian Food Database & Protein Analyzer</h3>
            <p style={{ fontSize: '0.875rem' }}>Reference macros per standard serving based on ICMR-NIN Indian Food Composition Tables.</p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {(['all', 'veg', 'vegan', 'egg', 'non_veg'] as const).map(type => (
              <button
                key={type}
                className={`btn btn-sm ${dietFilter === type ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDietFilter(type)}
                style={{ textTransform: 'capitalize' }}
              >
                {type.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
          <input
            type="text"
            className="input"
            placeholder="Search Paneer, Soya Chunks, Dal, Eggs, Chicken, Rice..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>

        {/* Food Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                <th style={{ padding: 'var(--space-3)' }}>FOOD</th>
                <th style={{ padding: 'var(--space-3)' }}>PORTION</th>
                <th style={{ padding: 'var(--space-3)' }}>PROTEIN</th>
                <th style={{ padding: 'var(--space-3)' }}>CALORIES</th>
                <th style={{ padding: 'var(--space-3)' }}>CARBS / FAT</th>
                <th style={{ padding: 'var(--space-3)' }}>SOURCE REFERENCE</th>
              </tr>
            </thead>
            <tbody>
              {foods.map(f => (
                <tr key={f.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: 'var(--space-3)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {f.name}
                  </td>
                  <td style={{ padding: 'var(--space-3)', color: 'var(--text-secondary)' }}>
                    {f.servingSize} {f.servingUnit}
                  </td>
                  <td style={{ padding: 'var(--space-3)', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                    {f.proteinG}g
                  </td>
                  <td style={{ padding: 'var(--space-3)', fontWeight: 600 }}>
                    {f.calories} kcal
                  </td>
                  <td style={{ padding: 'var(--space-3)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {f.carbsG}g / {f.fatG}g
                  </td>
                  <td style={{ padding: 'var(--space-3)', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldCheck size={14} color="var(--accent-success)" />
                      {f.sourceReference || f.source}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Nutritional Disclaimer */}
        <div style={{
          marginTop: 'var(--space-6)',
          padding: 'var(--space-3)',
          background: 'rgba(255, 184, 0, 0.08)',
          border: '1px solid rgba(255, 184, 0, 0.25)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8rem',
          color: 'var(--accent-amber)',
          display: 'flex',
          gap: 'var(--space-2)',
          alignItems: 'center',
        }}>
          <Info size={18} style={{ flexShrink: 0 }} />
          <span>
            <strong>Reference Notice:</strong> Values listed are standard laboratory reference approximations. Actual nutritional content varies depending on cooking medium (ghee/oil), brand, portion size, and culinary preparation.
          </span>
        </div>
      </div>
    </div>
  );
};
