import { describe, expect, it } from 'vitest';

import { aajiGreeting } from '../greeting';

const at = (h: number) => new Date(2026, 10, 1, h, 0);

describe('aajiGreeting', () => {
  it('follows the time of day and always uses the child name', () => {
    expect(aajiGreeting('केतू', at(8))).toBe('सुप्रभात केतू!');
    expect(aajiGreeting('केतू', at(13))).toBe('नमस्कार केतू!');
    expect(aajiGreeting('केतू', at(18))).toBe('ये केतू, इथे बस!');
    expect(aajiGreeting('केतू', at(22))).toContain('झोपायची वेळ');
    expect(aajiGreeting('केतू', at(3))).toContain('केतू');
  });
});
