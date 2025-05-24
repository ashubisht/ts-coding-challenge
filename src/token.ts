import { Client, Long, PrivateKey, TokenCreateTransaction, TokenId, TokenMintTransaction } from "@hashgraph/sdk";

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
