export type CatalogEntry = { sku: string; name: string; unitCents: number; taxable: boolean; discontinued: boolean };

const SKU_PATTERN = /^[A-Z]{2,4}-\d{3,6}(-[A-Z0-9]{1,4})?$/;

export class Catalog {
  private readonly bySku = new Map<string, CatalogEntry>();

  constructor(entries: CatalogEntry[]) {
    for (const entry of entries) this.bySku.set(entry.sku, entry);
  }

  lookup(rawSku: string): CatalogEntry | undefined {
    const sku = rawSku.trim().toUpperCase();
    if (!SKU_PATTERN.test(sku)) return undefined;
    const entry = this.bySku.get(sku);
    if (entry === undefined || entry.discontinued) return undefined;
    return entry;
  }

  lookupMany(rawSkus: string[]): { found: CatalogEntry[]; missing: string[] } {
    const found: CatalogEntry[] = [];
    const missing: string[] = [];
    for (const raw of rawSkus) {
      const entry = this.lookup(raw);
      if (entry) found.push(entry);
      else missing.push(raw);
    }
    return { found, missing };
  }
}
