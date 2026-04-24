import { AQLQuery } from "../types/types";

export const isValidIdQuery: AQLQuery = `
LET doc = DOCUMENT(@key)
RETURN doc != null
`;

export const isValidIdArrayQuery: AQLQuery = `
LET ids = FLATTEN([@keys])
LET validDocs = ids[* FILTER DOCUMENT(CURRENT) != null]
RETURN LENGTH(validDocs) == LENGTH(ids)
`;

/**
 * This query is used to check if the id exists in the Dataset or STACCollection
 * @key is retrieved from the request parameters.
 * Returns true if the id exists in either of the collections
 */
