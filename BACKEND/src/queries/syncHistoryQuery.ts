import { AQLQuery } from "../types/types";

// One entry per source label that has records in the graph, whatever its last job's status, so a
// stopped, failed or still-running import stays visible (and deletable) instead of becoming orphaned
// data. A label whose latest job wrote nothing falls back to its latest job that did.
export const syncHistoryQuery: AQLQuery = `
FOR log IN SyncLogs
  FILTER log.count_success > 0
  COLLECT prefix = log.prefix INTO group KEEP log
  LET latest = LAST(
    FOR l IN group[*].log SORT l.start_time ASC RETURN l
  )
  RETURN {
    prefix:        latest.prefix,
    source_url:    latest.source_url,
    count_success: latest.count_success,
    status:        latest.status,
    start_time:    latest.start_time,
    end_time:      latest.end_time != null ? latest.end_time : latest.start_time,
    ui_config:     latest.ui_config != null ? latest.ui_config : {}
  }
`;
