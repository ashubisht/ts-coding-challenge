import { Given, Then, When } from "@cucumber/cucumber";
import { accounts } from "../../src/config";
import { createToken, mintToken } from "../../src/token";
import { AccountBalanceQuery, AccountId, Client, Long, PrivateKey, TokenInfoQuery } from "@hashgraph/sdk";
import assert from "node:assert";

const client = Client.forTestnet();

Given(/^A Hedera account with more than (\d+) hbar$/, async function (expectedBalance: number) {
  const account = accounts[0];
  const MY_ACCOUNT_ID = AccountId.fromString(account.id);
  const MY_PRIVATE_KEY = PrivateKey.fromStringED25519(account.privateKey);
  client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

//Create the query request
  const query = new AccountBalanceQuery().setAccountId(MY_ACCOUNT_ID);
  const balance = await query.execute(client);
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance, `Account balance is: ${balance.hbars.toBigNumber().toNumber()}`);
});

When(/^I create a token named Test Token \(HTT\)$/, async function () {

  const clientOperator = client.getOperator();
  if(clientOperator == null){
    assert.fail("Client operator is null");
  }

  // Not modifying test case statement above, 
  // so using hardcoded values in this function instead of parameters as used in other test cases
  const tokenTransaction = await createToken("Test Token", "HTT", 2, true, client);
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
  assert.ok(tokenInfo.decimals == decimals);
});

Then(/^The token is owned by the account$/, async function () {
  const tokenInfo = await new TokenInfoQuery().setTokenId(this.tokenId).execute(client);
  const clientOperator = client.getOperator();
  assert.ok(clientOperator !== null, "Invalid client");
  assert.ok(tokenInfo.treasuryAccountId !== null, "Treasury Id should not be null");
  assert.ok(tokenInfo.treasuryAccountId.equals(clientOperator.accountId));
});

Then(/^An attempt to mint (\d+) additional tokens succeeds$/, async function (amount: number) {
  const privateKey = PrivateKey.fromStringED25519(accounts[0].privateKey);
  const mintTransaction = await mintToken(amount, this.tokenId, privateKey, client);
  const receipt = await mintTransaction.getReceipt(client);
  assert.strictEqual(receipt.status.toString(), "SUCCESS", "Minting failed");

  const tokenInfo = await new TokenInfoQuery().setTokenId(this.tokenId).execute(client);
  assert.strictEqual(tokenInfo.totalSupply.toBigInt(), BigInt(amount), "Token supply does not match");
});

When(/^I create a fixed supply token named Test Token \(HTT\) with (\d+) tokens$/, async function (totalSupply: number) {
  const tx = await createToken("Test Token", "HTT", 2, false, client, BigInt(totalSupply));
  const receipt = await tx.getReceipt(client);
  this.tokenId = receipt.tokenId;

  assert.ok(this.tokenId, "Failed to create token");
});
Then(/^The total supply of the token is (\d+)$/, async function (totalSupply: number) {
  const tokenInfo = await new TokenInfoQuery().setTokenId(this.tokenId).execute(client);
  assert.strictEqual(tokenInfo.totalSupply.toBigInt(), BigInt(totalSupply), "Total supply of token does not match");
});
Then(/^An attempt to mint tokens fails$/, async function () {
  const privateKey = PrivateKey.fromStringED25519(accounts[0].privateKey);
  const mintTransaction = await mintToken(1, this.tokenId, privateKey, client);
  
  await assert.rejects(()=>mintTransaction.getReceipt(client), (err: Error) => {return err.message.includes("TOKEN_HAS_NO_SUPPLY_KEY")} , "Expected mint transaction to fail with message TOKEN_HAS_NO_SUPPLY");
});
Given(/^A first hedera account with more than (\d+) hbar$/, async function (expectedBalance: number) {
  // Repeat test case???? Similar to TC1: Given hedera account
  const operator = client.getOperator();
  assert.ok(operator, "Client operator is null or undefined");

  //Create the query request
  const query = new AccountBalanceQuery().setAccountId(operator.accountId);
  const balance = await query.execute(client);
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance, `Account balance is: ${balance.hbars.toBigNumber().toNumber()}`);
});
Given(/^A second Hedera account$/, async function () {
  const secondAccount = {
    id: accounts[1].id,
    privateKey: PrivateKey.fromStringED25519(accounts[1].privateKey)
  }
  this.secondClient = Client.forTestnet().setOperator(secondAccount.id, secondAccount.privateKey);
  assert.equal(this.secondClient.getOperator()?.accountId.toString(), secondAccount.id, "Unable to set second Hedera account");
});
Given(/^A token named Test Token \(HTT\) with (\d+) tokens$/, async function (totalSupply: number) {
  const tokenTransaction = await createToken("Test Token", "HTT", 2, true, client, BigInt(totalSupply));
  const receipt = await tokenTransaction.getReceipt(client)
  this.tokenId = receipt.tokenId;
  assert.ok(this.tokenId, "Received invalid tokenId");
});
Given(/^The first account holds (\d+) HTT tokens$/, async function (expectedBalance: number) {
  const balance = await new AccountBalanceQuery().setAccountId(accounts[0].id).execute(client);
  assert.ok(balance.tokens, "Expected account to hold tokens but none found");
  const tokenbalance = balance.tokens.get(this.tokenId);
  assert.ok(tokenbalance, "Token balance not found or token does not exists");
  assert.equal(tokenbalance.toNumber(), expectedBalance, "Token balance and expected balance does not match");
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
