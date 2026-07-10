import React, { useState } from 'react';
import { Box, Stack, Typography, IconButton, Link, Chip, Tooltip } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { IInspectResult, IExtractedRecord } from '../../types/appData';

const isBranch = (v: any) => v !== null && typeof v === 'object';

// A titled pane: header stays put, body scrolls. minWidth:0 + overflowWrap stop long
// content from stretching the row; px on the body gives fields breathing room.
const Pane: React.FC<{ title: string; mono?: boolean; children: React.ReactNode }> = ({ title, mono, children }) => (
  <Box
    sx={{
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      maxHeight: 340,
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 1.5,
      overflow: 'hidden',
      bgcolor: mono ? 'action.hover' : 'background.paper',
    }}
  >
    <Typography
      variant="caption"
      sx={{
        px: 2,
        py: 1,
        fontWeight: 700,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: 'text.secondary',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      {title}
    </Typography>
    <Box sx={{ flex: 1, overflowY: 'auto', overflowWrap: 'anywhere', px: 2, py: 1.5, ...(mono && { fontFamily: 'monospace', fontSize: 12 }) }}>
      {children}
    </Box>
  </Box>
);

// Collapsible node of the raw parsed metadata.
const RawNode: React.FC<{ name: string; value: any; depth: number }> = ({ name, value, depth }) => {
  const [open, setOpen] = useState(depth < 1);
  const branch = isBranch(value);
  const entries = branch ? Object.entries(value) : [];
  const label = Array.isArray(value) ? `${name}[${entries.length}]` : name;

  return (
    <Box sx={{ pl: depth ? 1.5 : 0 }}>
      <Stack
        direction="row"
        alignItems="flex-start"
        onClick={() => branch && setOpen((o) => !o)}
        sx={{ py: 0.1, cursor: branch ? 'pointer' : 'default', '&:hover': branch ? { color: 'text.primary' } : undefined }}
      >
        <Box sx={{ width: 16, flexShrink: 0, color: 'text.disabled' }}>
          {branch && (open ? <ExpandMoreIcon sx={{ fontSize: 14 }} /> : <ArrowRightIcon sx={{ fontSize: 14 }} />)}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>{label}</Box>
          {!branch && <Box component="span" sx={{ color: 'text.secondary' }}>: {String(value)}</Box>}
        </Box>
      </Stack>
      {branch && open && entries.map(([k, v]) => <RawNode key={k} name={k} value={v} depth={depth + 1} />)}
    </Box>
  );
};

// One labelled field of the mapped IDataAdapter.
const Field: React.FC<{ label: string; value?: React.ReactNode; empty?: boolean }> = ({ label, value, empty }) => (
  <Stack
    direction="row"
    spacing={1.5}
    sx={{ py: 0.85, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}
  >
    <Box sx={{ width: 76, flexShrink: 0, pt: '1px', whiteSpace: 'nowrap', color: 'text.disabled', fontWeight: 600, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' }}>
      {label}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.5, fontStyle: empty ? 'italic' : 'normal', color: empty ? 'text.disabled' : 'text.primary' }}>
      {empty ? '— not found' : value}
    </Box>
  </Stack>
);

const MappedFields: React.FC<{ rec: IExtractedRecord }> = ({ rec }) => {
  const d = rec.dataset;
  const hasGeo = d.spatial && [d.spatial.west, d.spatial.east, d.spatial.south, d.spatial.north].some((n) => n != null);
  return (
    <Stack>
      <Field label="title" value={d.title} empty={!d.title} />
      <Field label="abstract" value={d.abstract} empty={!d.abstract} />
      <Field label="uri" value={<Link href={d.uri} target="_blank" rel="noopener">{d.uri}</Link>} empty={!d.uri} />
      <Field label="published" value={d.publicationDate} empty={!d.publicationDate} />
      <Field label="spatial" value={d.spatial && `W ${d.spatial.west}, E ${d.spatial.east}, S ${d.spatial.south}, N ${d.spatial.north}`} empty={!hasGeo} />
      <Field label="temporal" value={d.temporal && `${d.temporal.start ?? '?'} → ${d.temporal.end ?? '—'}`} empty={!d.temporal?.start} />
      <Field label="authors" value={rec.authors.map((a) => [a.lastName, a.firstName].filter(Boolean).join(', ')).join(' · ')} empty={!rec.authors.length} />
      <Field
        label="keywords"
        empty={!rec.keywords.length}
        value={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {rec.keywords.slice(0, 20).map((k) => (
              <Tooltip key={k.id} title={k.name} placement="top">
                <Chip label={k.name.length > 50 ? `${k.name.slice(0, 6)}…` : k.name} size="small" variant="outlined" sx={{ height: 20 }} />
              </Tooltip>
            ))}
            {rec.keywords.length > 20 && <Typography variant="caption" color="text.disabled" sx={{ alignSelf: 'center' }}>+{rec.keywords.length - 20}</Typography>}
          </Box>
        }
      />
    </Stack>
  );
};

const RecordInspector: React.FC<{ sample: IInspectResult['sample'] }> = ({ sample }) => {
  const [i, setI] = useState(0);
  if (!sample.length) {
    return (
      <Box sx={{ py: 2, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="caption" color="text.disabled">No records on the first page to sample.</Typography>
      </Box>
    );
  }
  const idx = Math.min(i, sample.length - 1);
  const rec = sample[idx];

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="caption" color="text.disabled">Sample records — auto-mapped (per-field editing in a later phase)</Typography>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <IconButton size="small" disabled={idx === 0} onClick={() => setI(idx - 1)}><ChevronLeftIcon fontSize="small" /></IconButton>
          <Typography variant="caption" sx={{ minWidth: 44, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{idx + 1} / {sample.length}</Typography>
          <IconButton size="small" disabled={idx === sample.length - 1} onClick={() => setI(idx + 1)}><ChevronRightIcon fontSize="small" /></IconButton>
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems="stretch">
        <Pane title="Raw metadata" mono>
          <RawNode name="record" value={rec.raw} depth={0} />
        </Pane>
        <Pane title="VESA · IDataAdapter">
          {rec.extracted
            ? <MappedFields rec={rec.extracted} />
            : <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'warning.main' }}>This record could not be mapped (no recognisable metadata).</Typography>}
        </Pane>
      </Stack>
    </Box>
  );
};

export default RecordInspector;
