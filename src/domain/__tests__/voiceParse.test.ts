import { parseVoiceCommand } from '../voiceParse';

describe('parseVoiceCommand — typer', () => {
  it('genkender "arbejde" som work', () => {
    expect(parseVoiceCommand('arbejde').type).toBe('work');
  });

  it('genkender bøjningen "arbejdede" som work', () => {
    expect(parseVoiceCommand('arbejdede fra 8 til 16').type).toBe('work');
  });

  it('genkender "job" som work', () => {
    expect(parseVoiceCommand('job fra 9 til 17').type).toBe('work');
  });

  it('genkender "ferie" som vacation', () => {
    expect(parseVoiceCommand('ferie i går').type).toBe('vacation');
  });

  it('matcher længste type først: "feriefridag" bliver feriefridag, ikke vacation', () => {
    expect(parseVoiceCommand('feriefridag i dag').type).toBe('feriefridag');
  });

  it('genkender "syg", "sygdom" og "sygedag" som sick', () => {
    expect(parseVoiceCommand('syg').type).toBe('sick');
    expect(parseVoiceCommand('sygdom').type).toBe('sick');
    expect(parseVoiceCommand('sygedag').type).toBe('sick');
  });

  it('genkender "helligdag" som holiday', () => {
    expect(parseVoiceCommand('helligdag').type).toBe('holiday');
  });
});

describe('parseVoiceCommand — tidsinterval', () => {
  it('"fra 8 til 16" giver 480–960', () => {
    const c = parseVoiceCommand('fra 8 til 16');
    expect(c.startMin).toBe(480);
    expect(c.endMin).toBe(960);
  });

  it('accepterer decimaltid "fra 8.30 til 16.15"', () => {
    const c = parseVoiceCommand('fra 8.30 til 16.15');
    expect(c.startMin).toBe(510);
    expect(c.endMin).toBe(975);
  });

  it('accepterer kolon "fra 08:00 til 16:00"', () => {
    const c = parseVoiceCommand('fra 08:00 til 16:00');
    expect(c.startMin).toBe(480);
    expect(c.endMin).toBe(960);
  });

  it('accepterer "kl. 8 til 16"', () => {
    const c = parseVoiceCommand('kl. 8 til 16');
    expect(c.startMin).toBe(480);
    expect(c.endMin).toBe(960);
  });

  it('accepterer bare cifre "8 til 16"', () => {
    const c = parseVoiceCommand('8 til 16');
    expect(c.startMin).toBe(480);
    expect(c.endMin).toBe(960);
  });

  it('afviser ugyldige timer/minutter "fra 25 til 90"', () => {
    const c = parseVoiceCommand('fra 25 til 90');
    expect(c.startMin).toBeUndefined();
    expect(c.endMin).toBeUndefined();
    expect(c.matched).toBe(false);
  });

  it('afviser minutter over 59 "fra 8:60 til 9:00"', () => {
    const c = parseVoiceCommand('fra 8:60 til 9:00');
    expect(c.startMin).toBeUndefined();
    expect(c.endMin).toBeUndefined();
  });
});

describe('parseVoiceCommand — pause', () => {
  it('"30 minutters pause" giver 30', () => {
    expect(parseVoiceCommand('30 minutters pause').breakMin).toBe(30);
  });

  it('"med 30 minutter pause" giver 30', () => {
    expect(parseVoiceCommand('med 30 minutter pause').breakMin).toBe(30);
  });

  it('"pause på 45 minutter" giver 45', () => {
    expect(parseVoiceCommand('pause på 45 minutter').breakMin).toBe(45);
  });

  it('"en halv times pause" giver 30', () => {
    expect(parseVoiceCommand('en halv times pause').breakMin).toBe(30);
  });

  it('"en times pause" giver 60', () => {
    expect(parseVoiceCommand('en times pause').breakMin).toBe(60);
  });

  it('"uden pause" og "ingen pause" giver 0', () => {
    expect(parseVoiceCommand('uden pause').breakMin).toBe(0);
    expect(parseVoiceCommand('ingen pause').breakMin).toBe(0);
  });
});

describe('parseVoiceCommand — dag', () => {
  it('"i går" giver dayOffset -1', () => {
    expect(parseVoiceCommand('ferie i går').dayOffset).toBe(-1);
  });

  it('"i morgen" giver dayOffset +1', () => {
    expect(parseVoiceCommand('i morgen').dayOffset).toBe(1);
  });

  it('"i dag" og fravær giver dayOffset 0', () => {
    expect(parseVoiceCommand('feriefridag i dag').dayOffset).toBe(0);
    expect(parseVoiceCommand('syg').dayOffset).toBe(0);
  });
});

describe('parseVoiceCommand — helhed og robusthed', () => {
  it('parser hel sætning "arbejde fra 8 til 16 med 30 minutters pause"', () => {
    const c = parseVoiceCommand('arbejde fra 8 til 16 med 30 minutters pause');
    expect(c).toMatchObject({
      type: 'work',
      startMin: 480,
      endMin: 960,
      breakMin: 30,
      dayOffset: 0,
      matched: true,
    });
  });

  it('er tolerant over for STT-store bogstaver "Arbejde fra 8 til 16"', () => {
    const c = parseVoiceCommand('Arbejde fra 8 til 16');
    expect(c.type).toBe('work');
    expect(c.startMin).toBe(480);
    expect(c.endMin).toBe(960);
  });

  it('sætter matched=false for volapyk "hvad er klokken"', () => {
    const c = parseVoiceCommand('hvad er klokken');
    expect(c.matched).toBe(false);
    expect(c.type).toBeUndefined();
    expect(c.startMin).toBeUndefined();
  });

  it('sætter matched=false for tom streng', () => {
    expect(parseVoiceCommand('').matched).toBe(false);
  });

  it('sætter matched=true når mindst ét felt genkendes', () => {
    expect(parseVoiceCommand('syg').matched).toBe(true);
    expect(parseVoiceCommand('uden pause').matched).toBe(true);
    expect(parseVoiceCommand('8 til 16').matched).toBe(true);
  });
});
