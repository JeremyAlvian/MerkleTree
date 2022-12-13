const express = require("express");
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const waitlisted = require('./waitlisted.json');
const reserved = require('./reserved.json');
const ethers = require('ethers');
const cors = require('cors');
const Web3 = require('web3');

const app = express();
app.use(cors())


const web3 = new Web3(new Web3.providers.HttpProvider('https://rinkeby.infura.io/v3/8ce97ac16c8041a0b9a3101dd303eb60'));

const contract = new web3.eth.Contract([
   {
    "inputs": [],
    "name": "status",
    "outputs": [
      {
        "internalType": "enum FuzzyFighters.Status",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
      "inputs": [],
      "name": "totalSupply",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
], '0x531d7cdd88c7086a1b56de55defb7a5faf49991d');

function hashAllowanceWhitelist(account, allowance) {
    return Buffer.from(ethers.utils.solidityKeccak256(['address', 'uint256'], [account, allowance]).slice(2), 'hex')
}



var merkleTreeWhitelist = new MerkleTree(Object.entries(waitlisted).map(item => hashAllowanceWhitelist(...item)), keccak256, { sortPairs: true });
var merkleTreeReserved = new MerkleTree(reserved.map(addr => keccak256(addr)), keccak256, { sortPairs: true });


app.listen(3000, () => {
    console.log("Server running on port 3000");
});

app.get("/", (req, res, next) => {
    res.json("FUZZ");
});

app.get("/markle/root/whitelist", (req, res, next) => {
    res.json({
        root: merkleTreeWhitelist.getHexRoot()
    });
});

app.get("/markle/root/reserved", (req, res, next) => {
    res.json({
        root: merkleTreeReserved.getHexRoot()
    });
});

app.get("/whitelist/:address", (req, res, next) => {
    let address = req.params.address;
    let allowance = waitlisted[address] || 0;
    if (allowance == 0) {
        allowance = waitlisted[address.toLowerCase()] || 0;
    }
    res.json({
        whitelist: (allowance > 0),
        allowance: allowance,
        proof: (allowance <= 0) ? null : merkleTreeWhitelist.getHexProof(hashAllowanceWhitelist(address, allowance))
    });
});


app.get("/reserved/:address", (req, res, next) => {
    let address = req.params.address;
    let index = reserved.indexOf(address)
    if (index == -1) {
        index = reserved.indexOf(address.toLowerCase());
    }
    res.json({
        whitelist: (index > -1),
        allowance: 1,
        proof: merkleTreeReserved.getHexProof(keccak256(address))
    });
});

app.get("/contract/info", (req, res, next) => {
  Promise.all([
    contract.methods.status().call(),
    contract.methods.totalSupply().call()
  ]).then(results=>{
    res.json({
        status: results[0],
        totalSupply:results[1]
    });
  }).catch(err=>{
    console.log(err);
    res.json({
        err: err
    });
  })
});

