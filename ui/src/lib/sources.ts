import { registryAbi, requesterAbi, rscAbi, vaultEventsAbi } from './abis';
import { BASE, LASNA_CHAIN_ID, LASNA_DEPLOY_BLOCK, RSC, UNICHAIN } from './deployments';
import type { LogSource } from './logs';

export const SOURCES = {
  baseVault: { key: 'base-vault', chainId: BASE.chainId, address: BASE.vault, abi: vaultEventsAbi, fromBlock: BASE.deployBlock },
  baseRegistry: { key: 'base-registry', chainId: BASE.chainId, address: BASE.registry, abi: registryAbi, fromBlock: BASE.deployBlock },
  baseRequester: { key: 'base-requester', chainId: BASE.chainId, address: BASE.requester, abi: requesterAbi, fromBlock: BASE.deployBlock },
  uniVault: { key: 'uni-vault', chainId: UNICHAIN.chainId, address: UNICHAIN.vault, abi: vaultEventsAbi, fromBlock: UNICHAIN.deployBlock },
  uniRegistry: { key: 'uni-registry', chainId: UNICHAIN.chainId, address: UNICHAIN.registry, abi: registryAbi, fromBlock: UNICHAIN.deployBlock },
  uniRequester: { key: 'uni-requester', chainId: UNICHAIN.chainId, address: UNICHAIN.requester, abi: requesterAbi, fromBlock: UNICHAIN.deployBlock },
  rsc: { key: 'rsc', chainId: LASNA_CHAIN_ID, address: RSC, abi: rscAbi, fromBlock: LASNA_DEPLOY_BLOCK },
} satisfies Record<string, LogSource>;

export type SourceKey = keyof typeof SOURCES;
