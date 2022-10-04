import { ethers } from 'ethers';

export default class EthersServer {
  getProvider(rpcUrl: string) {
    return ethers.providers.getDefaultProvider(rpcUrl);
  }

  getWallet(privateKey: string, provider: ethers.providers.Provider) {
    const wallet = new ethers.Wallet(privateKey, provider);
    return wallet;
  }

  getContract(address: string, abi: string, provider: ethers.providers.Provider) {
    return new ethers.Contract(address, abi, provider);
  }
}
