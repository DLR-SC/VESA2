/*
  This query recieves a list of dataset_id
  from a POST request,
  and returns information about the PANGAEA dataset and STAC dataset
*/

import { AQLQuery } from "../types/types";

/*
          RESPONSE INTERFACE
    {
      id: string,
      locationData : {
        west_bound_longitude : number, 
        east_bound_longitude : number,
        north_bound_longitude : number, 
        south_bound_longitude : number, 
        mean_latitude : number,
        mean_longitude : number
      },
      doi : string,
      dataset_publication_date ?: string, // This is only for PANGAEA
      temporal_coverage : {
        start_date : string,
        end_date : string
      },
      authors ?: string[], // This is only for PANGAEA
      providers ?: string[], // This is only for STAC
      dataset_title : string
      dataset_source_prefix : string
    }
*/

/**
 * @param keys - Array of dataset ids
 * @returns - Array of objects containing Dataset/STACCollection information
 */

export const mainQuery: AQLQuery = `
LET arrayList = @keys
LET array = FLATTEN(arrayList)

LET validDatasets = array[* FILTER SPLIT(CURRENT, "/")[0] == 'Dataset']

FOR dataset IN DOCUMENT(validDatasets)
    FILTER dataset != null
    
    // Fetch Author Names via traversal (Hardware accelerated)
    LET authorNameList = (
        FOR author IN 1..1 OUTBOUND dataset._id HasAuthor
            RETURN CONCAT(author.firstName, ' ', author.lastName)
    )

    // Temporal Logic
    LET start_date = dataset.temporal.start
    LET end_date = (dataset.temporal.end == null AND start_date != null) || (start_date == dataset.temporal.end AND start_date != null) 
                    ? DATE_ADD(start_date, 1, "day") 
                    : dataset.temporal.end

    RETURN {
        id: dataset._id,
        location_data: {
            west_bound_longitude: dataset.spatial.west,
            east_bound_longitude: dataset.spatial.east,
            north_bound_latitude: dataset.spatial.north,
            south_bound_latitude: dataset.spatial.south,
            mean_latitude: (dataset.spatial.north + dataset.spatial.south) / 2,
            mean_longitude: (dataset.spatial.east + dataset.spatial.west) / 2
        },
        doi: dataset.uri,
        dataset_publication_date: dataset.publicationDate,
        temporal_coverage: {
            start_date: start_date,
            end_date: end_date
        },
        authors: authorNameList,
        dataset_title: dataset.title,
        dataset_source_prefix: dataset.source_prefix != null ? dataset.source_prefix : 'NO_SOURCE_PREFIX_AVAILABLE'
    }
`;
