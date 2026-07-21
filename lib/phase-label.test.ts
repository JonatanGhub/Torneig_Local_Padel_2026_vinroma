import { describe, expect, it } from 'vitest';
import { matchCardPhase, phaseRoundText, isMainFinal, isKnockoutPhase } from './phase-label';

describe('matchCardPhase', () => {
  it('mapeja la fase de grups directament', () => {
    expect(matchCardPhase('group', 1)).toBe('group');
  });

  it('2a categoria (principal de 8): ko_1=quarts, ko_2=semis, ko_3=final', () => {
    expect(matchCardPhase('ko_1', 2)).toBe('qf');
    expect(matchCardPhase('ko_2', 2)).toBe('sf');
    expect(matchCardPhase('ko_3', 2)).toBe('final');
  });

  it('resta de categories (principal de 4): ko_1=semis, ko_2=final', () => {
    for (const level of [1, 3, 4]) {
      expect(matchCardPhase('ko_1', level)).toBe('sf');
      expect(matchCardPhase('ko_2', level)).toBe('final');
    }
  });

  it('consolació (sempre de 4): cons_1=semis, cons_2=final, per a tots els nivells', () => {
    for (const level of [1, 2, 3]) {
      expect(matchCardPhase('cons_1', level)).toBe('cons_sf');
      expect(matchCardPhase('cons_2', level)).toBe('cons_final');
    }
  });

  it('fase desconeguda retorna null', () => {
    expect(matchCardPhase('whatever', 1)).toBeNull();
  });

  it('sense level (null/undefined) assumeix quadre de 2 rondes', () => {
    expect(matchCardPhase('ko_1', null)).toBe('sf');
    expect(matchCardPhase('ko_2', undefined)).toBe('final');
  });
});

describe('phaseRoundText', () => {
  it('retorna text llegible en ca i es', () => {
    expect(phaseRoundText('ko_1', 2, 'ca')).toBe('Quarts de final');
    expect(phaseRoundText('ko_1', 2, 'es')).toBe('Cuartos de final');
    expect(phaseRoundText('ko_2', 1, 'ca')).toBe('Final');
    expect(phaseRoundText('cons_2', 3, 'ca')).toBe('Final de consolació');
  });

  it('retorna null per a group', () => {
    expect(phaseRoundText('group', 1)).toBeNull();
  });
});

describe('isMainFinal', () => {
  it('detecta només la final del quadre principal', () => {
    expect(isMainFinal('ko_3', 2)).toBe(true);
    expect(isMainFinal('ko_2', 1)).toBe(true);
    expect(isMainFinal('ko_2', 2)).toBe(false);
    expect(isMainFinal('cons_2', 1)).toBe(false);
    expect(isMainFinal('group', 1)).toBe(false);
  });
});

describe('isKnockoutPhase', () => {
  it('detecta fases ko/cons i descarta group', () => {
    expect(isKnockoutPhase('ko_1')).toBe(true);
    expect(isKnockoutPhase('cons_2')).toBe(true);
    expect(isKnockoutPhase('group')).toBe(false);
  });
});
