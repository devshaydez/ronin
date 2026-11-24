import type { ExplorerChain } from '../lib/mode';

export interface ProofRow {
  label: string;
  chain: ExplorerChain;
  chainName: string;
  hash: string;
  block?: number;
}

/**
 * Receipts from the 2026-11-23 Phase B2 run on the 2026-11-22 deployment.
 * These are allowed to be static only because the UI labels this as a measured
 * proof block linked to ai-service/PROOF.md. Live pages never use this as state.
 */
export const MEASURED_PROOF: ProofRow[] = [
  { label: 'Rebalanced, verdict 44', chain: 'unichain', chainName: 'Unichain Sepolia', hash: '0xa71bcca7a280c61258e0050226b3287bcfdf5d416aa2cef386ce602a32b54ece', block: 68615069 },
  { label: 'Retry callback, verdict 44', chain: 'lasna', chainName: 'Reactive Lasna', hash: '0x9e80c7d4e81944796819688f5404cb3dfd80f90231a9a69e903b5e5b3fceebfa', block: 9084301 },
  { label: 'LoopClosed, 683 s recovery', chain: 'lasna', chainName: 'Reactive Lasna', hash: '0x21032d303e9860d0b7c84e6a70aad5da9728766d3a81f78ed3a6c325a6a82dc1', block: 9084303 },
  { label: 'BreakerTripped(1301, U)', chain: 'lasna', chainName: 'Reactive Lasna', hash: '0x691e0c939e31a06f040bf39dea366bc38151c2cbbbfe04422bf941734c3aea64', block: 9076500 },
  { label: 'Payout, yield then principal', chain: 'unichain', chainName: 'Unichain Sepolia', hash: '0xbdedac6bfd0c82f619e0e635db842ccbe4cd284d109abead35809861b1a0f69e', block: 68608178 },
  { label: 'UnpausedByReactive, omnichain heal', chain: 'base', chainName: 'Base Sepolia', hash: '0x1bcddab6b02b99651e4e719c40e9076ea5cc4f3da6bad99f8f629e5e6073a723', block: 62687892 },
];
