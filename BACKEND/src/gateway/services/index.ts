/**
 * Gateway Services - Barrel Export and Factory
 *
 * Services are initialized with a single local graph reader (VesaAdapter),
 * aligned with the ingestion-first unified read model.
 */

export { DatasetService } from './DatasetService';
export { KeywordService } from './KeywordService';
export { AuthorService } from './AuthorService';

import { DatasetService } from './DatasetService';
import { KeywordService } from './KeywordService';
import { AuthorService } from './AuthorService';
import { IVesaReader } from '../adapters/contracts';
import { VesaAdapter } from '../adapters';

/**
 * Service instances container.
 */
export interface ServiceContainer {
  datasetService: DatasetService;
  keywordService: KeywordService;
  authorService: AuthorService;
}

/**
 * Initialize all core services with a shared reader.
 *
 * @param reader - Optional custom reader. Uses VesaAdapter if not provided.
 */
export function initializeServices(reader?: IVesaReader): ServiceContainer {
  const vesaReader = reader ?? new VesaAdapter();

  return {
    datasetService: new DatasetService(vesaReader),
    keywordService: new KeywordService(vesaReader),
    authorService: new AuthorService(vesaReader),
  };
}

/**
 * Cached service instances using the default VesaAdapter.
 * Lazily initialized on first access.
 */
let cachedServices: ServiceContainer | null = null;

/**
 * Get default service instances.
 */
export function getServices(): ServiceContainer {
  if (!cachedServices) cachedServices = initializeServices();
  return cachedServices;
}

/**
 * Reset cached services.
 */
export function resetServices(): void {
  cachedServices = null;
}
