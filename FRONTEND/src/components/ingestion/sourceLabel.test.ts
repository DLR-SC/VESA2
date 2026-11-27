import { describe, it, expect } from 'vitest';
import { sourceLabel } from './sourceLabel';

describe('sourceLabel', () => {
  it('shows the upstream repository for the universal OAI proxy', () => {
    expect(sourceLabel('/oai/records?source=https%3A%2F%2Fws.pangaea.de%2Foai%2Fprovider&set=citable&prefix=dif'))
      .toBe('https://ws.pangaea.de/oai/provider (set: citable)');
    // as stored by the backend after resolving the relative path
    expect(sourceLabel('http://127.0.0.1:5000/oai/records?source=https%3A%2F%2Fzenodo.org%2Foai2d&prefix=oai_dc'))
      .toBe('https://zenodo.org/oai2d');
  });

  it('names bundled proxies by their preset label', () => {
    expect(sourceLabel('/proxy/pangaea/records')).toBe('PANGAEA (bundled proxy)');
    expect(sourceLabel('http://127.0.0.1:5000/proxy/gbif/records')).toBe('GBIF (bundled proxy)');
  });

  it('leaves custom external proxies untouched', () => {
    const external = 'https://example.org/proxy/pangaea/records';
    expect(sourceLabel(external)).toBe(external);
  });
});
