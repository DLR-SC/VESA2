/**
 * Gateway - Main Entry Point for the Adapter-Registry Model
 *
 * This module provides the bootstrap function to initialize the gateway
 * and exports all necessary types and services for the application.
 *
 * @example
 * ```typescript
 * import { bootstrapGateway, getServices } from './gateway';
 *
 * // Initialize the gateway (registers adapters)
 * bootstrapGateway();
 *
 * // Use services
 * const { datasetService, keywordService, authorService } = getServices();
 * const datasets = await datasetService.getAll();
 * ```
 */

// Services and Registry
export {
  DatasetService,
  KeywordService,
  AuthorService,
  initializeServices,
  getServices,
  resetServices,
  type ServiceContainer,
} from './services';

// Adapter Contracts
export type {
  IVesaReader,
  IDataset,
  IKeyword,
  IAuthor,
  ILocation,
  ITemporalCoverage,
  AdapterDatasetID,
  SearchParams,
  BoundingBox,
  DateRange,
  AdapterFeatures,
} from './adapters/contracts';

import { VesaAdapter } from './adapters';

const gatewayAdapter = new VesaAdapter();
let gatewayInitialized = false;

/**
 * Bootstrap the gateway.
 *
 * Initializes single-reader runtime mode.
 */
export function bootstrapGateway(): void {
  if (gatewayInitialized) return;
  gatewayInitialized = true;
  console.log(`Gateway: Initialized with reader: ${gatewayAdapter.source}`);
}

/**
 * Check if the gateway has been bootstrapped.
 */
export function isGatewayInitialized(): boolean {
  return gatewayInitialized;
}

/**
 * Perform health check on the single runtime reader.
 */
export async function checkGatewayHealth(): Promise<Record<string, boolean>> {
  try {
    const isHealthy = await gatewayAdapter.healthCheck();
    return { [gatewayAdapter.source]: isHealthy };
  } catch (error) {
    console.error('Gateway health check failed:', error);
    return { [gatewayAdapter.source]: false };
  }
}
