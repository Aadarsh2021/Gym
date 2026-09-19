# Product Requirements Document (PRD) — Fitness Coin Rewards Shop

## 1. Objectives & Value Proposition
FitSphere athletes accumulate Fitness Coins through consistent personal training, hitting personal records, logging meals, and maintaining attendance streaks. The Rewards Shop gives meaning to these coins by offering a software-only catalog of digital perks, profile badges, partner discount codes, and app themes.

## 2. Distinction Between Reward Systems

| Dimension | Personal Fitness Coins (This Feature) | Gym Attendance Rewards (Phase G1) |
| :--- | :--- | :--- |
| **Currency** | Fitness Coins (`public.fitness_coins`) | Gym Attendance Check-In Days |
| **Earning Source** | Workouts, PRs, nutrition logging | Scanning gym QR code at facility |
| **Catalog Scope** | App-wide digital perks & partner codes | Facility-specific perks created by gym owner |
| **Redemption Actor** | Any authenticated athlete | Enrolled member of that specific gym |
| **Authoritative Table** | `public.fitness_reward_catalog` | `public.gym_rewards` |

---

## 3. Product Contract
1. **No Client-Supplied Balances**: Coin balances are never trusted from client payloads. The server computes balance from `public.fitness_coins` ledger (`SUM(amount)`).
2. **No Client-Supplied Prices**: The debit amount is pulled authoritatively from `fitness_reward_catalog.coin_cost`.
3. **Atomic Debit & Claim Code Issuance**: When an athlete redeems a perk:
   - Coin ledger is debited (`amount = -coin_cost`, `source = 'reward_redemption'`).
   - A unique claim code (e.g. `RWD-4A9B2C...`) is generated.
   - The transaction is recorded in `fitness_reward_redemptions`.
4. **No Payment Processing**: Strictly coins-only. No credit cards, Stripe, or fiat payment processing.
