import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('SEO & Semantic Document Structure Suite (Batch 5 Corrected)', () => {
  const rootDir = process.cwd();

  describe('robots.txt Validation', () => {
    const robotsPath = path.resolve(rootDir, 'public/robots.txt');
    const content = fs.readFileSync(robotsPath, 'utf-8');

    it('allows public discovery routes and disallows authenticated /app/ routes', () => {
      expect(content).toContain('User-agent: *');
      expect(content).toContain('Allow: /');
      expect(content).toContain('Allow: /pricing');
      expect(content).toContain('Disallow: /app/');
      expect(content).toContain('Disallow: /auth/');
      expect(content).toContain('Disallow: /onboarding/');
      expect(content).toContain('Sitemap: https://gymbuddy-da185.web.app/sitemap.xml');
    });
  });

  describe('sitemap.xml Validation', () => {
    const sitemapPath = path.resolve(rootDir, 'public/sitemap.xml');
    const content = fs.readFileSync(sitemapPath, 'utf-8');

    it('contains all authoritative Phase 1 public routes including /pricing', () => {
      expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(content).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

      const expectedUrls = [
        'https://gymbuddy-da185.web.app/',
        'https://gymbuddy-da185.web.app/how-it-works',
        'https://gymbuddy-da185.web.app/workouts',
        'https://gymbuddy-da185.web.app/exercises',
        'https://gymbuddy-da185.web.app/nutrition',
        'https://gymbuddy-da185.web.app/tools',
        'https://gymbuddy-da185.web.app/tools/calorie-calculator',
        'https://gymbuddy-da185.web.app/tools/protein-calculator',
        'https://gymbuddy-da185.web.app/pricing',
        'https://gymbuddy-da185.web.app/signin',
        'https://gymbuddy-da185.web.app/signup',
      ];

      for (const url of expectedUrls) {
        expect(content).toContain(`<loc>${url}</loc>`);
      }
    });
  });

  describe('index.html Meta & Structured Data Validation', () => {
    const indexPath = path.resolve(rootDir, 'index.html');
    const content = fs.readFileSync(indexPath, 'utf-8');

    it('has canonical link tag pointing to production root', () => {
      expect(content).toContain('<link rel="canonical" href="https://gymbuddy-da185.web.app/" />');
    });

    it('contains OpenGraph and Twitter Card metadata tags', () => {
      expect(content).toContain('<meta property="og:site_name" content="APEXFIT" />');
      expect(content).toContain('<meta property="og:title"');
      expect(content).toContain('<meta property="og:description"');
      expect(content).toContain('<meta name="twitter:card" content="summary_large_image" />');
      expect(content).toContain('<meta name="twitter:title"');
      expect(content).toContain('<meta name="twitter:description"');
    });

    it('contains valid JSON-LD Structured Data Schema with Free + Premium offerings', () => {
      expect(content).toContain('application/ld+json');
      expect(content).toContain('"@type": "WebApplication"');
      expect(content).toContain('"name": "APEXFIT"');
      expect(content).toContain('"Free Athlete"');
      expect(content).toContain('"Premium Athlete"');
    });
  });

  describe('Single <h1> Semantic Heading Hierarchy Audit', () => {
    const viewsToCheck = [
      'src/features/public-home/PublicHomeView.tsx',
      'src/features/public-pages/HowItWorksView.tsx',
      'src/features/public-pages/PublicWorkoutsView.tsx',
      'src/features/public-pages/PublicNutritionView.tsx',
      'src/features/public-pages/PublicToolsView.tsx',
      'src/features/public-pages/PricingView.tsx',
      'src/features/exercise-library/ExerciseLibraryView.tsx',
    ];

    it('verifies that each public marketing view contains exactly one <h1> element', () => {
      viewsToCheck.forEach(relPath => {
        const filePath = path.resolve(rootDir, relPath);
        const code = fs.readFileSync(filePath, 'utf-8');
        const matches = code.match(/<h1[\s>]/g);
        expect(matches, `${relPath} must have exactly one <h1> element`).not.toBeNull();
        expect(matches?.length, `${relPath} must have exactly one <h1> element`).toBe(1);
      });
    });
  });
});
