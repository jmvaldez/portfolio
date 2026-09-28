export interface BudgetRow {
  name: string;
  budget: number;
  actual: number;
  unit: 'B' | 'count';
  ok: boolean;
}

export const BUDGETS: Record<string, number>;
export function checkContentPages(dist: string): BudgetRow[];
export function checkPageAssets(dist: string): BudgetRow[];
export function checkShellAndAssets(dist: string): BudgetRow[];
export function checkBudgets(dist: string): BudgetRow[];
