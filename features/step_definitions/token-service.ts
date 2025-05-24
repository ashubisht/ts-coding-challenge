import { Given, Then, When } from "@cucumber/cucumber";
import { accounts } from "../../src/config";
import { createToken } from "../../src/token";
import { AccountBalanceQuery, AccountId, Client, PrivateKey, TokenInfoQuery } from "@hashgraph/sdk";
import assert from "node:assert";

const client = Client.forTestnet();

Given(/^A Hedera account with more than (\d+) hbar$/, async function (expectedBalance: number) {
  const account = accounts[0]
  const MY_ACCOUNT_ID = AccountId.fromString(account.id);
  const MY_PRIVATE_KEY = PrivateKey.fromStringED25519(account.privateKey);
  client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

//Create the query request
  const query = new AccountBalanceQuery().setAccountId(MY_ACCOUNT_ID);
  const balance = await query.execute(client);
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance, `Account balance is: ${balance.hbars.toBigNumber().toNumber()}`)
});

When(/^I create a token named Test Token \(HTT\)$/, async function () {

  const clientOperator = client.getOperator();
  if(clientOperator == null){
    assert.fail("Client operator is null");
  }

  // Not modifying test case statement above, 
  // so using hardcoded values in this function instead of parameters as used in other test cases
  const tokenTransaction = await createToken("Test Token", "HTT", 2, client);
  const receipt = await tokenTransaction.getReceipt(client)
  this.tokenId = receipt.tokenId;
  assert.ok(this.tokenId, "Received invalid tokenId");
});

Then(/^The token has the name "([^"]*)"$/, async function (name: string) {
  const tokenInfo = await new TokenInfoQuery().setTokenId(this.tokenId).execute(client);
  assert.ok(tokenInfo.name == name);
});

Then(/^The token has the symbol "([^"]*)"$/, async function (symbol: string) {
  const tokenInfo = await new TokenInfoQuery().setTokenId(this.tokenId).execute(client);
  assert.ok(tokenInfo.symbol == symbol);
});

Then(/^The token has (\d+) decimals$/, async function (decimals: number) {
  const tokenInfo = await new TokenInfoQuery().setTokenId(this.tokenId).execute(client);
  assert.ok(tokenInfo.decimals == decimals)
});

Then(/^The token is owned by the account$/, async function () {
  const tokenInfo = await new TokenInfoQuery().setTokenId(this.tokenId).execute(client);
  const clientOperator = client.getOperator();
  assert.ok(clientOperator !== null, "Invalid client");
  assert.ok(tokenInfo.treasuryAccountId !== null, "Treasury Id should not be null");
  assert.ok(tokenInfo.treasuryAccountId.equals(clientOperator.accountId));
});

Then(/^An attempt to mint (\d+) additional tokens succeeds$/, async function () {

});
When(/^I create a fixed supply token named Test Token \(HTT\) with (\d+) tokens$/, async function () {

});
Then(/^The total supply of the token is (\d+)$/, async function () {

});
Then(/^An attempt to mint tokens fails$/, async function () {

});
Given(/^A first hedera account with more than (\d+) hbar$/, async function () {

});
Given(/^A second Hedera account$/, async function () {

});
Given(/^A token named Test Token \(HTT\) with (\d+) tokens$/, async function () {

});
Given(/^The first account holds (\d+) HTT tokens$/, async function () {

});
Given(/^The second account holds (\d+) HTT tokens$/, async function () {

});
When(/^The first account creates a transaction to transfer (\d+) HTT tokens to the second account$/, async function () {

});
When(/^The first account submits the transaction$/, async function () {

});
When(/^The second account creates a transaction to transfer (\d+) HTT tokens to the first account$/, async function () {

});
Then(/^The first account has paid for the transaction fee$/, async function () {

});
Given(/^A first hedera account with more than (\d+) hbar and (\d+) HTT tokens$/, async function () {

});
Given(/^A second Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function () {

});
Given(/^A third Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function () {

});
Given(/^A fourth Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function () {

});
When(/^A transaction is created to transfer (\d+) HTT tokens out of the first and second account and (\d+) HTT tokens into the third account and (\d+) HTT tokens into the fourth account$/, async function () {

});
Then(/^The third account holds (\d+) HTT tokens$/, async function () {

});
Then(/^The fourth account holds (\d+) HTT tokens$/, async function () {

});
