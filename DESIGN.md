# TARE — design document

*A first-person puzzle game about weight, debt, and a village that was drowned to fill a reservoir.*

> **tare** (n.) — the weight of an empty container, subtracted to find the true weight of what it holds.
> (v.) — to set a scale back to zero.

---

## 1. Pitch

It is 1979. You are **E. Lind, Auditor Third Class**, sent by the State Audit Bureau to the
**State Institute of Ponderal Measures** — the *Weighing House* — built into the body of the
Kalden Dam. The foundations of the dam are reporting loads that cannot exist. The town below
has felt tremors. Somewhere in the Institute's ledgers, **forty thousand tonnes** have gone missing.

The Institute knows how to do something no one else can: **lift the weight out of a thing and set
it into another.** Weight is never destroyed, only moved. Your instrument — a brass and bakelite
fork called a *tare* — lets you do it too.

You are going to find out where the weight went.

## 2. What makes it different from Portal, Q.U.B.E. and Superliminal

| | Portal | Q.U.B.E. | Superliminal | **TARE** |
|---|---|---|---|---|
| Core verb | connect two surfaces | extrude coloured blocks | rescale by perspective | **move weight between things** |
| Rule that drives puzzles | momentum is conserved | block colour = function | apparent size = real size | **weight is conserved; debt makes things fall upward** |
| Antagonist / voice | an AI running tests | mission control | a dream therapist | **a grieving 70-year-old scientist and a guilty caretaker** |
| Setting | white test chambers | alien cube | dreams, motels | **a 1950s–70s state institute inside a concrete dam** |
| Tone | dark comedy | mystery | whimsy | **dry bureaucratic humour over real grief** |

The theme is literal: grief is weight. You cannot destroy it; you can only move it, carry it,
share it, or put it down somewhere. The mechanic *is* the story.

## 3. Mechanics

### 3.1 Measures
Every weighted object carries an integer number of **measures** shown on a rolling numeral drum
in its side — **black ink for credit, red ink for debt** (accounting convention).

* A measure is a unit of *pull*. A crate at 2 falls normally. At 1 it falls gently. At 4 it slams.
* At **0** an object is *imponderable*: it hangs where it is released and drifts if pushed.
* Below 0 an object is **in debt** and falls **upward** until something stops it.

### 3.2 The tare (your instrument)
* **Left mouse — Draw:** take one measure out of what you're aiming at into the tare.
* **Right mouse — Give:** put one measure from the tare into what you're aiming at.
* The tare has a **capacity** (1 at first; widened by Brask as the audit goes on).
* A **debt latch** stops you drawing an object below zero until Brask removes it (Ledger I, chamber 7).
* A **booth** (*self-tare cabinet*) lets you draw from or give to **yourself**. Your weight changes
  your gravity, not your legs: lighter → you jump higher and updrafts lift you; heavier → you press
  plates, break glass and ride counterweights down; **negative → you fall onto the ceiling**.

### 3.3 Conservation
Measures are only ever moved. Each chamber's puzzles are economies: the total is fixed, and the
question is where to put it. Leaving a chamber, the **audit gate** declares and returns anything
you are still carrying, so chambers never leak into each other.

### 3.4 Elements
| Element | Rule |
|---|---|
| **Ballast crate** | weighted, carriable at ≤ 2 measures; numeral drum on every face |
| **Weighing plate (≥ n)** | pressed while the load on it is at least *n* (dial shows the load) |
| **Calibrated plate (= n)** | pressed only at exactly *n* |
| **Load** | everything resting on a plate, stacked or carried: crates, you, what you hold |
| **Anchor weight** | cast-iron, bolted down; can be drawn from or given to, never moved |
| **Counterweight lift** | two cages on one rope: the heavier side goes down |
| **Updraft vent** | lifts anything of 1 measure or less |
| **Wired-glass floor** | cracks, then breaks, above its stamped limit |
| **Brine channel** | things under 2.5 measures (with their riders) float; heavier things sink |
| **Twinned crates** | share their measures equally, always |
| **Spring plate** | launches whatever is on it; the lighter it is, the further it flies |
| **Reference person** | a 70 kg calibration mannequin, 4 measures, topples realistically |
| **Ceiling plate** | pressed by things pushing *up* (debt) |
| **Self-tare booth** | target yourself; each booth has a stamped allowed range |

## 4. Story

### 4.1 Backstory
* **1949** — the valley village of **Halde** (312 people) is evacuated and drowned to fill the new
  Kalden reservoir. **Ottilie Varga**, 18, leaves. Her mother **Agnes** refuses to, and is found
  in the house after the water rises.
* **1951** — Varga, now a physicist, observes that weight can be moved between resonant bodies
  (the *Varga effect*). The State funds the Institute, builds it *into the dam*, and uses it to
  calibrate national standards — and to make heavy cargo light.
* **1952–1979** — Varga secretly runs the **Halde Programme**: drawing the weight out of the drowned
  village, house by house, stone by stone, so that one day it will simply *rise*. The weight has
  to go somewhere. She puts it into the dam.
* Inside a pumped-dry caisson on the lake bed — *the Bell* — the village of Halde now hangs in the
  air on chains. The dam carries 41,212 tonnes it was never designed for. It is cracking.

### 4.2 Characters
* **E. Lind** — you. Never seen except a gloved hand and a coat sleeve. Methodical. Silent.
* **Dr. Ottilie Varga** (70s) — founder and director. Sharp, proud, funny in a dry way, and
  unable to let go. Speaks on the PA live, and on 1950s reel-to-reel orientation tapes.
* **Teodor Brask** (60s) — Senior Weigher, the last technician. Loyal to Varga, frightened for the
  town below (his daughter lives there). Talks over intercoms, leaves notes, widens your tare,
  and finally meets you in person.
* **The Reference Persons** — 312 calibration mannequins, each tagged with the name and 1949
  census weight of a villager of Halde.

### 4.3 Structure (≈ 95–120 minutes)
**Prologue — Arrival.** Night, rain, the dam crest. Reception, Brask on the intercom, your visitor
badge, the orientation reel, the tare in its velvet case.

**Ledger I — Familiarisation** (chambers 1–8). Varga processes you through "the procedure every
visitor undergoes". Draw, give, capacity, imponderable drift, carrying limits, counterweights,
**debt** (Brask removes the latch), and the first audit you pass.

**Ledger II — Closed Accounts** (chambers 9–17). Brine, glass, twins, updrafts, Reference Persons.
The great **Ledger Hall** whose flip-boards do not balance. The **Hall of 312**. Varga's office:
photographs of Halde and of Agnes. Brask meets you in person and gives you the booth permit.

**Ledger III — The Debt** (chambers 18–26). Your own weight: light, heavy, negative — walking on
ceilings. The turbine hall. The spillway in the storm. **The Bell**: the floating village, where
you change the weight of whole houses to cross it. The **Ballast Vault**.

**Finale — The Balance.** Varga takes your weight to finish lifting Halde. Weightless, then in
debt, you cross the vault on its ceiling and reach the Great Balance. You return the weight. The
village settles back into the water. The bell rings once. Dawn on the dam crest.

## 5. Making it feel human-made (research notes)

What people read as "AI-made" in games and UI, and what this project does instead:

| Tell | Instead |
|---|---|
| Lighting baked into textures; projected, smeared detail | Textures carry *material* only; light comes from motivated fixtures in the scene |
| Blobby, melted, asymmetric meshes; 50k-triangle crates | Clean, purpose-built geometry with chamfered edges that catch light |
| Mangled hands and anatomy | Human-authored CC0 base meshes (Quaternius) with correct anatomy and real mocap-style animation |
| Purple/indigo gradients, glassmorphism, Inter, emoji, rounded cards | Diegetic UI: typewritten forms, rubber stamps, a rolling counter on the instrument; period type (Barlow Condensed for signage, Courier Prime for documents, Old Standard for letterheads) |
| Everything glows, neon accents | Muted palette taken from period institutions: terrazzo cream, pale institutional green, oxblood linoleum, machinery green, brass; restrained bloom; filmic tone mapping and grain |
| Clean, uniform, untouched surfaces | Wear that follows logic: grime where walls meet floors, streaks below ceilings, scuffed lino, chipped enamel back to primer, crazed tiles, a replaced batch of tiles that doesn't quite match |
| Props without a story | Every prop answers "who worked here and what happened": a cold cup of coffee by a ledger, a coat still on its hook, a calendar stopped on a date |
| NPCs as statues | Idle loops with breathing and weight shift, look-at, varied idles, characters doing jobs |
| Stock or generated imagery | The photographs in the documents are rendered from the game's own 3D scenes and developed like 1940s prints: red-blind film response, soft corners, grain, dust |

Sources consulted: Game Developer, "How devs can spot AI-generated 3D models" (Liz Edwards);
Creative Bloq on spotting AI 3D models; writing on the "AI purple" Tailwind-indigo default and
generic AI UI layouts; environmental-storytelling guides (props, wear, layout); Valve's Portal
developer commentary on teaching without words; analyses of Dead Space's diegetic UI; idle
animation guides (breathing 1–2 cm, 4–8 s weight shifts, avoid symmetric poses).

## 6. Credits for third-party assets
See `CREDITS.md`. All characters and animations are CC0 (Quaternius). Fonts are SIL OFL.
Every texture and sound is generated procedurally by the game's own code.
