import axios from 'axios';
import { IDataAdapter } from '../contracts/IDataAdapter';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  message?: string;
  originalStatus?: number;
}

export class HandshakeValidator {
  async validate(url: string): Promise<ValidationResult> {
    try {
      console.log(`\x1b[36m[HandshakeValidator] Requesting 1 record from ${url} for schema validation...\x1b[0m`);
      // Fetch 1 record (assuming the endpoint supports a limit query or returns a valid array/object)
      const response = await axios.get(url, { params: { limit: 1 }, timeout: 10000 });
      const record: IDataAdapter = Array.isArray(response.data) ? response.data[0] : response.data;

      // Basic schema check
      if (!record || !record.dataset || !record.dataset.id || !record.dataset.title) {
        console.warn(`\x1b[33m[HandshakeValidator] Schema check failed: Missing required dataset fields.\x1b[0m`);
        return { valid: false, reason: 'invalid_schema', message: 'Missing required dataset fields.', originalStatus: response.status };
      }
      
      if (!Array.isArray(record.authors) || !Array.isArray(record.keywords)) {
        console.warn(`\x1b[33m[HandshakeValidator] Schema check failed: Authors or keywords are not arrays.\x1b[0m`);
        return { valid: false, reason: 'invalid_schema', message: 'Authors or keywords are not arrays.', originalStatus: response.status };
      }

      console.log(`\x1b[32m[HandshakeValidator] \u2714 Source is compliant with the IDataAdapter contract.\x1b[0m`);
      return { valid: true };
    } catch (error: any) {
      console.error(`\x1b[31m[HandshakeValidator] \u2718 Request failed: ${error.message}\x1b[0m`);
      
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          return { valid: false, reason: 'source_offline', message: 'The API Endpoint is currently unreachable or timed out.', originalStatus: 503 };
        }
        if (error.response.status === 404) {
          return { valid: false, reason: 'not_found', message: 'The specified API Endpoint could not be found. Please check the URL and try again.', originalStatus: 404 };
        }
        return { valid: false, reason: 'unreachable', message: `API Endpoint responded with error: ${error.message}`, originalStatus: error.response.status };
      }
      
      return { valid: false, reason: 'unknown_error', message: error.message };
    }
  }
}
