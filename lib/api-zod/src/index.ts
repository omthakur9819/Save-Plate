import type { z } from "zod";
import type { ParseNaturalSearchResponse } from "./generated/api";
import type { SearchFilters as SearchFiltersInterface } from "./generated/types";

export * from "./generated/api";
export * from "./generated/types";

export type SearchFilters = SearchFiltersInterface;
export type SearchFiltersOutput = z.infer<typeof ParseNaturalSearchResponse>;

// Aliases used by the API server routes
export {
  UpdateOrderStatusBody as OrderStatusBody,
  RegisterPushDeviceBody as PushDeviceBody,
  SendOrderMessageBody as SendMessageBody,
  ParseNaturalSearchResponse as SearchFilters,
  ParseNaturalSearchBody as SearchParseInput,
  SuggestListingTagsBody as SuggestTagsInput,
  SuggestListingTagsResponse as SuggestTagsResponse,
} from "./generated/api";
