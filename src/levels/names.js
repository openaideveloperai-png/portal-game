// The 312 people of Halde (census of 1949). Names are invented for the game.
import { rng } from '../core/util.js';

const FIRST_F = ['Agnes', 'Berta', 'Clara', 'Dora', 'Erna', 'Frida', 'Greta', 'Hanna', 'Ida', 'Ilse', 'Johanna', 'Klara', 'Lene', 'Lisa', 'Marta', 'Mila', 'Olga', 'Paula', 'Rosa', 'Sabina', 'Theresa', 'Vera', 'Wilma', 'Zita', 'Anka', 'Danuta', 'Kaja', 'Ludmila', 'Nadja', 'Radka', 'Vlasta', 'Elin', 'Sigrid', 'Ingrid', 'Astrid', 'Brita', 'Hedda', 'Malin', 'Signe', 'Tove'];
const FIRST_M = ['Anton', 'Bruno', 'Emil', 'Franz', 'Georg', 'Hugo', 'Jakob', 'Josef', 'Karl', 'Leo', 'Ludwig', 'Matthias', 'Nikolaus', 'Oskar', 'Peter', 'Rudolf', 'Teodor', 'Ulrich', 'Viktor', 'Walter', 'Xaver', 'Bohdan', 'Jarek', 'Mirek', 'Pavel', 'Tomas', 'Zdenek', 'Torvald', 'Halvard', 'Einar', 'Gunnar', 'Ivar', 'Leif', 'Sten', 'Vilem'];
const LAST = ['Halder', 'Kessel', 'Maurer', 'Novak', 'Kral', 'Dvorak', 'Weber', 'Fischer', 'Holm', 'Strand', 'Berg', 'Ekberg', 'Sander', 'Brenner', 'Lehner', 'Huber', 'Moser', 'Pichler', 'Gruber', 'Wallner', 'Riedl', 'Koval', 'Mlynar', 'Sedlak', 'Kubat', 'Horak', 'Marek', 'Pokorny', 'Zeman', 'Beran', 'Vacek', 'Rybar', 'Kolar', 'Hajek', 'Soukup', 'Tanner', 'Kessler', 'Aune', 'Lund', 'Morken', 'Sollie', 'Vik'];

export function haldeCensus() {
  const r = rng(1949);
  const out = [];
  const families = [];
  // families of 1–6, so surnames repeat the way they do in a village
  while (out.length < 311) {
    const last = r.pick(LAST);
    const n = Math.min(311 - out.length, 1 + Math.floor(r() * r() * 6));
    for (let i = 0; i < n; i++) {
      const female = r() < 0.5;
      const child = i >= 2 && r() < 0.6;
      const kg = child ? Math.round(14 + r() * 30) : Math.round(female ? 50 + r() * 26 : 60 + r() * 34);
      out.push({ name: `${r.pick(female ? FIRST_F : FIRST_M)} ${last}`, kg, child, female });
    }
    families.push(last);
  }
  // the Director's mother, kept apart in the Hall
  out.splice(140, 0, { name: 'Agnes Varga', kg: 61, child: false, female: true, agnes: true });
  return out;
}
