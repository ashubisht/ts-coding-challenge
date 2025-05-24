import { Client, TokenCreateTransaction } from "@hashgraph/sdk";

export async function createToken(name: string, symbol: string, decimal: number, client: Client) {
  const operator = client.getOperator();
  if(!operator){
    throw new Error("Client operator is null or undefined");
  }

  return new TokenCreateTransaction()
    .setTokenName(name)
    .setTokenSymbol(symbol)
    .setDecimals(decimal)
    .setAdminKey(operator.publicKey)
    .setTreasuryAccountId(operator.accountId)
    .execute(client);
}
