import { describe, expect, it } from 'vitest';
import { buildChallengeUrl, parseChallenge, type Challenge } from '../src/share';

const ok: Challenge = { diff: 'empire70', seed: 123456789, at: 845, t: 42137, score: 9876 };
const q = (s: string) => `?${s}`;

describe('challenge links', () => {
  it('round-trips', () => {
    const url = buildChallengeUrl('https://x.test/Sweeperia/', ok);
    expect(parseChallenge(new URL(url).search)).toEqual(ok);
    const noScore = { ...ok, score: undefined };
    expect(parseChallenge(new URL(buildChallengeUrl('https://x.test/', noScore)).search)).toEqual({ diff: 'empire70', seed: 123456789, at: 845, t: 42137 });
    expect(parseChallenge(q('diff=easy&seed=-5&at=0&t=1000'))).not.toBeNull();
  });

  it.each([
    ['missing seed', 'diff=easy&at=1&t=5000'],
    ['unknown diff', 'diff=nope&seed=1&at=1&t=5000'],
    ['seed over int32', 'diff=easy&seed=2147483648&at=1&t=5000'],
    ['seed too long', 'diff=easy&seed=12345678901&at=1&t=5000'],
    ['at out of range', 'diff=easy&seed=1&at=81&t=5000'],
    ['negative at', 'diff=easy&seed=1&at=-1&t=5000'],
    ['zero t', 'diff=easy&seed=1&at=1&t=0'],
    ['negative t', 'diff=easy&seed=1&at=1&t=-5000'],
    ['fractional t', 'diff=easy&seed=1&at=1&t=5000.5'],
    ['NaN t', 'diff=easy&seed=1&at=1&t=NaN'],
    ['Infinity t', 'diff=easy&seed=1&at=1&t=Infinity'],
    ['exponent t', 'diff=easy&seed=1&at=1&t=1e999'],
    ['huge t', 'diff=easy&seed=1&at=1&t=999999999'],
    ['script in t', 'diff=easy&seed=1&at=1&t=%3Cscript%3E'],
    ['bad score', 'diff=easy&seed=1&at=1&t=5000&score=-1'],
    ['script in score', 'diff=easy&seed=1&at=1&t=5000&score=%3Cb%3E'],
  ])('rejects %s', (_n, s) => {
    expect(parseChallenge(q(s))).toBeNull();
  });
});
