/**
 * This Query is used to get all the dataset_ids from the Dataset and STACCollection
 * that are within the given time range.
 *
 * @start - Start date of the time range
 * @end - End date of the time range
 *
 * @returns - Array of dataset_ids
 */

import { AQLQuery } from "../types/types";

export const timechartQuery: AQLQuery = `
LET startDate = @start
LET endDate = @end

LET DatasetID = (
    FOR edge IN HasKeyword
        FILTER LIKE(edge._from, 'Dataset/%')
        RETURN DISTINCT edge._from
)

LET dLists = (
    FOR d IN DOCUMENT(DatasetID)
        FILTER d != null AND d.temporal != null
        LET start_date = d.temporal.start != null ? d.temporal.start : startDate
        LET end_date = d.temporal.end != null ? d.temporal.end : DATE_ADD(start_date, 1, "day")
        FILTER startDate <= end_date AND endDate >= start_date
        RETURN d._id
)

RETURN dLists
`;
