/**
 * @keys is retrieved from the request parameters. It is the list of dataset ids
 *
 * @returns - List of authors and the datasets(id) they have authored
 */

import { AQLQuery } from "../types/types";

export const authorQuery: AQLQuery = `
LET idLists = @keys
FOR datasetId IN idLists
  FOR author IN 1..1 OUTBOUND datasetId HasAuthor
    COLLECT authorName = CONCAT(author.firstName, ' ', author.lastName) INTO groupedDatasets
    RETURN {
      author: authorName,
      datasets: groupedDatasets[*].datasetId
    }
`;

/**
 * This query is used to get the List of authors and the datasets(id) they have authored
 * You have to POST the datasets id of all the datasets which is valid(filters applied)
 * to get the authors of those datasets
 */
