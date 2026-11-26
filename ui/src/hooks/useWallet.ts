import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useApp } from '../state/AppState';

const LIVE = !!import.meta.env.VITE_VAULT_ADDRESS;
export const DEMO_ADDRESS = '0x4f2a9b7c3d1e8f6a05b2c4d97e1a3f80b6c2c91e';

/**
 * One wallet API for the whole UI. With no vault address configured it runs a demo wallet,
 * so the app is fully clickable without an extension. With VITE_VAULT_ADDRESS set it uses wagmi.
 */
export function useWallet() {
  const a = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { demoConnected, setDemoConnected, toast } = useApp();
  if (!LIVE) return { connected: demoConnected, address: DEMO_ADDRESS as string | undefined, connect: () => setDemoConnected(true), disconnect: () => setDemoConnected(false), demo: true };
  const connectWallet = () => {
    const connector = connectors[0];
    if (!connector) {
      toast('No browser wallet found. Install MetaMask or another wallet, then reload.');
      return;
    }
    connect({ connector }, { onError: (error) => toast(error.message.split('\n')[0].slice(0, 140)) });
  };
  return { connected: a.isConnected, address: a.address as string | undefined, connect: connectWallet, disconnect: () => disconnect(), demo: false };
}
