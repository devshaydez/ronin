import { useCallback, useState } from 'react';
import { erc20Abi, maxUint256, parseUnits, type Address } from 'viem';
import { useAccount, useChainId, useSwitchChain, useWriteContract } from 'wagmi';
import { vaultAbi } from '../lib/abis';
import { BASE, type ChainDeployment } from '../lib/deployments';
import { publicClient } from '../lib/logs';

export type TxStage = 'idle' | 'signing' | 'pending' | 'confirmed' | 'failed';
export interface TxState {
  stage: TxStage;
  label: string;
  hash?: `0x${string}`;
  chain?: ChainDeployment;
  error?: string;
  /** A second hash when approve and deposit are two transactions. */
  approveHash?: `0x${string}`;
}

const IDLE: TxState = { stage: 'idle', label: '' };

function message(error: unknown) {
  const e = error as { shortMessage?: string; message?: string };
  const raw = e?.shortMessage || e?.message || String(error);
  return raw.split('\n')[0].slice(0, 220);
}

/**
 * All writes the UI offers: approve+deposit, withdraw, createPlan and cancelPlan.
 * Every action reports signing, pending, confirmed or failed, and keeps the tx hash for Blockscout.
 */
export function useWrites() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [tx, setTx] = useState<TxState>(IDLE);

  const reset = useCallback(() => setTx(IDLE), []);

  const wait = useCallback(async (hash: `0x${string}`, chain: ChainDeployment) => {
    const client = publicClient(chain.chainId);
    if (!client) throw new Error(`No RPC for chain ${chain.chainId}`);
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
    if (receipt.status !== 'success') throw new Error(`Transaction reverted on ${chain.name}`);
    return receipt;
  }, []);

  const run = useCallback(
    async (label: string, chain: ChainDeployment, send: () => Promise<`0x${string}`>, extra?: { approveHash?: `0x${string}` }) => {
      setTx({ stage: 'signing', label, chain, ...extra });
      try {
        const hash = await send();
        setTx({ stage: 'pending', label, chain, hash, ...extra });
        await wait(hash, chain);
        setTx({ stage: 'confirmed', label, chain, hash, ...extra });
      } catch (error) {
        setTx({ stage: 'failed', label, chain, error: message(error), ...extra });
      }
    },
    [wait],
  );

  const wrongNetwork = isConnected && chainId !== BASE.chainId;
  const switchToBase = useCallback(async () => {
    try {
      await switchChainAsync({ chainId: BASE.chainId });
    } catch (error) {
      setTx({ stage: 'failed', label: 'Switch network', chain: BASE, error: message(error) });
    }
  }, [switchChainAsync]);

  const approveAndDeposit = useCallback(
    async (asset: Address, amount: string, allowance: bigint, walletBalance: bigint, decimals = 6) => {
      if (!isConnected || !address) throw new Error('Connect a wallet first');
      let value: bigint;
      try {
        value = parseUnits(amount, decimals);
      } catch {
        setTx({ stage: 'failed', label: 'Deposit', chain: BASE, error: 'Enter a valid amount.' });
        return;
      }
      if (value <= 0n) return setTx({ stage: 'failed', label: 'Deposit', chain: BASE, error: 'Enter an amount above 0.' });
      if (value > walletBalance) return setTx({ stage: 'failed', label: 'Deposit', chain: BASE, error: 'That is more than your wallet holds.' });
      if (chainId !== BASE.chainId) {
        try {
          await switchChainAsync({ chainId: BASE.chainId });
        } catch (error) {
          setTx({ stage: 'failed', label: 'Switch network', chain: BASE, error: message(error) });
          return;
        }
      }
      let approveHash: `0x${string}` | undefined;
      try {
        if (allowance < value) {
          setTx({ stage: 'signing', label: 'Approve USDC', chain: BASE });
          approveHash = await writeContractAsync({
            address: asset,
            abi: erc20Abi,
            functionName: 'approve',
            args: [BASE.vault, maxUint256],
            chainId: BASE.chainId,
          });
          setTx({ stage: 'pending', label: 'Approve USDC', chain: BASE, hash: approveHash, approveHash });
          await wait(approveHash, BASE);
        }
      } catch (error) {
        setTx({ stage: 'failed', label: 'Approve USDC', chain: BASE, error: message(error), approveHash });
        return;
      }
      await run('Deposit', BASE, () => writeContractAsync({
        address: BASE.vault,
        abi: vaultAbi,
        functionName: 'deposit',
        args: [value, address],
        chainId: BASE.chainId,
      }), { approveHash });
    },
    [address, chainId, isConnected, run, switchChainAsync, wait, writeContractAsync],
  );

  const withdraw = useCallback(
    async (amount: string, maxAssets: bigint, owner: Address, decimals = 6) => {
      if (!isConnected || !address) throw new Error('Connect a wallet first');
      let value: bigint;
      try {
        value = parseUnits(amount, decimals);
      } catch {
        setTx({ stage: 'failed', label: 'Withdraw', chain: BASE, error: 'Enter a valid amount.' });
        return;
      }
      if (value <= 0n) return setTx({ stage: 'failed', label: 'Withdraw', chain: BASE, error: 'Enter an amount above 0.' });
      if (value > maxAssets) return setTx({ stage: 'failed', label: 'Withdraw', chain: BASE, error: 'That is more than the vault holds for you.' });
      if (chainId !== BASE.chainId) {
        try {
          await switchChainAsync({ chainId: BASE.chainId });
        } catch (error) {
          setTx({ stage: 'failed', label: 'Switch network', chain: BASE, error: message(error) });
          return;
        }
      }
      await run('Withdraw', BASE, () => writeContractAsync({
        address: BASE.vault,
        abi: vaultAbi,
        functionName: 'withdraw',
        args: [value, address, owner],
        chainId: BASE.chainId,
      }));
    },
    [address, chainId, isConnected, run, switchChainAsync, writeContractAsync],
  );

  const createPlan = useCallback(
    async (payee: Address, amount: string, period: number, count: number, mode: 0 | 1) => {
      if (!isConnected) throw new Error('Connect a wallet first');
      let value: bigint;
      try {
        value = parseUnits(amount, 6);
      } catch {
        setTx({ stage: 'failed', label: 'Create order', chain: BASE, error: 'Enter a valid amount.' });
        return;
      }
      if (value <= 0n) return setTx({ stage: 'failed', label: 'Create order', chain: BASE, error: 'Enter an amount above 0.' });
      if (count < 1 || count > 365) return setTx({ stage: 'failed', label: 'Create order', chain: BASE, error: 'Payments must be between 1 and 365.' });
      if (chainId !== BASE.chainId) {
        try {
          await switchChainAsync({ chainId: BASE.chainId });
        } catch (error) {
          setTx({ stage: 'failed', label: 'Switch network', chain: BASE, error: message(error) });
          return;
        }
      }
      await run('Create standing order', BASE, () => writeContractAsync({
        address: BASE.vault,
        abi: vaultAbi,
        functionName: 'createPlan',
        args: [payee, value, period, count, mode],
        chainId: BASE.chainId,
      }));
    },
    [chainId, isConnected, run, switchChainAsync, writeContractAsync],
  );

  const cancelPlan = useCallback(
    async (chain: ChainDeployment, id: number) => {
      if (!isConnected) throw new Error('Connect a wallet first');
      if (chainId !== chain.chainId) {
        try {
          await switchChainAsync({ chainId: chain.chainId });
        } catch (error) {
          setTx({ stage: 'failed', label: 'Switch network', chain, error: message(error) });
          return;
        }
      }
      await run('Cancel standing order', chain, () => writeContractAsync({
        address: chain.vault,
        abi: vaultAbi,
        functionName: 'cancelPlan',
        args: [BigInt(id)],
        chainId: chain.chainId,
      }));
    },
    [chainId, isConnected, run, switchChainAsync, writeContractAsync],
  );

  return { tx, reset, approveAndDeposit, withdraw, createPlan, cancelPlan, wrongNetwork, switchToBase, isConnected };
}
