// Every document in the game. Notes are found in the world and filed in the
// "Ledger of findings" (Tab). Kept in one place so the story reads as a whole.
import { photoDataURL } from './photos.js';

export const DOCS = {
  appointment: {
    id: 'appointment', title: 'Letter of appointment', org: 'State Audit Bureau', dept: 'Directorate of Physical Assets · Section 7',
    meta: [['To', 'E. Lind, Auditor Third Class'], ['Re', 'Inventory audit — State Institute of Ponderal Measures, Kalden'], ['Date', '2 November 1979']],
    body: [
      'You are directed to conduct a full inventory audit of the stock of measures held by the Institute at Kalden, and to reconcile it with the Institute’s ledgers.',
      'Since the spring, foundation instruments at the Kalden Dam have recorded loads exceeding the design value by thirty-eight per cent. The Institute reports no change in its holdings. The town of Nedre Kalden reports three tremors.',
      'The Director, Dr. O. Varga, has been informed of your visit. Her cooperation is required by statute and is, the Bureau is assured, guaranteed.',
      'You will be issued the Institute’s instrument for the duration of the audit. Return it on completion.',
    ],
    sig: 'A. Holm', sigName: 'Deputy Director, Physical Assets',
    stamps: [{ text: 'Bureau copy', right: 46, top: 70, rot: -7 }, { text: 'Urgent', right: 60, top: 420, rot: 6, violet: true, small: true }],
  },
  braskWelcome: {
    id: 'braskWelcome', kind: 'note', title: 'A note left on the counter',
    text: 'Auditor —\n\nBadge is under the letter, wear it, she checks.\nCoffee’s cold. Sorry.\nThe Director doesn’t sleep, so the rest of us don’t either.\n\nIf the lights go, stand still. They come back.',
    sign: 'T. B.',
  },
  debtMemo: {
    id: 'debtMemo', title: 'Memorandum: negative balances', dept: 'Kalden \u00b7 Office of the Senior Weigher',
    meta: [['To', 'All weighing staff'], ['From', 'T. Brask, Senior Weigher'], ['Date', '9 March 1966']],
    body: [
      'Staff are reminded that a body drawn below zero does not "float". It falls upward, at a rate proportionate to its debt, until it meets something willing to hold it down.',
      'Ceilings are not willing. Ceilings are merely there.',
      'Following the incident in Weighing Room I\u20137, debt latches are to remain fitted to all instruments issued to visitors. Visitors are to be accompanied.',
      { hand: 'Nobody accompanies anybody any more. \u2014 T.' },
    ],
    stamps: [{ text: 'Circulated', right: 40, top: 60, rot: -6 }],
  },
  auditSheet: {
    id: 'auditSheet', title: 'Familiarisation record', dept: 'Kalden \u00b7 Visitor Procedure',
    meta: [['Visitor', 'E. Lind (Bureau)'], ['Procedure', 'Familiarisation, rooms I\u20131 to I\u20138']],
    body: [
      { head: ['Room', 'Result', 'Remarks'], table: [['I\u20131', 'Balanced', ''], ['I\u20132', 'Balanced', 'Carried'], ['I\u20133', 'Balanced', 'Used deposit'], ['I\u20134', 'Balanced', ''], ['I\u20135', 'Balanced', 'Exact'], ['I\u20136', 'Balanced', ''], ['I\u20137', 'Balanced', 'Debt \u2014 latch?'], ['I\u20138', '', '']] },
      { hand: 'Latch removed in 7. Who authorised? \u2014 O.V.', red: true },
      { hand: 'Nobody. It fell off. \u2014 T.B.' },
    ],
  },
  brineNotice: {
    id: 'brineNotice', title: 'Notice: brine channels', dept: 'Kalden \u00b7 Works Department',
    body: [
      'The ballast channels on Archive Level II carry saturated brine from the reservoir seepage. The brine is used to float heavy stock between stores.',
      'Brine supports any body lighter than two and a half measures, together with anything resting upon it. It supports nothing heavier. Nothing that sinks in the channels has ever been recovered.',
      'Staff are not to swim.',
      { hand: 'Someone did, once. 1958. We don\u2019t say his name in here. \u2014 T.' },
    ],
  },
  twinsNote: {
    id: 'twinsNote', title: 'Clipboard: twinned ballast', dept: 'Kalden \u00b7 Foundry Records',
    meta: [['Item', 'Ballast pair, cast 11.IV.1957, pour no. 6'], ['Tuning', 'A, 440']],
    body: [
      'Two bodies cast from the same pour and tuned to the same note will hold their measures in common. Draw from one, and the other gives up half. Give to one, and the other is heard to ring.',
      { hand: 'O.V. wants a third cast from pour 6. There isn\u2019t a third. She knows there isn\u2019t.', red: false },
    ],
  },
  refPersonSpec: {
    id: 'refPersonSpec', title: 'Specification: the Reference Person', dept: 'Kalden \u00b7 Calibration',
    body: [
      'The Reference Person is a full-size figure of standard proportions used to calibrate scales intended for human loads. Seventy kilograms. Four measures. One hundred and seventy-five centimetres.',
      'The Institute holds a working set of twelve.',
      { hand: 'And three hundred and twelve that are not a working set. Not on this list. \u2014 T.B.' },
    ],
    stamps: [{ text: 'Inventory', right: 40, top: 50, rot: -5, small: true }],
  },
  census: {
    id: 'census', title: 'Census of Halde, 1949 (extract)', org: 'Ministry of Water and Power', dept: 'Kalden Reservoir \u00b7 Resettlement Office',
    meta: [['Parish', 'Halde, Kalden valley'], ['Persons', '312'], ['Dwellings', '74'], ['Date of flooding', '1 September 1949']],
    body: [
      { head: ['Household', 'Persons', 'Resettled to'], table: [['Halder, J.', '6', 'Nedre Kalden'], ['Kessel, B.', '4', 'Nedre Kalden'], ['Novak, P.', '2', 'Ostrava district'], ['Varga, A.', '1', '\u2014'], ['Varga, O.', '1', 'University hostel']] },
      'Persons who declined resettlement: one (1). Varga, Agnes, 61 kg, widow, of the house by the church.',
      { hand: 'She said she would wait for the water. \u2014 entered by the Resettlement Officer', red: true },
    ],
    stamps: [{ text: 'Closed', right: 50, top: 60, rot: -10 }],
  },
  photoHalde: {
    id: 'photoHalde', kind: 'photo', title: 'Photograph: Halde, summer 1948',
    get image() { return photoDataURL('halde'); },
    caption: 'Halde from the south road, summer 1948. The church, the schoolhouse, our house.',
  },
  haldeLetter: {
    id: 'haldeLetter', title: 'Letter to the Ministry, 1952', dept: 'Kalden \u00b7 Office of the Director',
    meta: [['To', 'The Minister for Water and Power'], ['From', 'Dr. O. Varga, Director'], ['Re', 'Proposed programme of ponderal recovery, Kalden reservoir'], ['Date', '30 January 1952']],
    body: [
      'Comrade Minister, I propose that the Institute undertake, at no cost to the Ministry beyond its present budget, the recovery of the submerged settlement of Halde by ponderal means.',
      'The weight of a building may be drawn from it as from any other body. Drawn weight must be held. I propose that it be held in the mass of the Kalden Dam, which was designed with a reserve of strength the engineers describe as generous.',
      'When the settlement is sufficiently light it will rise of its own accord. I ask for nothing but time, and that the Ministry not inquire into the progress of the programme until it is complete.',
    ],
    sig: 'O. Varga', sigScript: true, sigName: 'Director',
    stamps: [{ text: 'Approved', right: 40, top: 70, rot: -8 }, { text: 'Not to be filed', right: 260, top: 380, rot: 5, violet: true, small: true }],
  },
  ledgerPage: {
    id: 'ledgerPage', title: 'Page torn from Account 7', dept: 'Kalden \u00b7 Ledger Hall',
    body: [
      { head: ['Year', 'Drawn from Halde (t)', 'Deposited (dam)'], table: [['1953', '412', '412'], ['1958', '3 960', '3 960'], ['1963', '9 225', '9 225'], ['1969', '22 870', '22 870'], ['1974', '33 140', '33 140'], ['1979', '41 212', '41 212']] },
      'Design reserve of the dam (tonnes, crest to foundation): 27 500.',
      { hand: 'Reserve exceeded 1971. Nobody stopped. \u2014 T.B.', red: true },
    ],
  },
  liftLog: {
    id: 'liftLog', title: 'Lift log, atrium', dept: 'Kalden \u00b7 Works Department',
    body: [
      { head: ['Date', 'Lift', 'Remark'], table: [['3.II.75', 'Upper', 'Ballast removed for the Bell'], ['4.II.75', 'Upper', 'Rode with sandbag, 2 men'], ['9.VI.77', 'Upper', 'Sandbag gone also. For the Bell.'], ['', '', '']] },
      { hand: 'Everything heavy goes to the Bell eventually. Even the sand. \u2014 T.' },
    ],
  },
  photoAgnes: {
    id: 'photoAgnes', kind: 'photo', title: 'Photograph: Agnes Varga',
    get image() { return photoDataURL('agnes'); },
    caption: 'Mama at the door of the house by the church, 1947.',
  },
  agnesLetter: {
    id: 'agnesLetter', kind: 'note', title: 'A letter from Agnes Varga, August 1949',
    text: 'Ottilie,\n\nThey came again about the house. I told them the same. A house is not a coat you take off because it rains.\n\nGo to your university. Learn your numbers. Don\u2019t come back to watch, it\u2019s only water.\n\nYou remember what I told you about the cork in the barrel. Everything good comes back up.',
    sign: 'Mama',
  },
  vargaDiary: {
    id: 'vargaDiary', title: 'Diary page (typed)', dept: 'Private',
    body: [
      '14 October 1978. The church tower moved today \u2014 four centimetres off the lake bed, against its chains. Teodor wept. I did not, which he will hold against me.',
      'The dam engineers sent a letter about the readings. I have filed it with the others.',
      'It is so nearly light enough. One more house. One more measure. There is always one more measure.',
    ],
  },
  boothPermit: {
    id: 'boothPermit', title: 'Self-tare permit', dept: 'Kalden \u00b7 Office of the Senior Weigher',
    meta: [['Holder', 'E. Lind (Bureau)'], ['Range', 'As stamped on each booth'], ['Issued by', 'T. Brask, without authority']],
    body: [
      'The holder may be drawn from and given to at any self-tare station of the Institute, within the range stamped on the station.',
      'The holder is reminded that a person below zero falls upward, that a person at zero does not fall at all, and that neither condition excuses lateness.',
      { hand: 'Lighter jumps higher. Heavier presses harder. Below nothing, look up. \u2014 T.' },
    ],
    stamps: [{ text: 'Unofficial', right: 40, top: 70, rot: -8, violet: true }],
  },
  turbineLog: {
    id: 'turbineLog', title: 'Turbine hall log', dept: 'Kalden \u00b7 Power Station',
    body: [
      { head: ['Date', 'Gen.', 'Entry'], table: [['12.III.71', '1', 'Shut down. Foundation readings.'], ['12.III.71', '2', 'Shut down. Same.'], ['30.IV.71', '3', 'Shut down by order of the Director'], ['', '', '']] },
      'Power to Nedre Kalden now supplied from the regional grid. The Ministry has not asked why.',
    ],
  },
  engineerLetter: {
    id: 'engineerLetter', title: 'Letter from the dam engineers, 1979', org: 'Ministry of Water and Power', dept: 'Directorate of Dams \u00b7 Structural Section',
    meta: [['To', 'The Director, State Institute of Ponderal Measures'], ['Date', '19 July 1979']],
    body: [
      'Foundation pressure cells at the Kalden Dam report loads one hundred and fifty per cent of design. Crack gauges in the gallery have opened by eleven millimetres since January.',
      'If the Institute is storing anything in the structure of the dam, we must ask that it be removed. If it is not, we must ask what it is.',
      'Our models do not converge. In plain words: we do not know why the dam is still standing.',
    ],
    stamps: [{ text: 'Filed', right: 60, top: 60, rot: -12 }],
  },
  vaultOrder: {
    id: 'vaultOrder', title: 'Standing order: the Great Balance', dept: 'Kalden \u00b7 Office of the Director',
    body: [
      'The Great Balance connects the vault and the Halde account. Should its pans ever stand level, every measure held in the vault is returned to the account it was drawn from.',
      'The pans are not to be levelled.',
      { hand: 'Unless I am wrong. If I am wrong, level them. \u2014 O.V.' },
    ],
  },
  finalReport: {
    id: 'finalReport', title: 'Audit report, Kalden', org: 'State Audit Bureau', dept: 'Directorate of Physical Assets \u00b7 Section 7',
    meta: [['Auditor', 'E. Lind, Third Class'], ['Subject', 'State Institute of Ponderal Measures, Kalden'], ['Date', '3 November 1979']],
    body: [
      { head: ['Account', 'Opening', 'Closing'], table: [['Stock', '1 204', '1 204'], ['Calibration', '318', '318'], ['Loans', '96', '96'], ['7 \u2014 Halde', '41 212 t', '0']] },
      'Discrepancies: none remaining. All measures drawn from the Halde account have been returned to it.',
      'Remarks: the village is where it was left in 1949. The dam is resting. I recommend no further action against the Institute, and that somebody fix the coffee machine.',
    ],
    sig: 'E. Lind', sigName: 'Auditor Third Class',
    stamps: [{ text: 'Balanced', right: 46, top: 64, rot: -9 }],
  },
  photoOpening: {
    id: 'photoOpening', kind: 'photo', title: 'Photograph: the opening, 1951',
    get image() { return photoDataURL('opening'); },
    caption: 'Opening of the Institute, 14 May 1951. O.V. second from left.',
  },
};
