import { describe, expect, it } from 'vitest';

import { cleanChildName, hasPlaceholder, personalParts, PERSONAL_STORIES, renderTemplate, type PersonalChild } from '../personal';
import { withEnding } from '../personal/template';

const girl: PersonalChild = { name: 'सई', gender: 'GIRL' };
const boy: PersonalChild = { name: 'राम', gender: 'BOY' };

describe('placeholders', () => {
  it('fills in the name, endings and boy/girl words', () => {
    expect(renderTemplate('{नाव} {गेला|गेली}. {नाव+ने} पाहिलं.', girl)).toBe('सई गेली. सईने पाहिलं.');
    expect(renderTemplate('{नाव} {गेला|गेली}. {नाव+ने} पाहिलं.', boy)).toBe('राम गेला. रामाने पाहिलं.');
  });

  it('puts "ा" before an ending only after a consonant', () => {
    expect(withEnding('राम', 'ला')).toBe('रामाला');
    expect(withEnding('अथर्व', 'ला')).toBe('अथर्वाला');
    expect(withEnding('केतू', 'ला')).toBe('केतूला');
    expect(withEnding('आर्या', 'ला')).toBe('आर्याला');
    expect(withEnding('सई', 'ला')).toBe('सईला');
  });

  it('refuses placeholders it does not understand', () => {
    expect(() => renderTemplate('{कोण}', boy)).toThrow();
    expect(() => renderTemplate('{अ|ब|क}', boy)).toThrow();
  });

  it('only accepts a plain Devanagari name', () => {
    expect(cleanChildName(' केतू ')).toBe('केतू');
    expect(cleanChildName('Ketu')).toBeNull();
    expect(cleanChildName('केतू. आणि')).toBeNull();
    expect(cleanChildName('केतू१')).toBeNull();
    expect(cleanChildName('')).toBeNull();
    expect(cleanChildName('अ'.repeat(16))).toBeNull();
    expect(cleanChildName(42)).toBeNull();
  });
});

describe.each(PERSONAL_STORIES)('personal story $id', (story) => {
  it('leaves no placeholder behind for either gender', () => {
    for (const child of [girl, boy]) {
      expect(hasPlaceholder(renderTemplate(story.template, child))).toBe(false);
      expect(hasPlaceholder(renderTemplate(story.title, child))).toBe(false);
    }
  });

  it('has a speaker for every quoted line', () => {
    const quotes = (story.template.match(/"[^"]+"/g) ?? []).length;
    expect(story.quoteSpeakers.length).toBe(quotes);
  });

  it('splits the same way for every child, and shares most of the voice', () => {
    const names = ['सई', 'राम', 'केतू', 'अथर्व', 'आर्या'];
    const shapes = names.map((name) =>
      personalParts(story, { name, gender: name === 'सई' || name === 'आर्या' ? 'GIRL' : 'BOY' }, 4).map((p) => p.personal),
    );
    for (const s of shapes) expect(s).toEqual(shapes[0]);
    const parts = personalParts(story, girl, 4);
    expect(parts.some((p) => p.personal)).toBe(true);
    expect(parts.some((p) => !p.personal)).toBe(true);
    // Shared parts say no name and no boy/girl word.
    const spoken = (p: (typeof parts)[number]) => p.chunk.parts.map((x) => x.text).join(' ');
    const sharedBoy = personalParts(story, boy, 4).filter((p) => !p.personal).map(spoken);
    const sharedGirl = personalParts(story, girl, 4).filter((p) => !p.personal).map(spoken);
    expect(sharedBoy).toEqual(sharedGirl);
    for (const text of sharedGirl) expect(text).not.toContain('सई');
  });

  it('keeps the personal parts short and the shared part hashes steady between children', () => {
    const a = personalParts(story, girl, 7);
    const b = personalParts(story, boy, 7);
    expect(a.filter((p) => !p.personal).map((p) => p.hash)).toEqual(b.filter((p) => !p.personal).map((p) => p.hash));
    for (const p of a.filter((x) => x.personal)) expect(p.chunk.parts.map((x) => x.text).join('').length).toBeLessThan(400);
  });
});
