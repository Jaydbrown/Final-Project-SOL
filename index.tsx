
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PrivyProvider } from "@privy-io/react-auth";
import { APP_CHAIN } from "./utils/contract";
import 'react-toastify/dist/ReactToastify.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const privyAppId = (import.meta.env.VITE_PRIVY_APP_ID ?? "").trim();
console.log(privyAppId, "Privy ID")

const root = ReactDOM.createRoot(rootElement);
if (!privyAppId) {
  root.render(
    <React.StrictMode>
      <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>Missing Privy App ID</h1>
        <p>Set <code>VITE_PRIVY_APP_ID</code> in <code>.env</code>, then restart the dev server.</p>
      </div>
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <PrivyProvider
        appId={privyAppId}
        config={{
          embeddedWallets: {
            ethereum: {
              createOnLogin: "users-without-wallets",
            },
            solana: {
              createOnLogin: "users-without-wallets",
            },
          },
          appearance: { walletChainType: "ethereum-and-solana" },
          supportedChains: [APP_CHAIN]
        }}
      >
        <App />
      </PrivyProvider>
    </React.StrictMode>
  );
}
