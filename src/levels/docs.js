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
  photoOpening: {
    id: 'photoOpening', kind: 'photo', title: 'Photograph: the opening, 1951',
    get image() { return photoDataURL('opening'); },
    caption: 'Opening of the Institute, 14 May 1951. O.V. second from left.',
  },
};
