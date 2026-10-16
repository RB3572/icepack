/**
 * Equilibrium concentrations of a dilute solution of complexes.
 *
 * Minimising the solution free energy
 *   f(x) = sum_j x_j (dG_j/kT + log x_j - 1)   subject to  A x = x0, x >= 0
 * is a convex problem whose dual is unconstrained:
 *   h(lambda) = sum_j exp(sum_i A_ij lambda_i - dG_j/kT) - sum_i lambda_i x0_i
 * with gradient equal to the mass-conservation residual. A damped Newton
 * iteration on h converges quickly and never leaves the feasible set, because
 * x_j = exp(...) is positive by construction.
 *
 * Concentrations are handled as mole fractions internally (molar divided by the
 * molarity of water), which is the reference state the partition function uses.
 */

/** Molarity of water, the reference used to convert molar <-> mole fraction. */
export const WATER_MOLARITY = 55.14;

export interface ConcentrationProblem {
  /** composition[j][i] = copies of strand species i in complex j. */
  composition: number[][];
  /** Complex free energies in kcal/mol. */
  freeEnergies: number[];
  /** Total concentration of each strand species, molar. */
  totals: number[];
  RT: number;
}

export interface ConcentrationResult {
  /** Equilibrium concentration of each complex, molar. */
  concentrations: number[];
  converged: boolean;
  iterations: number;
  /** Largest relative mass-conservation error. */
  residual: number;
}

export function solveConcentrations(
  problem: ConcentrationProblem,
  options: { maxIterations?: number; tolerance?: number } = {},
): ConcentrationResult {
  const maxIterations = options.maxIterations ?? 200;
  const tolerance = options.tolerance ?? 1e-12;
  const { composition, freeEnergies, totals, RT } = problem;
  const complexCount = composition.length;
  const speciesCount = totals.length;

  const x0 = totals.map((value) => value / WATER_MOLARITY);
  const g = freeEnergies.map((value) => value / RT);

  // Start from the all-monomer solution.
  const lambda = new Array(speciesCount).fill(0);
  for (let i = 0; i < speciesCount; i++) {
    const monomer = composition.findIndex(
      (row) => row[i] === 1 && row.every((value, k) => (k === i ? value === 1 : value === 0)),
    );
    const reference = monomer >= 0 ? g[monomer] : 0;
    lambda[i] = x0[i] > 0 ? Math.log(x0[i]) + reference : -100;
  }

  const logX = new Array(complexCount).fill(0);
  const x = new Array(complexCount).fill(0);

  const evaluate = (lam: number[]) => {
    let value = 0;
    for (let j = 0; j < complexCount; j++) {
      let exponent = -g[j];
      for (let i = 0; i < speciesCount; i++) exponent += composition[j][i] * lam[i];
      logX[j] = exponent;
      const concentration = Math.exp(exponent);
      x[j] = concentration;
      value += concentration;
    }
    for (let i = 0; i < speciesCount; i++) value -= lam[i] * x0[i];
    return value;
  };

  let objective = evaluate(lambda);
  let converged = false;
  let iteration = 0;
  let residual = Infinity;

  for (; iteration < maxIterations; iteration++) {
    const gradient = new Array(speciesCount).fill(0);
    for (let i = 0; i < speciesCount; i++) {
      let sum = 0;
      for (let j = 0; j < complexCount; j++) sum += composition[j][i] * x[j];
      gradient[i] = sum - x0[i];
    }

    residual = 0;
    for (let i = 0; i < speciesCount; i++) {
      const scale = Math.max(x0[i], 1e-300);
      residual = Math.max(residual, Math.abs(gradient[i]) / scale);
    }
    if (residual < tolerance) {
      converged = true;
      break;
    }

    // Hessian H_ik = sum_j A_ji A_jk x_j, symmetric positive definite.
    const hessian: number[][] = Array.from({ length: speciesCount }, () =>
      new Array(speciesCount).fill(0),
    );
    for (let j = 0; j < complexCount; j++) {
      const row = composition[j];
      const weight = x[j];
      if (weight === 0) continue;
      for (let i = 0; i < speciesCount; i++) {
        if (row[i] === 0) continue;
        for (let k = i; k < speciesCount; k++) {
          if (row[k] === 0) continue;
          hessian[i][k] += row[i] * row[k] * weight;
        }
      }
    }
    for (let i = 0; i < speciesCount; i++) {
      for (let k = 0; k < i; k++) hessian[i][k] = hessian[k][i];
      hessian[i][i] += 1e-300;
    }

    const step = solveSymmetric(hessian, gradient.map((value) => -value));
    if (step === null) break;

    // Backtracking line search on the (convex) dual objective.
    let alpha = 1;
    let next = lambda.map((value, i) => value + step[i]);
    let nextObjective = evaluate(next);
    let tries = 0;
    while (!(nextObjective <= objective) && tries < 60) {
      alpha /= 2;
      next = lambda.map((value, i) => value + alpha * step[i]);
      nextObjective = evaluate(next);
      tries += 1;
    }
    if (tries >= 60) {
      evaluate(lambda);
      break;
    }
    for (let i = 0; i < speciesCount; i++) lambda[i] = next[i];
    objective = nextObjective;
  }

  evaluate(lambda);
  return {
    concentrations: x.map((value) => value * WATER_MOLARITY),
    converged,
    iterations: iteration,
    residual,
  };
}

/** Cholesky solve for a small symmetric positive definite system. */
function solveSymmetric(matrix: number[][], rhs: number[]): number[] | null {
  const n = rhs.length;
  const lower: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = matrix[i][j];
      for (let k = 0; k < j; k++) sum -= lower[i][k] * lower[j][k];
      if (i === j) {
        if (sum <= 0) return null;
        lower[i][i] = Math.sqrt(sum);
      } else {
        lower[i][j] = sum / lower[j][j];
      }
    }
  }
  const y = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = rhs[i];
    for (let k = 0; k < i; k++) sum -= lower[i][k] * y[k];
    y[i] = sum / lower[i][i];
  }
  const out = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = y[i];
    for (let k = i + 1; k < n; k++) sum -= lower[k][i] * out[k];
    out[i] = sum / lower[i][i];
  }
  return out;
}
