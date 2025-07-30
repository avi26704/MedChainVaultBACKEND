import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import axios from 'axios';
import { ethers } from 'ethers';
import fs from 'fs';
import cors from 'cors';
import FormData from 'form-data';
import contractJson from './contracts/BlockVault.json' assert { type: 'json' };

const contractABI = contractJson.abi;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);

const upload = multer({ dest: 'uploads/' });
const app = express();
const PORT = process.env.PORT || 5000;
app.use(
  cors({
    origin: [
      "https://med-chain-vault-frontend.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  })
);
app.use(express.json());

// Utility: compute file hash
const getFileHash = (filePath) => {
  const fileBuffer = fs.readFileSync(filePath);
  return ethers.keccak256(new Uint8Array(fileBuffer));
};

// Utility: Upload to Pinata (IPFS)
async function uploadToPinata(filepath, filename) {
  const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
  const data = new FormData();
  data.append('file', fs.createReadStream(filepath), filename);

  const res = await axios.post(url, data, {
    maxBodyLength: Infinity,
    headers: {
      ...data.getHeaders(),
      'pinata_api_key': process.env.PINATA_API_KEY,
      'pinata_secret_api_key': process.env.PINATA_API_SECRET
    }
  });
  return res.data.IpfsHash;
}

// 1. File Upload Route
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const walletAddress = req.body.walletAddress;
    const signature = req.body.signature;

    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    if (!walletAddress || !signature) return res.status(400).json({ error: 'Missing wallet address or signature' });

    const fileHash = getFileHash(file.path);

    // Upload to IPFS (Pinata)
    const ipfsCID = await uploadToPinata(file.path, file.originalname);

    // Log to blockchain
    const tx = await contract.uploadFile(fileHash, ipfsCID, signature);
    await tx.wait();

    fs.unlinkSync(file.path);

    res.json({
      status: "success",
      txHash: tx.hash,
      fileHash,
      ipfsCID
    });
  } catch (err) {
    console.error(err);

    let errorMsg = "Upload failed";
    if (err.reason) {
      errorMsg += ": " + err.reason;
    } else if (err.error && err.error.message) {
      errorMsg += ": " + err.error.message;
    } else if (err.message) {
      errorMsg += ": " + err.message;
    }

    res.status(500).json({ error: errorMsg, details: err.stack });
  }
});

// 2. Get File Record (for verification)
app.get('/getFile/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    // NOTE: In production, access control is checked by contract (msg.sender)
    // Here, backend uses provider (relayer) account, so it should have access to all records.
    const record = await contract.getFileRecord(hash);
    res.json({
      uploader: record.uploader || record[0],
      ipfsCID: record.ipfsCID || record[1],
      signature: record.signature || record[2],
      timestamp: Number(record.timestamp || record[3])
    });
  } catch (err) {
    // If contract throws "Access denied", this will return empty.
    res.json({});
  }
});

// 3. Audit Trail — All upload events (recent)
app.get("/auditTrail", async (req, res) => {
  try {
    const latestBlock = await provider.getBlockNumber();
    const eventSignature = "FileUploaded(bytes32,address,string,bytes,uint256)";
    const eventTopic = ethers.id(eventSignature);

    let events = [];
    const batchSize = 500;
    let fromBlock = Math.max(0, latestBlock - 5000); // last 5000 blocks
    let toBlock = latestBlock;

    for (let start = fromBlock; start <= toBlock; start += batchSize) {
      const end = Math.min(start + batchSize - 1, toBlock);
      const batchLogs = await provider.getLogs({
        address: contract.address,
        fromBlock: start,
        toBlock: end,
        topics: [eventTopic]
      });

      batchLogs.forEach(log => {
        const parsed = contract.interface.parseLog(log);
        events.push({
          fileHash: parsed.args.fileHash,
          uploader: parsed.args.uploader,
          ipfsCID: parsed.args.ipfsCID,
          signature: parsed.args.signature,
          timestamp: Number(parsed.args.timestamp),
          txHash: log.transactionHash
        });
      });
    }

    // Sort most recent first
    events.sort((a, b) => b.timestamp - a.timestamp);

    res.json({ status: "success", data: events.slice(0, 50) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch audit trail", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`BlockVault backend running on port ${PORT}`);
});
