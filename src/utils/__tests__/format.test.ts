import { formatDays, formatFlex, isoWeek, parseHHMM, toHHMM } from '../format';

describe('parseHHMM', () => {
  it('læser TT:MM og T:MM', () => {
    expect(parseHHMM('08:00')).toBe(480);
    expect(parseHHMM('8:00')).toBe(480);
    expect(parseHHMM('23:59')).toBe(23 * 60 + 59);
  });

  it('afviser ugyldige tider', () => {
    expect(parseHHMM('24:00')).toBeNull();
    expect(parseHHMM('12:60')).toBeNull();
    expect(parseHHMM('otte')).toBeNull();
    expect(parseHHMM('')).toBeNull();
  });
});

describe('formatFlex', () => {
  it('viser fortegn og t:mm', () => {
    expect(formatFlex(117)).toBe('+1:57');
    expect(formatFlex(-75)).toBe('−1:15');
    expect(formatFlex(0)).toBe('0:00');
  });
});

describe('formatDays / toHHMM', () => {
  it('bruger dansk decimalkomma', () => {
    expect(formatDays(18.08)).toBe('18,08');
  });

  it('toHHMM padder med nul', () => {
    expect(toHHMM(480)).toBe('08:00');
    expect(toHHMM(975)).toBe('16:15');
  });
});

describe('isoWeek (ISO 8601)', () => {
  it('beregner ugenummer midt på året', () => {
    expect(isoWeek('2026-07-04')).toBe(27);
  });

  it('håndterer årsskifte hvor 1. januar hører til sidste års uge 53', () => {
    expect(isoWeek('2027-01-01')).toBe(53); // fredag; uge 53 af 2026
    expect(isoWeek('2027-01-04')).toBe(1); // første mandag i 2027
  });

  it('uge 1 indeholder årets første torsdag', () => {
    expect(isoWeek('2026-01-01')).toBe(1); // torsdag
    expect(isoWeek('2025-12-29')).toBe(1); // mandag i samme uge
  });
});
