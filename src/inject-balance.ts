import {config} from "dotenv";
import { AccountBalanceQuery, AccountId, Client, Hbar, HbarUnit, Long, PrivateKey, TransferTransaction } from "@hashgraph/sdk"
import {accounts} from "./config";

config();

export async function validateAndPrefillBalance(recipientAccountId: AccountId, expectedBalance: number){
  const senderAccountId = AccountId.fromString(<string>process.env.MY_ACCOUNT_ID);
  const senderPrivateKey = PrivateKey.fromStringECDSA(<string>process.env.MY_PRIVATE_KEY); // Hedera portal mentions ECDSA

  const client = Client.forTestnet().setOperator(senderAccountId, senderPrivateKey);
  const balanceQuery = await new AccountBalanceQuery().setAccountId(recipientAccountId).execute(client);
  const balance = balanceQuery.hbars.toTinybars();
  const targetBalance = Hbar.from(expectedBalance, HbarUnit.Hbar).toTinybars();
  
  if(balance.compare(targetBalance) >= 0){
    console.log(`Amount need not be prefilled. Account id ${recipientAccountId} has enough balance: ${balanceQuery.hbars.toString(HbarUnit.Hbar)}`);
    client.close();
    return;
  }

  const topUp = targetBalance.subtract(balance);

  const transferTransaction = await new TransferTransaction()
    .addHbarTransfer(senderAccountId, Hbar.fromTinybars(topUp).negated())
    .addHbarTransfer(recipientAccountId, Hbar.fromTinybars(topUp))
    .execute(client);
  
  const receipt = await transferTransaction.getReceipt(client);
  client.close(); 
  console.log("Transfer status:", receipt.status.toString());
  console.log(`Refilled ${Hbar.fromTinybars(topUp)} HBAR`);
}

accounts.forEach(async account => {
  const recipientAccountId = AccountId.fromString(account.id);
  try{
    await validateAndPrefillBalance(recipientAccountId, 100);
  }catch(err){
    if (err instanceof Error){
      console.error(err.message);
    }else{
      JSON.stringify(err);
    }
  }
});
