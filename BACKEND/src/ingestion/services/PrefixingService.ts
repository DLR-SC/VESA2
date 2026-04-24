import { IDataAdapter } from '../contracts/IDataAdapter';

export class PrefixingService {
  /**
   * Namespaces identifiers in the packet to prevent collisions.
   */
  public applyPrefix(prefix: string, packet: IDataAdapter): IDataAdapter {
    try {
      const safePrefix = prefix.endsWith(':') ? prefix : `${prefix}:`;
      
      const apply = (id: string) => id.startsWith(safePrefix) ? id : `${safePrefix}${id}`;

      return {
        dataset: {
          ...packet.dataset,
          id: apply(packet.dataset.id || ""),
        },
        authors: packet.authors.map(a => ({ ...a, id: apply(a.id || "") })),
        keywords: packet.keywords.map(k => ({ ...k, id: apply(k.id || "") }))
      };
    } catch (error: any) {
      console.error(`\x1b[31m[PrefixingService] \u2718 Error applying prefix '${prefix}': ${error.message}\x1b[0m`);
      throw error;
    }
  }
}
