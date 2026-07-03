import {
  addMonths,
  daysInclusive,
  daysTaken,
  ferieYearEnd,
  ferieYearStart,
  flexBalanceMinutes,
  vacationDaysEarned,
  workedMinutes,
  type DayEntry,
} from '../accrual';

const NORM_37 = 37 * 60; // 2220 min/uge → 444 min/hverdag

describe('ferieår', () => {
  it('starter 1/9 i samme år for datoer fra og med september', () => {
    expect(ferieYearStart('2025-09-01')).toBe('2025-09-01');
    expect(ferieYearStart('2025-12-31')).toBe('2025-09-01');
  });

  it('starter 1/9 året før for datoer før september', () => {
    expect(ferieYearStart('2026-01-15')).toBe('2025-09-01');
    expect(ferieYearStart('2026-08-31')).toBe('2025-09-01');
  });

  it('slutter 31/8 året efter start', () => {
    expect(ferieYearEnd('2025-09-01')).toBe('2026-08-31');
    expect(ferieYearEnd('2026-08-31')).toBe('2026-08-31');
    expect(ferieYearEnd('2026-09-01')).toBe('2027-08-31');
  });
});

describe('datohjælpere', () => {
  it('addMonths clamper til månedens sidste dag', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-15', 1)).toBe('2026-02-15');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('daysInclusive tæller begge endepunkter', () => {
    expect(daysInclusive('2026-06-15', '2026-06-24')).toBe(10);
    expect(daysInclusive('2026-06-15', '2026-06-15')).toBe(1);
  });
});

describe('vacationDaysEarned (ferieloven §4/§5)', () => {
  it('giver 2,08 dage pr. fuldendt måned', () => {
    // Ansat længe; 4 fulde måneder af ferieåret (sep-dec) fuldendt 31/12
    expect(vacationDaysEarned('2020-03-01', '2025-12-31')).toBe(4 * 2.08);
  });

  it('giver præcis 25 dage for et fuldt ferieår (24,96 rundes op, §4)', () => {
    expect(vacationDaysEarned('2020-03-01', '2026-08-31')).toBe(25);
  });

  it('giver 24,96 dagen før ferieåret er fuldendt', () => {
    expect(vacationDaysEarned('2020-03-01', '2026-08-30')).toBe(24.96);
  });

  it('prorater påbegyndt måned med 0,07 pr. dag (§5, stk. 1, 2. pkt.)', () => {
    // Ansat 15/6, opgjort 24/6: 10 ansættelsesdage à 0,07
    expect(vacationDaysEarned('2026-06-15', '2026-06-24')).toBe(0.7);
  });

  it('capper proratering på 2,08 pr. måned', () => {
    // 11 fulde måneder + 30 dage i august (30 × 0,07 = 2,10 → 2,08)
    expect(vacationDaysEarned('2020-03-01', '2026-08-30')).toBe(11 * 2.08 + 2.08);
  });

  it('kombinerer fuldendt måned og proratering ved ansættelse midt i måneden', () => {
    // Ansat 15/6: første måned fuldendt 14/7, derefter 6 dage (15/7-20/7)
    expect(vacationDaysEarned('2026-06-15', '2026-07-20')).toBe(
      Math.round((2.08 + 6 * 0.07) * 100) / 100,
    );
  });

  it('optjener kun fra ferieårets start, ikke fra ansættelsesdato i tidligere ferieår', () => {
    // Ansat marts 2025 (forrige ferieår) → optjening i indeværende år fra 1/9
    expect(vacationDaysEarned('2025-03-01', '2025-10-15')).toBe(
      Math.round((2.08 + 15 * 0.07) * 100) / 100,
    );
  });

  it('giver 0 før ansættelsen starter', () => {
    expect(vacationDaysEarned('2026-09-01', '2026-08-15')).toBe(0);
  });
});

describe('workedMinutes', () => {
  it('trækker pause fra', () => {
    // 08:00-16:00 med 30 min pause
    expect(workedMinutes(8 * 60, 16 * 60, 30)).toBe(450);
  });

  it('håndterer vagt over midnat', () => {
    // 22:00-06:00 uden pause
    expect(workedMinutes(22 * 60, 6 * 60, 0)).toBe(480);
  });

  it('går ikke under nul', () => {
    expect(workedMinutes(8 * 60, 8 * 60, 60)).toBe(0);
  });
});

describe('flexBalanceMinutes', () => {
  const work = (date: string, minutes: number): DayEntry => ({
    date,
    type: 'work',
    workedMinutes: minutes,
  });

  it('er nul uden registreringer', () => {
    expect(flexBalanceMinutes([], NORM_37)).toBe(0);
  });

  it('sammenligner hverdage med norm/5', () => {
    // Mandag 2026-06-15, 8 timer mod 444 min norm → +36
    expect(flexBalanceMinutes([work('2026-06-15', 480)], NORM_37)).toBe(36);
  });

  it('aggregerer flere registreringer samme dag mod én dagsnorm', () => {
    // 2 × 4 timer mandag → 480 - 444 = +36, ikke 480 - 888
    expect(flexBalanceMinutes([work('2026-06-15', 240), work('2026-06-15', 240)], NORM_37)).toBe(
      36,
    );
  });

  it('tæller weekendarbejde fuldt som plus', () => {
    // Lørdag 2026-06-20
    expect(flexBalanceMinutes([work('2026-06-20', 300)], NORM_37)).toBe(300);
  });

  it('lader fravær og ulogget tid være neutralt', () => {
    const entries: DayEntry[] = [
      { date: '2026-06-16', type: 'vacation', workedMinutes: 0 },
      { date: '2026-06-17', type: 'sick', workedMinutes: 0 },
    ];
    expect(flexBalanceMinutes(entries, NORM_37)).toBe(0);
  });

  it('summerer over flere dage', () => {
    // Man: +36, tir: -84 (6 timer), lør: +120
    const entries = [work('2026-06-15', 480), work('2026-06-16', 360), work('2026-06-20', 120)];
    expect(flexBalanceMinutes(entries, NORM_37)).toBe(36 - 84 + 120);
  });
});

describe('daysTaken', () => {
  const vacation = (date: string): DayEntry => ({ date, type: 'vacation', workedMinutes: 0 });

  it('tæller unikke datoer af typen i vinduet', () => {
    const entries = [
      vacation('2026-07-01'),
      vacation('2026-07-01'), // dublet samme dag
      vacation('2026-07-02'),
      vacation('2026-09-01'), // uden for vinduet
      { date: '2026-07-03', type: 'work', workedMinutes: 480 } as DayEntry,
    ];
    expect(daysTaken(entries, 'vacation', '2025-09-01', '2026-08-31')).toBe(2);
  });
});
