import { canonicalize } from './canonicalize.helper';

describe('canonicalize', () => {
  it('treats reordered nested objects as equal', () => {
    expect(canonicalize({ b: { d: 2, c: 1 }, a: 0 })).toBe(
      canonicalize({ a: 0, b: { c: 1, d: 2 } }),
    );
  });

  it('preserves array order and detects semantic differences', () => {
    expect(canonicalize([1, 2, { a: 3 }])).not.toBe(canonicalize([2, 1, { a: 3 }]));
    expect(canonicalize({ a: 1 })).not.toBe(canonicalize({ a: '1' }));
  });

  it('serializes null, undefined, and nested mixed values deterministically', () => {
    expect(canonicalize(null)).toBe('null');
    expect(canonicalize(undefined)).toBeUndefined();
    expect(canonicalize({ z: undefined, a: null, m: [true, { y: 'x' }] })).toBe(
      '{a:null,m:[true,{y:"x"}],z:undefined}',
    );
  });
});
