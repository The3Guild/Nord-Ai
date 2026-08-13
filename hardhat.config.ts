import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const QUAI_TESTNET_RPC_URL = process.env.QUAI_TESTNET_RPC_URL ?? "";
const QUAI_PRIVATE_KEY = process.env.QUAI_PRIVATE_KEY ?? "";
const QUAISCAN_API_KEY = process.env.QUAISCAN_API_KEY ?? "";
const SOLIDITYX_COMPILER_PATH = process.env.SOLIDITYX_COMPILER_PATH ?? "";

if (SOLIDITYX_COMPILER_PATH) {
  require("quai-hardhat-plugin");
}

const config = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    quaiTestnet: {
      url: QUAI_TESTNET_RPC_URL,
      accounts: QUAI_PRIVATE_KEY ? [QUAI_PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
} as HardhatUserConfig;

if (SOLIDITYX_COMPILER_PATH) {
  (config as unknown as Record<string, unknown>).solidityx = {
    compilerPath: SOLIDITYX_COMPILER_PATH,
  };
}

export default config;
