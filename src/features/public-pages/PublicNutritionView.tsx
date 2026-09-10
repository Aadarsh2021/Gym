import React from 'react';
import { Link } from 'react-router-dom';

export const PublicNutritionView: React.FC = () => {
  const highProteinIndianFoods = [
    { name: 'Soya Chunks', protein: '52g protein per 100g', type: 'Vegetarian', desc: 'Highest protein density in plant kingdom. Complete amino acid spectrum.' },
    { name: 'Low-Fat Paneer', protein: '20g protein per 100g', type: 'Vegetarian', desc: 'Slow-digesting casein protein, ideal for overnight muscle protein synthesis.' },
    { name: 'Sprouted Moong Dal', protein: '24g protein per 100g (raw)', type: 'Vegetarian', desc: 'Rich in leucine, fiber, and gut-friendly micronutrients.' },
    { name: 'Chicken Breast', protein: '31g protein per 100g', type: 'Non-Vegetarian', desc: 'Gold-standard lean protein with near-zero carbohydrate and fat content.' },
    { name: 'Whole Eggs & Whites', protein: '6g protein per egg', type: 'Eggetarian', desc: 'Biological value of 100 with essential choline and healthy fats.' },
    { name: 'Curd / Greek Dahi', protein: '10g protein per 100g', type: 'Vegetarian', desc: 'Probiotic-rich dairy protein aiding digestive enzyme production.' },
  ];

  return (
    <div className="container animate-fade-in" style={{ padding: 'var(--space-8) var(--space-4) var(--space-12)' }}>
      {/* Header */}
      <div style={{ maxWidth: '720px', margin: '0 auto var(--space-10)', textAlign: 'center' }}>
        <span className="badge badge-accent" style={{ marginBottom: 'var(--space-2)' }}>Nutritional Science</span>
        <h1>Indian-Context Hypertrophy Nutrition</h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
          Grounded in the ICMR-NIN food composition database. Tailored for both vegetarian and non-vegetarian lifters.
        </p>
      </div>

      {/* Core Principles */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-10)' }}>
        <div className="card" style={{ padding: 'var(--space-6)', borderColor: 'var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <span className="badge badge-accent">Rule 1</span>
            <h3 style={{ fontSize: '1.15rem' }}>1.6g - 2.2g Protein / kg</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            International sports nutrition standards confirm maximum muscle protein synthesis occurs between 1.6 and 2.2 grams of protein per kilogram of body mass.
          </p>
        </div>

        <div className="card" style={{ padding: 'var(--space-6)', borderColor: 'var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <span className="badge badge-accent">Rule 2</span>
            <h3 style={{ fontSize: '1.15rem' }}>Caloric Control (MSJ)</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Basal Metabolic Rate calculated via the clinical Mifflin-St Jeor formula. Modulate caloric intake by ±300-500 kcal depending on whether your goal is fat loss or lean mass accumulation.
          </p>
        </div>

        <div className="card" style={{ padding: 'var(--space-6)', borderColor: 'var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <span className="badge badge-accent">Rule 3</span>
            <h3 style={{ fontSize: '1.15rem' }}>Vegetarian Optimization</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Traditional Indian diets are heavy in carbs and low in protein. We provide realistic vegetarian meal templates to hit 140g+ protein without extreme expense.
          </p>
        </div>
      </div>

      {/* High-Protein Foods Table */}
      <div style={{ maxWidth: '800px', margin: '0 auto var(--space-12)' }}>
        <h2 style={{ marginBottom: 'var(--space-4)', textAlign: 'center' }}>Key Indian Protein Powerhouses</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          {highProteinIndianFoods.map(food => (
            <div key={food.name} className="card" style={{ padding: 'var(--space-4)', borderColor: 'var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                <h4 style={{ fontSize: '1.05rem' }}>{food.name}</h4>
                <span className="badge badge-secondary">{food.type}</span>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', marginBottom: 'var(--space-2)' }}>
                {food.protein}
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                {food.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Tool Banner */}
      <div
        className="card"
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          textAlign: 'center',
          padding: 'var(--space-8) var(--space-6)',
          borderColor: 'var(--accent-primary)',
          background: 'var(--bg-surface-elevated)',
        }}
      >
        <h3>Calculate Your Personal Daily Protein & Calories</h3>
        <p style={{ color: 'var(--text-secondary)', margin: 'var(--space-2) auto var(--space-6)', maxWidth: '500px' }}>
          Use our free, instant calculator to see your target calories and protein breakdown right now.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/tools/protein" className="btn btn-secondary">
            Protein Calculator
          </Link>
          <Link to="/tools/bmr" className="btn btn-primary">
            BMR & TDEE Calculator
          </Link>
        </div>
      </div>
    </div>
  );
};
