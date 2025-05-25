import { AccountId, AccountInfoQuery, Client, Long, PrivateKey, TokenAssociateTransaction, TokenCreateTransaction, TokenId, TokenMintTransaction, TransferTransaction } from "@hashgraph/sdk";
import { Account } from "./config";

export async function createToken(name: string, symbol: string, decimal: number, isMintable: boolean, client: Client, initialSupply?: bigint) {
  const operator = client.getOperator();
  if(!operator){
    throw new Error("Client operator is null or undefined");
  }

  const tokenCreateTx = new TokenCreateTransaction()
    .setTokenName(name)
    .setTokenSymbol(symbol)
    .setDecimals(decimal)
    .setAdminKey(operator.publicKey)
    .setTreasuryAccountId(operator.accountId);

  if(initialSupply){
    tokenCreateTx.setInitialSupply(Long.fromBigInt(initialSupply))
  }

  if(isMintable){
    tokenCreateTx.setSupplyKey(operator.publicKey);
  }

  return tokenCreateTx.execute(client);
}

export async function mintToken(amount: number, tokenId: TokenId, privateKey: PrivateKey, client: Client ){
   const operator = client.getOperator();
  if (!operator) {
    throw new Error("Client operator is null or undefined");
  }

  const tokenMintTransaction = await new TokenMintTransaction()
    .setTokenId(tokenId)
    .setAmount(amount)
    .freezeWith(client)
    .sign(privateKey);

  return tokenMintTransaction.execute(client);
}

export async function isAssosciated(account: Account, token: TokenId) {
  const accountId = account.id;
  const privateKey = PrivateKey.fromStringED25519(account.privateKey);
  const client = Client.forTestnet().setOperator(accountId, privateKey);

  const accountInfo = await new AccountInfoQuery()
  .setAccountId(accountId)
  .execute(client);

  return accountInfo.tokenRelationships.get(token) !== null;
}

export async function assosciateAccount(account: Account, tokenId: TokenId) {
  const client = Client
  .forTestnet().setOperator(account.id, account.privateKey);
  const privateKey = PrivateKey.fromStringED25519(account.privateKey);
  const associateTx = await new TokenAssociateTransaction()
    .setAccountId(account.id)
    .setTokenIds([tokenId])
    .freezeWith(client)
    .sign(privateKey);
  
  return await associateTx.execute(client);
}

export async function createTransferTokenTx(amount: number, tokenId: TokenId, senderAccount: Account, receiverAccountId: AccountId, client?: Client){
  const senderAccId = AccountId.fromString(senderAccount.id);
  const senderPrivateKey = PrivateKey.fromStringED25519(senderAccount.privateKey);
  const txClient = client || Client.forTestnet().setOperator(senderAccId, senderPrivateKey);

  return new TransferTransaction()
    .addTokenTransfer(tokenId, senderAccId, - amount)
    .addTokenTransfer(tokenId, receiverAccountId, amount)
    .freezeWith(txClient)
    .sign(senderPrivateKey);
}

export async function transferToken(amount: number, tokenId: TokenId, senderAccount: Account, receiverAccountId: AccountId ){
  const senderAccId = AccountId.fromString(senderAccount.id);
  const senderPrivateKey = PrivateKey.fromStringED25519(senderAccount.privateKey);
  const client = Client.forTestnet().setOperator(senderAccId, senderPrivateKey);

  const transferTx = await createTransferTokenTx(amount, tokenId, senderAccount, receiverAccountId, client);
  return await transferTx.execute(client);
}

export async function createMultiPartyTransferTokenTx(amounts: number[], tokenId: TokenId, accounts: Account[], client: Client){
  const transferTx = new TransferTransaction();
  if(amounts.length !== accounts.length){
    throw new Error("Size of amount array and sender accounts array do not match");
  }
  if(accounts.length < 2){
    throw new Error("Length of accounts must be greater than 2");
  }

  amounts.forEach((amount, index) => {
    const accountId = AccountId.fromString(accounts[index].id);
    transferTx.addTokenTransfer(tokenId, accountId, amount);
  });
  
  transferTx.freezeWith(client);

  amounts.forEach((amount, index) => {
    const privateKey = PrivateKey.fromStringED25519(accounts[index].privateKey);
    if(amount < 0){ // A sender account
      transferTx.sign(privateKey);
    }
  });
  
  return transferTx;
}
