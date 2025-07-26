
# MedChain Vault Backend

This is the backend API for **MedChain Vault** – a secure, blockchain-powered platform for uploading, verifying, and managing Electronic Medical Records (EMRs) with on-chain access control.

---

## Features

* **Secure File Upload**: Receives EMRs, hashes files, uploads to IPFS, and logs file info to the smart contract.
* **On-chain Audit Trail**: Fetches all upload events for transparent history.
* **Access Control**: Lets file owners grant or revoke access to files for specific users (wallet addresses).
* **Verification**: Allows anyone with permission to verify a file’s authenticity and integrity.

---

## Stack

* **Node.js** (Express.js)
* **Ethers.js** (for smart contract interaction)
* **Pinata** (IPFS file storage)
* **Multer** (handling file uploads)
* **dotenv** (environment variables)

---

## Quick Start

### 1. **Install Dependencies**

```bash
npm install
```

### 2. **Configure Environment**

Create a `.env` file in `/backend` with these variables:

```
CONTRACT_ADDRESS=0xYourContractAddress
PRIVATE_KEY=your_private_key
RPC_URL=https://your_rpc_url
PINATA_API_KEY=your_pinata_api_key
PINATA_API_SECRET=your_pinata_api_secret
```

### 3. **Start the Server**

```bash
npm start
```

Server will run on `http://localhost:5000` by default and hosted on `https://medchainvaultbackend.onrender.com`.

---

## API Endpoints

* `POST /upload` – Upload a file (needs MetaMask-signed hash, wallet address)
* `GET /getFile/:hash` – Get file record by hash (checks access)
* `GET /auditTrail` – Get list of uploaded files (from blockchain events)
* `POST /grantAccess` – Grant file access to a wallet address
* `POST /revokeAccess` – Revoke file access for a wallet address
* `GET /canAccess/:fileHash/:address` – Check if an address can access a file

---

## How It Works

1. **Upload**: User uploads a file and signs its hash with MetaMask. Server stores file on IPFS and logs metadata to blockchain.
2. **Verify**: Any user with access can verify a file’s authenticity using the blockchain.
3. **Access Control**: Only the uploader can grant/revoke access for others, enforced by the smart contract.

---

## Security Notes

* **Never commit your `.env` or private key to GitHub!**
* MetaMask signature is required for upload authentication.

---

## For Developers

* All smart contract interactions use [Ethers.js](https://docs.ethers.org/).
* See `index.js` for implementation.
* Modify CORS if deploying frontend elsewhere.

---

## Credits

Built by **Team Hack Demons** for hackathons and innovation!
