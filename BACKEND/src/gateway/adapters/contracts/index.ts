/**
 * Adapter Contracts - Barrel Export
 *
 * This module exports all contract types for the Adapter-Registry Model.
 * Import from here for clean, single-line imports:
 *
 * @example
 * ```typescript
 * import {
 *   IVesaReader,
 *   IDataset,
 *   IKeyword,
 *   SearchParams,
 *   AdapterFeatures
 * } from '../gateway/adapters/contracts';
 * ```
 */

// Core domain types
export type { AdapterDatasetID, ILocation, ITemporalCoverage, IDataset, IKeyword, IAuthor } from './types';

// Input parameter types
export type { BoundingBox, DateRange, SearchParams } from './params';

// Adapter capability flags
export type { AdapterFeatures } from './features';

// The main adapter interface
export type { IVesaReader } from './IVesaReader';
