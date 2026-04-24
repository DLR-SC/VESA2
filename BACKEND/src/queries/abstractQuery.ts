/**
 *This query is used to get the abstract of a dataset by its id.
 * @key is retrieved from the request parameters.
 *
 * @returns - Abstract of the dataset
 */

import { AQLQuery } from "../types/types";

export const abstractQuery: AQLQuery = `
    LET doc = DOCUMENT(@keys)
    RETURN doc != null ? doc.abstract : null
`;
