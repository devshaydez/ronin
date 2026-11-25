import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { formatUnits, type Address } from 'viem';
import { mockVault } from '../data/mock';
import { vaultAbi, erc20Abi } from '../lib/abis';
import { BASE } from '../lib/deployments';
import { LIVE } from '../lib/mode';

const VAULT = BASE.vault;

/**
 * The connected wallet's live ERC-4626 position plus the USDC balance and allowance needed to
 * deposit. In demo mode everything is `undefined` and the app keeps its labelled sample data.
 */
export function useVault() {
  const { address } = useAccount();

  const base = useReadContracts({
    contracts: [
      { abi: vaultAbi, address: VAULT, functionName: 'asset', chainId: BASE.chainId },
      { abi: vaultAbi, address: VAULT, functionName: 'balanceOf', args: [address ?? '0x0000000000000000000000000000000000000000'], chainId: BASE.chainId },
      { abi: vaultAbi, address: VAULT, functionName: 'maxWithdraw', args: [address ?? '0x0000000000000000000000000000000000000000'], chainId: BASE.chainId },
      { abi: vaultAbi, address: VAULT, functionName: 'yieldAvailable', args: [address ?? '0x0000000000000000000000000000000000000000'], chainId: BASE.chainId },
      { abi: vaultAbi, address: VAULT, functionName: 'costBasis', args: [address ?? '0x0000000000000000000000000000000000000000'], chainId: BASE.chainId },
      { abi: vaultAbi, address: VAULT, functionName: 'totalAssets', chainId: BASE.chainId },
    ],
    query: { enabled: LIVE && !!address, refetchInterval: 5_000 },
  });

  const asset = base.data?.[0]?.result as Address | undefined;
  const shares = base.data?.[1]?.result as bigint | undefined;
  const maxWithdraw = base.data?.[2]?.result as bigint | undefined;
  const yieldAvailable = base.data?.[3]?.result as bigint | undefined;
  const costBasis = base.data?.[4]?.result as bigint | undefined;
  const totalAssets = base.data?.[5]?.result as bigint | undefined;

  const assets = useReadContract({
    abi: vaultAbi,
    address: VAULT,
    functionName: 'convertToAssets',
    args: shares !== undefined ? [shares] : undefined,
    chainId: BASE.chainId,
    query: { enabled: LIVE && shares !== undefined, refetchInterval: 5_000 },
  });

  const token = useReadContracts({
    contracts: [
      { abi: erc20Abi, address: asset ?? '0x0000000000000000000000000000000000000000', functionName: 'balanceOf', args: [address ?? '0x0000000000000000000000000000000000000000'], chainId: BASE.chainId },
      { abi: erc20Abi, address: asset ?? '0x0000000000000000000000000000000000000000', functionName: 'allowance', args: [address ?? '0x0000000000000000000000000000000000000000', VAULT], chainId: BASE.chainId },
      { abi: erc20Abi, address: asset ?? '0x0000000000000000000000000000000000000000', functionName: 'decimals', chainId: BASE.chainId },
      { abi: erc20Abi, address: asset ?? '0x0000000000000000000000000000000000000000', functionName: 'symbol', chainId: BASE.chainId },
    ],
    query: { enabled: LIVE && !!address && !!asset, refetchInterval: 8_000 },
  });

  const decimals = Number((token.data?.[2]?.result as number | undefined) ?? 6);
  const walletBalance = token.data?.[0]?.result as bigint | undefined;
  const allowance = token.data?.[1]?.result as bigint | undefined;
  const symbol = (token.data?.[3]?.result as string | undefined) ?? 'USDC';
  const live = LIVE && assets.data !== undefined;

  return {
    live,
    configured: LIVE,
    address,
    vault: VAULT,
    chainId: BASE.chainId,
    asset,
    decimals,
    symbol,
    balance: live ? Number(formatUnits(assets.data!, decimals)) : undefined,
    balanceWei: assets.data,
    shares,
    maxWithdraw,
    maxWithdrawNum: maxWithdraw !== undefined ? Number(formatUnits(maxWithdraw, decimals)) : undefined,
    yieldAvailable,
    yieldNum: yieldAvailable !== undefined ? Number(formatUnits(yieldAvailable, decimals)) : undefined,
    costBasis,
    totalAssets,
    totalNum: totalAssets !== undefined ? Number(formatUnits(totalAssets, decimals)) : undefined,
    walletBalance,
    walletNum: walletBalance !== undefined ? Number(formatUnits(walletBalance, decimals)) : undefined,
    allowance,
    loading: base.isLoading || assets.isLoading || token.isLoading,
    error: base.error ?? assets.error ?? token.error,
    apy: mockVault.apy,
    deposited: mockVault.deposited,
  };
}
