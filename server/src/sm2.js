// Répétition espacée SM-2 (SuperMemo 2).
// Les 3 boutons de l'UI sont mappés sur une "qualité" SM-2 :
//   À revoir -> 2 (échec, on repart de zéro)
//   Moyen    -> 3 (réussite difficile)
//   Je savais -> 5 (réussite facile)
export const GRADE_QUALITY = { again: 2, hard: 3, good: 5 };

export function sm2(prev, quality) {
  let ease = prev?.ease ?? 2.5;
  let interval = prev?.interval ?? 0;
  let reps = prev?.reps ?? 0;

  if (quality < 3) {
    reps = 0;
    interval = 1;
  } else {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(interval * ease);
    reps += 1;
  }

  ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ease < 1.3) ease = 1.3;

  const due = new Date(Date.now() + interval * 86400000);
  return {
    ease: Number(ease.toFixed(2)),
    interval,
    reps,
    dueDate: due.toISOString().slice(0, 10),
  };
}
