import { Segmented } from './Segmented';
import { useApp, type Mode } from '../state/AppState';

const MODES: { value: Mode; label: string }[] = [
  { value: 'ok', label: 'Normal' }, { value: 'paused', label: 'Paused' }, { value: 'exit', label: 'Pool exited' },
  { value: 'wrong', label: 'Wrong network' }, { value: 'nousdc', label: 'No USDC' }, { value: 'rec', label: 'Recovering' },
];
/** Testnet-only helper that lets a reviewer see every designed state. */
export function StatesBar() {
  const { mode, setMode, failNext, setFailNext } = useApp();
  return (
    <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-2.5 px-4 pb-12 text-[13px] text-mut sm:px-6">
      <span>Preview a state:</span>
      <Segmented id="modes" value={mode} onChange={setMode} options={MODES} />
      <span>Next transaction fails:</span>
      <Segmented id="fails" value={failNext ? 'on' : 'off'} onChange={(v) => setFailNext(v === 'on')} options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]} />
    </div>
  );
}
