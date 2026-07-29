// The rules stage-check.mjs enforces, kept pure so they can be unit-tested
// rather than only exercised by running the CLI against live data.
//
// HARD = years_exp settles it outright. There is no reading of "rookie" under
// which a man with two seasons played qualifies.
// SOFT = a judgement call worth surfacing. "prime" vs "aging" is a real opinion;
// being 29 doesn't prove anything on its own.

export const STAGES = ['rookie', 'yr2', 'asc', 'prime', 'aging', 'fading'];

/**
 * @param {{name:string,pos:string,adp:number|string,stage:string}} row
 * @param {{yearsExp:number|null,age:number|null}} sleeper
 * @returns {{hard:string[], soft:string[]}}
 */
export function checkStage(row, sleeper) {
  const hard = [];
  const soft = [];
  const stage = row.stage || '';
  const where = `${row.name} (${row.pos}, adp ${row.adp})`;
  const ye = sleeper && sleeper.yearsExp != null ? Number(sleeper.yearsExp) : null;
  const age = sleeper && sleeper.age != null ? Number(sleeper.age) : null;

  if (ye != null) {
    if (ye === 0 && stage !== 'rookie') {
      hard.push(`${where}: years_exp 0 (FIRST year) but tagged '${stage || '(none)'}' — should be 'rookie'`);
    } else if (ye > 0 && stage === 'rookie') {
      hard.push(`${where}: tagged 'rookie' but years_exp ${ye} — he has played before`);
    } else if (ye === 1 && stage !== 'yr2') {
      hard.push(`${where}: years_exp 1 (SECOND year) but tagged '${stage || '(none)'}' — should be 'yr2'`);
    } else if (ye > 1 && stage === 'yr2') {
      hard.push(`${where}: tagged 'yr2' but years_exp ${ye}`);
    }
  }

  if (stage && !STAGES.includes(stage)) hard.push(`${where}: '${stage}' is not a known stage`);
  if (!stage) soft.push(`${where}: no stage tag at all — priced as flat/typical`);

  if (age != null) {
    if (row.pos === 'RB' && age >= 28 && ['prime', 'asc', 'yr2'].includes(stage)) {
      soft.push(`${where}: RB aged ${age} tagged '${stage}' — that age usually belongs in 'aging'/'fading'`);
    }
    if (age <= 24 && ['aging', 'fading'].includes(stage)) {
      soft.push(`${where}: aged ${age} but tagged '${stage}'`);
    }
  }

  return { hard, soft };
}
