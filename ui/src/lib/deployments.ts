/**
 * Public deployment data for the current build (2026-11-22 deployment).
 * Addresses are public chain state copied from DEPLOYMENTS.md; every one can be
 * overridden from the environment so a redeploy never needs a source change.
 */
const env = import.meta.env;

export const BASE_DEPLOY_BLOCK = 62_173_780n;
export const UNICHAIN_DEPLOY_BLOCK = 68_504_320n;
export const LASNA_DEPLOY_BLOCK = 8_979_790n;

export const BASE_CHAIN_ID = 84532;
export const UNICHAIN_CHAIN_ID = 1301;
export const LASNA_CHAIN_ID = 5318007;

export interface ChainDeployment {
  chainId: number;
  chain: 'base' | 'unichain';
  name: 'Base Sepolia' | 'Unichain Sepolia';
  vault: `0x${string}`;
  registry: `0x${string}`;
  requester: `0x${string}`;
  deployBlock: bigint;
}

const addr = (value: string | undefined, fallback: string) => (value || fallback) as `0x${string}`;

export const BASE: ChainDeployment = {
  chainId: BASE_CHAIN_ID,
  chain: 'base',
  name: 'Base Sepolia',
  vault: addr(env.VITE_VAULT_ADDRESS, '0xCD50707FED3Ef829b0965D6DDCF0Dab56e5cce66'),
  registry: addr(env.VITE_REGISTRY_ADDRESS, '0x1Ba4da5288751378c1813a256885c7e376592D34'),
  requester: addr(env.VITE_REQUESTER_ADDRESS, '0xd3f0BD4a232AD8061DD119564AF64D8b6f340eBb'),
  deployBlock: BASE_DEPLOY_BLOCK,
};

export const UNICHAIN: ChainDeployment = {
  chainId: UNICHAIN_CHAIN_ID,
  chain: 'unichain',
  name: 'Unichain Sepolia',
  vault: addr(env.VITE_UNICHAIN_VAULT_ADDRESS, '0xce75a97917c8fd52eA30684F0988FAe4485D64cD'),
  registry: addr(env.VITE_UNICHAIN_REGISTRY_ADDRESS, '0xA97D4F33F029928B8c0B54Ee47129Aa39F51007f'),
  requester: addr(env.VITE_UNICHAIN_REQUESTER_ADDRESS, '0xFcC603B48675Ae138890BF4A155A13A378DAA5B5'),
  deployBlock: UNICHAIN_DEPLOY_BLOCK,
};

export const CHAINS = [BASE, UNICHAIN] as const;

export const RSC = addr(env.VITE_RSC_ADDRESS, '0x69107baF143C38722744a09e3f27c3c076469d5f');
export const SYSTEM_CONTRACT = '0x8888888888888888888888888888888888888888' as const;

/** Pool U is the breaker demo pool on Unichain; its freeze flag is shown on Safety. */
export const POOL_U = addr(env.VITE_POOL_U_ADDRESS, '0x79387679Eb59e5692b3FC566Dcc3fE484eBDB9F4');

export const BASE_RPC = env.VITE_BASE_RPC || 'https://base-sepolia-rpc.publicnode.com';
export const UNICHAIN_RPC = env.VITE_UNICHAIN_RPC || 'https://unichain-sepolia-rpc.publicnode.com';
export const LASNA_RPC = env.VITE_LASNA_RPC || 'https://lasna-rpc.rnk.dev/';

/** Blockscout transaction page. The official scanners answer automated reads with a challenge. */
export const explorerTx = (chain: 'base' | 'unichain' | 'lasna', hash: string) =>
  chain === 'base'
    ? `https://base-sepolia.blockscout.com/tx/${hash}`
    : chain === 'unichain'
      ? `https://unichain-sepolia.blockscout.com/tx/${hash}`
      : `https://lasna.reactscan.net/tx/${hash}`;
