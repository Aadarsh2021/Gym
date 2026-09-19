import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Desktop Stationary Sidebar Architecture Contract', () => {
  const layoutCssPath = path.resolve(__dirname, '../../src/styles/layout.css');
  const ownerAppShellPath = path.resolve(__dirname, '../../src/layouts/OwnerAppShell.tsx');
  const appShellPath = path.resolve(__dirname, '../../src/layouts/AppShell.tsx');

  const layoutCss = fs.readFileSync(layoutCssPath, 'utf8');
  const ownerAppShell = fs.readFileSync(ownerAppShellPath, 'utf8');
  const appShell = fs.readFileSync(appShellPath, 'utf8');

  it('enforces position: fixed on .app-sidebar on desktop (>= 1024px)', () => {
    const desktopMediaMatch = layoutCss.match(/@media\s*\(min-width:\s*1024px\)[\s\S]*?@media\s*\(max-width:\s*1023px\)/);
    expect(desktopMediaMatch).toBeTruthy();
    const desktopCss = desktopMediaMatch![0];

    expect(desktopCss).toMatch(/\.app-sidebar\s*\{[\s\S]*?position:\s*fixed;/);
    expect(desktopCss).toMatch(/\.app-sidebar\s*\{[\s\S]*?top:\s*0;/);
    expect(desktopCss).toMatch(/\.app-sidebar\s*\{[\s\S]*?left:\s*0;/);
    expect(desktopCss).toMatch(/\.app-sidebar\s*\{[\s\S]*?width:\s*275px;/);
  });

  it('strictly forbids overflow-y: auto and overflow-y: scroll on .app-sidebar', () => {
    // Must not allow internal scrolling containers on the sidebar
    expect(layoutCss).not.toMatch(/\.app-sidebar\s*\{[^}]*overflow-y:\s*auto/);
    expect(layoutCss).not.toMatch(/\.app-sidebar\s*\{[^}]*overflow-y:\s*scroll/);
    expect(layoutCss).toMatch(/\.app-sidebar\s*\{[\s\S]*?overflow:\s*hidden;/);
  });

  it('offsets .app-main-wrapper by 275px margin on desktop to accommodate fixed sidebar', () => {
    expect(layoutCss).toMatch(/\.app-main-wrapper\s*\{[\s\S]*?margin-left:\s*275px;/);
  });

  it('strictly forbids overflow-y: auto on desktop sidebar navigation in OwnerAppShell', () => {
    const asideMatch = ownerAppShell.match(/<aside className="app-sidebar"[\s\S]*?<\/aside>/);
    expect(asideMatch).toBeTruthy();
    const asideContent = asideMatch![0];
    expect(asideContent).not.toContain("overflowY: 'auto'");
    expect(asideContent).not.toContain('overflowY: "auto"');
    expect(asideContent).not.toContain('overflow-y: auto');
  });

  it('preserves mobile isolation (< 1024px) hiding desktop sidebar and resetting main wrapper margin', () => {
    const mobileMediaMatch = layoutCss.match(/@media\s*\(max-width:\s*1023px\)[\s\S]*?\/\*\s*Sidebar Inner Components/);
    expect(mobileMediaMatch).toBeTruthy();
    const mobileCss = mobileMediaMatch![0];

    expect(mobileCss).toMatch(/\.app-sidebar\s*\{[\s\S]*?display:\s*none\s*!important;/);
    expect(mobileCss).toMatch(/\.app-main-wrapper\s*\{[\s\S]*?margin-left:\s*0\s*!important;/);
  });

  it('ensures both AppShell and OwnerAppShell use .app-shell-layout and .app-sidebar semantic elements', () => {
    expect(appShell).toContain('className="app-shell-layout"');
    expect(appShell).toContain('className="app-sidebar"');
    expect(ownerAppShell).toContain('className="app-shell-layout"');
    expect(ownerAppShell).toContain('className="app-sidebar"');
  });
});
