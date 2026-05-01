# Final-Project-SOL

Final-Project-SOL is a neighborhood investment platform built with React, Vite, Privy, Viem, and Solidity smart contracts.

The project allows local communities to create DAOs, add verified members, propose local investment projects, vote on those projects, lock funds, manage project status, and distribute yield transparently on-chain.

## Project Goal

The main goal of this project is to help local communities pool money and make investment decisions together.

A community can create a DAO for a real location, add members after KYC checks, create investment proposals, allow verified members to vote, and distribute returns when an investment generates profit.

HOW IT WORKS:

1. A founder creates a local DAO.
2. Admins add and verify members.
3. Admins create investment proposals.
4. Verified members vote on proposals.
5. Yes votes can stake USDC.
6. Approved investments can be activated.
7. Finance managers or admins distribute yield.
8. Members who supported a successful investment can claim their share.

## Main Features

### Frontend Features

- Landing page for unauthenticated users.
- Privy authentication and embedded wallet support.
- Dashboard showing active DAOs, total TVL, yield, and proposals.
- DAO creation flow with location, membership, governance, and logo upload steps.
- IPFS image upload through Pinata.
- DAO discovery page.
- Investment proposal listing and filtering.
- Proposal creation for founders and admins.
- Voting interface for verified members.
- KYC and admin management screen.
- Wallet screen showing connected wallet and portfolio data.
- Yield screen for claiming yield, distributing yield, and withdrawing eligible stake.
- Toast notifications for success, warning, and error messages.

### Smart Contract Features

- Factory contract for deploying LocalDAO clones.
- LocalDAO contract for each community.
- Member management with KYC verification.
- Founder, admin, and finance manager roles.
- Investment proposal creation.
- USDC-backed voting.
- Free downvotes and staked upvotes.
- Investment activation and status management.
- Escrow tracking for locked project funds.
- Phased fund release.
- Yield deposits and yield claiming.
- Unclaimed yield recovery after a grace period.
- Pause and unpause controls.
- Activity timeline events.

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Privy authentication
- Viem
- Ethers
- Lucide React icons
- React Toastify

### Smart Contracts

- Solidity 0.8.20
- Foundry
- OpenZeppelin Contracts
- Forge Standard Library
- EIP-1167 minimal proxy clones

### External Services

- Privy for authentication and embedded wallets.
- Pinata for IPFS file uploads.
- Block explorer links from the configured explorer URL.
- Optional Supabase utilities for waitlist and DAO chat features.

## Project Structure

```text
.
├── App.tsx
├── index.tsx
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env.example
├── components/
├── layouts/
├── views/
├── utils/
├── public/
└── contract/
    ├── src/
    ├── test/
    ├── script/
    ├── lib/
    └── foundry.toml
```

### Important Root Files

- `App.tsx`: Controls the main app state and decides which view to show.
- `index.tsx`: Starts the React app and configures Privy.
- `vite.config.ts`: Vite configuration, local server settings, and aliases.
- `.env.example`: Example environment variables.
- `package.json`: Frontend scripts and dependencies.
- `public/whitepaper.html`: Static whitepaper page.

### Important Folders

- `components/`: Reusable UI and landing page sections.
- `layouts/`: Shared app layout, including the authenticated app shell.
- `views/`: Main pages such as dashboard, DAO creation, voting, wallet, yields, and KYC/admin tools.
- `utils/`: Contract helpers, chain settings, IPFS upload, address formatting, explorer links, notifications, and other helper logic.
- `contract/`: Solidity smart contracts, tests, deployment scripts, and Foundry configuration.

## Frontend Views

### Landing Page

The landing page is shown before a user logs in. It introduces the platform and calls Privy login when the user chooses to enter the app.

Main file:

```text
views/LandingPage.tsx
```

### Dashboard

The dashboard is shown after login. It loads on-chain DAO data, proposal data, and yield data.

It shows:

- Total value locked.
- Total yield generated.
- Number of active DAOs.
- Active DAO list.
- Proposals that need votes.

Main file:

```text
views/Dashboard.tsx
```

### Create DAO

This page guides a founder through creating a new local DAO.

The form collects:

- DAO name.
- Location.
- Description.
- Coordinates.
- Postal code.
- Investment focus.
- Governance settings.
- Membership settings.
- Optional DAO logo.

The DAO is created by calling the `LocalDAOFactory` smart contract.

Main file:

```text
views/CreateDAO.tsx
```

### Discover

This page is used to browse available DAOs.

Main file:

```text
views/Discover.tsx
```

### Investment Listing

This page lists investment opportunities across DAOs.

Users can filter investments by status:

- All
- Proposed
- Active
- Incomplete
- Completed

Founders and admins can create new proposals from this page.

Main file:

```text
views/InvestmentListing.tsx
```

### Voting Interface

This page lets verified DAO members vote on investment proposals.

Voting rules:

- Yes votes require a USDC stake.
- No votes are free.
- Only verified members can vote.
- Voting must happen before the proposal deadline.

Main file:

```text
views/VotingInterface.tsx
```

### KYC and Admin Management

This page is used by founders and admins to manage DAO members and permissions.

Supported actions include:

- Add member.
- Verify member KYC.
- Remove member.
- Add admin.
- Remove admin.
- Add finance manager.
- Remove finance manager.
- Activate investment.
- Mark investment incomplete.
- Close investment.
- Sweep unclaimed yield.
- Pause DAO.
- Unpause DAO.

Main file:

```text
views/KYCVerification.tsx
```

### Wallet

This page shows wallet-related data for the connected user.

It displays:

- Current connected wallet.
- Current chain name.
- DAO treasury snapshot.
- Total TVL.
- Claimable yield.

Main file:

```text
views/Wallet.tsx
```

### Yields

This page shows yield information.

Members can:

- View generated yield.
- Claim available yield.
- Withdraw eligible stake.

Finance managers, admins, and founders can:

- Deposit yield for investments.
- Attach an expense report CID.

Main file:

```text
views/Yields.tsx
```

# Smart Contract Overview

The smart contracts are inside the `contract/` folder.

### LocalDAOFactory

File:

```text
contract/src/LocalDAOFactory.sol
```

The factory deploys new DAO instances.

It uses OpenZeppelin's `Clones` library to create EIP-1167 minimal proxy clones. This is cheaper than deploying a full new contract every time.

Main responsibilities:

- Store the LocalDAO implementation address.
- Deploy new DAO clones.
- Initialize each clone.
- Track all DAO addresses.
- Track active DAOs.
- Store basic DAO metadata.
- Allow the factory owner to deactivate a DAO.

Important functions:

- `createDAO(...)`
- `getAllDAOs()`
- `getActiveDAOs()`
- `isValidDAO(...)`
- `getDAOMetadata(...)`
- `deactivateDAO(...)`

### LocalDAO

File:

```text
contract/src/LocalDAO.sol
```

This is the main DAO contract.

Each DAO clone has its own:

- Name.
- Description.
- Location.
- Coordinates.
- Postal code.
- Member list.
- Admin list.
- Finance manager list.
- Investment proposals.
- Votes.
- USDC treasury data.
- Yield distribution records.

Important functions include:

- `initialize(...)`
- `addMember(...)`
- `verifyMemberKYC(...)`
- `removeMember(...)`
- `exitDAO()`
- `createInvestment(...)`
- `vote(...)`
- `activateInvestment(...)`
- `markInvestmentIncomplete(...)`
- `extendDeadline(...)`
- `releaseNextPhase(...)`
- `withdrawStake(...)`
- `depositYield(...)`
- `claimYield(...)`
- `closeInvestment(...)`
- `sweepUnclaimedYield(...)`
- `addAdmin(...)`
- `removeAdmin(...)`
- `addFinanceManager(...)`
- `removeFinanceManager(...)`
- `updateDAOInfo(...)`
- `pause()`
- `unpause()`

### Libraries

The contract uses helper libraries in:

```text
contract/src/libraries/
```

Current libraries:

- `InvestmentManager.sol`
- `YieldCalculator.sol`
- `StringUtils.sol`

These keep some investment, yield, and string logic separate from the main contract.

### Interface

The shared contract interface is:

```text
contract/src/interfaces/ILocalDAO.sol
```

This defines shared enums, structs, and function signatures used by the DAO contract.

## Contract Roles

### Creator

The creator is the wallet that creates the DAO.

The creator can:

- Add and remove admins.
- Add and remove finance managers.
- Pause and unpause the DAO.
- Perform admin-level actions.

### Admin

Admins help manage the DAO.

Admins can:

- Add members.
- Verify KYC.
- Remove members.
- Create investment proposals.
- Activate eligible investments.
- Manage project statuses.

### Finance Manager

Finance managers help manage investment funds and returns.

Finance managers can:

- Deposit yield.
- Help manage investment financial actions.

### Verified Member

Verified members are DAO members whose KYC has been approved.

Verified members can:

- Vote on proposals.
- Stake USDC on yes votes.
- Claim yield from successful investments they supported.
- Withdraw eligible stake when allowed.

## Environment Variables

Create a local environment file from the example:

```bash
cp .env.example .env
```

Then fill in the needed values.

### Required for Login

```text
VITE_PRIVY_APP_ID=
```

This is required. Without it, the frontend will show a missing Privy App ID message.

### Chain Configuration

```text
VITE_CHAIN_ID=
VITE_CHAIN_NAME=
VITE_RPC_URL=
VITE_EXPLORER_URL=
VITE_EXPLORER_URLS=
```

If these are not set, the app uses defaults from `utils/contract.ts`.

Current defaults in the frontend:

```text
Chain ID: 4202
Chain Name: Lisk Sepolia
RPC URL: https://rpc.sepolia-api.lisk.com
Explorer URL: https://sepolia-blockscout.lisk.com
```

### Contract Addresses

```text
VITE_FACTORY_ADDRESS=
VITE_USDC_ADDRESS=
```

`VITE_FACTORY_ADDRESS` should point to the deployed `LocalDAOFactory`.

`VITE_USDC_ADDRESS` should point to the USDC token contract or a mock USDC token on your target network.

### IPFS Uploads

```text
VITE_PINATA_JWT=
VITE_IPFS_UPLOAD_TIMEOUT_MS=
```

`VITE_PINATA_JWT` is needed for DAO logo uploads through Pinata.

`VITE_IPFS_UPLOAD_TIMEOUT_MS` is optional. If it is not set, the app uses 60000 milliseconds.

### Optional Supabase Variables

Some helper files contain optional Supabase support:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

These are not required for the main contract workflow unless you are using the waitlist or DAO chat utilities.

### Optional App URL

```text
VITE_APP_BASE_URL=
```

This can be used by the landing page when building share or navigation links.

### Optional Gemini Variable

```text
GEMINI_API_KEY=
```

The Vite config exposes this as `process.env.API_KEY` and `process.env.GEMINI_API_KEY`.

## Installation

Install frontend dependencies:

```bash
npm install
```

The repository also contains a `yarn.lock`, so Yarn can also be used if your team prefers it:

```bash
yarn install
```

Use one package manager consistently to avoid lockfile conflicts.

## Running the Frontend

Start the development server:

```bash
npm run dev
```

The Vite server is configured to run on:

```text
http://localhost:3000
```

Build the app:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Running Smart Contract Commands

Move into the contract folder:

```bash
cd contract
```

Build contracts:

```bash
forge build
```

Run tests:

```bash
forge test
```

Format Solidity files:

```bash
forge fmt
```

## Deploying Contracts

The deployment script is:

```text
contract/script/DeployLocalDAO.s.sol
```

The script deploys:

1. A `LocalDAO` implementation contract.
2. A `LocalDAOFactory` contract.
3. One initial DAO for testing.

Before deploying, set your private key:

```bash
export PRIVATE_KEY=your_private_key_here
```

Run the deployment script from the `contract` folder:

```bash
forge script script/DeployLocalDAO.s.sol:DeployLocalDAO --rpc-url <your_rpc_url> --broadcast
```

After deployment:

1. Copy the deployed factory address.
2. Add it to `.env` as `VITE_FACTORY_ADDRESS`.
3. Add your stablecoin address as `VITE_USDC_ADDRESS`.
4. Restart the frontend dev server.

## Main User Flow

### 1. User Logs In

The user signs in through Privy. If the user does not already have a wallet, Privy can create embedded Ethereum and Solana wallets.

### 2. Founder Creates DAO

The founder fills in DAO details and submits a transaction to the factory contract.

The factory deploys a new LocalDAO clone and initializes it with the founder as creator.

### 3. Admin Adds Members

The founder or admin adds member wallet addresses and stores a KYC proof hash.

### 4. Admin Verifies KYC

The founder or admin marks a member as KYC verified.

Only verified members can vote.

### 5. Admin Creates Investment Proposal

An admin creates an investment proposal with:

- Name.
- Category.
- Funding amount.
- Expected yield.
- Grade.
- Deadline.
- Document CIDs.

### 6. Members Vote

Verified members vote yes or no.

Yes votes stake USDC and can receive yield later.

No votes do not stake USDC and do not receive yield.

### 7. Admin Activates Investment

If the investment meets the contract rules, an admin can activate it.

### 8. Finance Manager Deposits Yield

When the investment generates returns, a finance manager, admin, or creator deposits yield into the DAO contract.

### 9. Members Claim Yield

Members who supported the investment can claim their share of the yield.

## Frontend and Contract Connection

The main frontend contract helper is:

```text
utils/localDaoContracts.ts
```

This file:

- Creates public and wallet clients.
- Reads active DAOs from the factory.
- Reads investments from DAO contracts.
- Creates DAO transactions.
- Creates investment transactions.
- Sends votes.
- Handles yield deposits and claims.
- Handles member and role management.
- Formats USDC values.
- Converts errors into useful frontend behavior.

The chain settings and factory ABI are in:

```text
utils/contract.ts
```

## Data Storage

### On-Chain Data

The following data is stored on-chain:

- DAO metadata.
- Members.
- KYC verification status.
- Admin and finance manager roles.
- Investments.
- Votes.
- Staked amounts.
- Yield distribution data.
- Timeline events.

### Off-Chain Data

The following data is stored off-chain:

- Uploaded images on IPFS.
- KYC documents or references.
- Optional waitlist or chat data if Supabase is used.

The contract stores hashes or CIDs where needed instead of storing private documents directly.

## Testing

Frontend build test:

```bash
npm run build
```

Contract tests:

```bash
cd contract
forge test
```

## Common Problems

### Missing Privy App ID

Problem:

```text
Missing Privy App ID
```

Fix:

Set `VITE_PRIVY_APP_ID` in `.env` and restart the dev server.

### Wrong Network

Problem:

The wallet refuses transactions or says the chain is unsupported.

Fix:

Check that the wallet network matches:

- `VITE_CHAIN_ID`
- `VITE_CHAIN_NAME`
- `VITE_RPC_URL`
- The network where the factory was deployed

### DAO Creation Fails

Possible causes:

- Wallet rejected the transaction.
- Wallet does not have enough native token for gas.
- `VITE_FACTORY_ADDRESS` is wrong.
- `VITE_USDC_ADDRESS` is empty or invalid.
- Wallet is connected to the wrong network.

### IPFS Upload Fails

Possible causes:

- `VITE_PINATA_JWT` is missing.
- Pinata key does not have the right permissions.
- Network request timed out.
- Browser or hosting environment blocked the request.

### Contract Reads Return Empty Data

Possible causes:

- Factory address points to a network with no DAOs.
- RPC URL is wrong.
- App is connected to a different chain than the deployed contracts.
- The DAO was deployed but marked inactive.



## Useful Commands

Install dependencies:

```bash
npm install
```

Run frontend:

```bash
npm run dev
```

Build frontend:

```bash
npm run build
```

Preview frontend build:

```bash
npm run preview
```

Build contracts:

```bash
cd contract
forge build
```

Run contract tests:

```bash
cd contract
forge test
```

Format contracts:

```bash
cd contract
forge fmt
```

Deploy contracts:

```bash
cd contract
forge script script/DeployLocalDAO.s.sol:DeployLocalDAO --rpc-url <your_rpc_url> --broadcast
```

## Current Limitations

- The frontend network defaults and some UI messages are not fully aligned.
- The deploy script contains a placeholder stable token address.
- Pinata is required for image uploads unless the upload flow is changed.
- KYC verification is represented by hashes and admin actions; the real document review process happens off-chain.
- The app depends on correct deployed contract addresses in the environment.

## 

Final-Project-SOL is a full-stack Web3 application for community-owned local investment.

The frontend provides the user experience for creating communities, managing members, voting, and claiming yield. The Solidity contracts enforce the rules for membership, voting, treasury accounting, investment status, and yield distribution.

The most important setup step is making sure the frontend environment variables match the network and contract addresses where the smart contracts are deployed.
