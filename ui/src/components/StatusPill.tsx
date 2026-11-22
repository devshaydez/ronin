import { Link } from 'react-router-dom';
import { Pill } from './Pill';
import type { Mode } from '../state/AppState';

/** The vault status pill. Clicking it opens Safety status. */
export function StatusPill({ mode }: { mode: Mode }) {
  const p = mode === 'paused' ? <Pill tone="warn" icon="pause">Paused by AI</Pill>
    : mode === 'exit' ? <Pill tone="bad" icon="x">Pool exited</Pill>
    : mode === 'rec' ? <Pill tone="warn" icon="retry">Recovering</Pill>
    : <Pill icon="ok">Active</Pill>;
  return <Link to="/app/safety" aria-label="Open safety status">{p}</Link>;
}
