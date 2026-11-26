import { useCallback, useRef, useState } from 'react';
import { erc20Abi, maxUint256, parseUnits, type Address } from 'viem';
import { useAccount, useSwitchChain, useWriteContract } from 'wagmi';
import { vaultAbi } from '../lib/abis';
import { BASE, type ChainDeployment } from '../lib/deployments';
import { publicClient } from '../lib/logs';

export type TxStage = 'idle' | 'wrong-network' | 'signing' | 'pending' | 'confirmed' | 'failed';
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

/**
 * Turn viem/wallet errors into words a depositor can act on. Chain ids never appear:
 * the transaction row already says which network it is for.
 */
function friendly(error: unknown): string {
  const e = error as {
    name?: string;
    shortMessage?: string;
    message?: string;
    cause?: { name?: string; reason?: string; shortMessage?: string };
  };
  const raw = [e?.cause?.reason, e?.shortMessage, e?.cause?.shortMessage, e?.message]
    .filter(Boolean)
    .join(' ') || String(error);
  const names = `${e?.name ?? ''} ${e?.cause?.name ?? ''}`;

  if (/UserRejected|user rejected|rejected the request|denied (the )?(transaction|request)|action_rejected/i.test(`${names} ${raw}`)) {
    return 'You rejected the request in your wallet, so nothing was sent.';
  }
  if (/insufficient funds|insufficient_funds/i.test(raw)) {
    return 'Not enough ETH in your wallet to pay the network fee.';
  }
  if (/revert|execution reverted/i.test(raw)) {
    return 'The contract rejected this transaction. Nothing was moved.';
  }
  if (/does not match the target chain|chain.*(mismatch|does not match)|wrong network/i.test(raw)) {
    return 'Your wallet is still on a different network. Switch networks and try again.';
  }
  if (/timeout|timed out/i.test(raw)) {
    return 'The network did not confirm in time. Open the transaction on Blockscout before trying again.';
  }
  if (/nonce/i.test(raw)) {
    return 'The wallet nonce is out of date. Reset the wallet activity and try again.';
  }
  return raw.replace(/^Error:\s*/, '').split('\n')[0].slice(0, 200);
}

/**
 * All writes the UI offers: approve+deposit, withdraw, createPlan and cancelPlan.
 * Every action first checks the wallet's own chain. On the wrong chain it arms a
 * "switch" step instead of sending, and resumes the same action once the switch lands.
 */
export function useWrites() {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [tx, setTx] = useState<TxState>(IDLE);
  const continuation = useRef<(() => Promise<void>) | undefined>(undefined);

  const reset = useCallback(() => {
    continuation.current = undefined;
    setTx(IDLE);
  }, []);

  const wait = useCallback(async (hash: `0x${string}`, chain: ChainDeployment) => {
    const client = publicClient(chain.chainId);
    if (!client) throw new Error(`No RPC configured for ${chain.name}.`);
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
        setTx({ stage: 'failed', label, chain, error: friendly(error), ...extra });
      }
    },
    [wait],
  );

  /** Refuse to send on the wrong chain: arm the switch and let the UI offer one button. */
  const gate = useCallback(
    (label: string, chain: ChainDeployment, start: () => Promise<void>) => {
      if (!isConnected || !address) {
        setTx({ stage: 'failed', label, chain, error: 'Connect a wallet first.' });
        return;
      }
      if (walletChainId !== chain.chainId) {
        continuation.current = start;
        setTx({ stage: 'wrong-network', label, chain });
        return;
      }
      void start();
    },
    [address, isConnected, walletChainId],
  );

  const switchChainAndContinue = useCallback(async () => {
    const chain = tx.chain;
    if (!chain) return;
    const next = continuation.current;
    setTx({ stage: 'signing', label: `Switch to ${chain.name}`, chain });
    try {
      await switchChainAsync({ chainId: chain.chainId });
    } catch (error) {
      setTx({ stage: 'failed', label: 'Switch network', chain, error: friendly(error) });
      return;
    }
    continuation.current = undefined;
    if (next) await next();
    else setTx(IDLE);
  }, [switchChainAsync, tx.chain]);

  const approveAndDeposit = useCallback(
    (asset: Address, amount: string, allowance: bigint, walletBalance: bigint, decimals = 6) => {
      gate('Approve and deposit', BASE, async () => {
        let value: bigint;
        try {
          value = parseUnits(amount, decimals);
        } catch {
          setTx({ stage: 'failed', label: 'Deposit', chain: BASE, error: 'Enter a valid amount.' });
          return;
        }
        if (value <= 0n) return setTx({ stage: 'failed', label: 'Deposit', chain: BASE, error: 'Enter an amount above 0.' });
        if (value > walletBalance) return setTx({ stage: 'failed', label: 'Deposit', chain: BASE, error: 'That is more than your wallet holds.' });

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
          setTx({ stage: 'failed', label: 'Approve USDC', chain: BASE, error: friendly(error), approveHash });
          return;
        }

        await run('Deposit', BASE, () => writeContractAsync({
          address: BASE.vault,
          abi: vaultAbi,
          functionName: 'deposit',
          args: [value, address!],
          chainId: BASE.chainId,
        }), { approveHash });
      });
    },
    [address, gate, run, wait, writeContractAsync],
  );

  const withdraw = useCallback(
    (amount: string, maxAssets: bigint, owner: Address, decimals = 6) => {
      gate('Withdraw', BASE, async () => {
        let value: bigint;
        try {
          value = parseUnits(amount, decimals);
        } catch {
          setTx({ stage: 'failed', label: 'Withdraw', chain: BASE, error: 'Enter a valid amount.' });
          return;
        }
        if (value <= 0n) return setTx({ stage: 'failed', label: 'Withdraw', chain: BASE, error: 'Enter an amount above 0.' });
        if (value > maxAssets) return setTx({ stage: 'failed', label: 'Withdraw', chain: BASE, error: 'That is more than the vault holds for you.' });

        await run('Withdraw', BASE, () => writeContractAsync({
          address: BASE.vault,
          abi: vaultAbi,
          functionName: 'withdraw',
          args: [value, address!, owner],
          chainId: BASE.chainId,
        }));
      });
    },
    [address, gate, run, writeContractAsync],
  );

  const createPlan = useCallback(
    (payee: Address, amount: string, period: number, count: number, mode: 0 | 1) => {
      gate('Create standing order', BASE, async () => {
        let value: bigint;
        try {
          value = parseUnits(amount, 6);
        } catch {
          setTx({ stage: 'failed', label: 'Create standing order', chain: BASE, error: 'Enter a valid amount.' });
          return;
        }
        if (value <= 0n) return setTx({ stage: 'failed', label: 'Create standing order', chain: BASE, error: 'Enter an amount above 0.' });
        if (count < 1 || count > 365) return setTx({ stage: 'failed', label: 'Create standing order', chain: BASE, error: 'Payments must be between 1 and 365.' });

        await run('Create standing order', BASE, () => writeContractAsync({
          address: BASE.vault,
          abi: vaultAbi,
          functionName: 'createPlan',
          args: [payee, value, period, count, mode],
          chainId: BASE.chainId,
        }));
      });
    },
    [gate, run, writeContractAsync],
  );

  const cancelPlan = useCallback(
    (chain: ChainDeployment, id: number) => {
      gate('Cancel standing order', chain, async () => {
        await run('Cancel standing order', chain, () => writeContractAsync({
          address: chain.vault,
          abi: vaultAbi,
          functionName: 'cancelPlan',
          args: [BigInt(id)],
          chainId: chain.chainId,
        }));
      });
    },
    [gate, run, writeContractAsync],
  );

  return { tx, reset, approveAndDeposit, withdraw, createPlan, cancelPlan, switchChainAndContinue, isConnected };
}
