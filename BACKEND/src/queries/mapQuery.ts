/**
 * This file contains the queries to handle the pie chart/different modes
 * present in the map page. The first option is the regular map with all the datasets present
 * The second option is the map with only the datasets that have a full coverage object
 * The third option is the map with only the datasets that have a null coverage object
 */

import { AQLQuery } from "../types/types";

/*
    This query returns a list of dataset_ids that have
    a full coverage object i.e the whole map is covered
*/
/**
 * NOTE : In the current database, the Dataset collection doesn't have any Datasets with
 * full map coverage but instead has the co-ordinate [0,90,0,-90]. In the DOI of these
 * datasets, the coverage is mentioned as global. Hence, the query has been modified to
 * include these datasets as well.
 */

export const mapFullQuery: AQLQuery = `
RETURN (
    FOR dataset IN Dataset
        FILTER (
            (dataset.spatial.west == -180 && 
             dataset.spatial.east == 180  &&
             dataset.spatial.north == 90   &&
             dataset.spatial.south == -90) 
            || 
            (dataset.spatial.north + dataset.spatial.south == 0 &&
             dataset.spatial.east + dataset.spatial.west == 0)
        )
        RETURN dataset._id
)
`;

/*
    This query returns a list of dataset_ids that have
    a null coverage object i.e missing map data
*/
export const mapNullQuery: AQLQuery = `
RETURN (
    FOR dataset IN Dataset
        FILTER dataset.spatial == null ||
               dataset.spatial.west == null ||
               dataset.spatial.east == null
        RETURN dataset._id
)
`;
