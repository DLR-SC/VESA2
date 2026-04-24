/* 
    For the initial page load, we want to get all the datasets from the 
    Dataset and the STACCollection in the database.
    This query will return all the dataset ids in the database.
*/

import { AQLQuery } from "../types/types";

export const initialPageLoadQuery: AQLQuery = `
    //Dataset_id_list contains the dataset ids that have a connection with a keyword
    LET DatasetID = (
        FOR edge IN HasKeyword
            FILTER LIKE(edge._from, 'Dataset/%')
            RETURN DISTINCT edge._from
    )

    FOR doc IN DatasetID
        RETURN doc
`;

/**
 * Since only 264 out of 3000 datasets have a connection with a keyword,
 * we will use the HasKeyword edge collection to get the dataset ids
 * that have a connection with a keyword.
 *
 * When there are more connections between the dataset and the keyword,
 * Uncomment the first part.
 */
