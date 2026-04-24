import { AQLQuery } from "../types/types";

export const syncHistoryQuery: AQLQuery = `
FOR log IN SyncLogs
  FILTER log.status == 'completed'
  COLLECT prefix = log.prefix INTO group KEEP log
  LET latest = LAST(
    FOR l IN group[*].log SORT l.start_time ASC RETURN l
  )
  RETURN {
    prefix:        latest.prefix,
    source_url:    latest.source_url,
    count_success: latest.count_success,
    start_time:    latest.start_time,
    end_time:      latest.end_time,
    ui_config:     latest.ui_config != null ? latest.ui_config : {}
  }
`;
