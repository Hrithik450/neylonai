/** A provider that can search the open internet for a query. */
export interface WebSearchProvider {
  name: string;
  search(query: string): Promise<string>;
}
