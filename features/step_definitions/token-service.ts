import { Before, Given, Then, When } from "@cucumber/cucumber";
import { Account, accounts } from "../../src/config";
import { assosciateAccount, createMultiPartyTransferTokenTx, createToken, createTransferTokenTx, isAssosciated, mintToken, transferToken } from "../../src/token";
import { AccountBalanceQuery, AccountId, Client, Long, PrivateKey, TokenInfoQuery, TransactionResponse, TransferTransaction } from "@hashgraph/sdk";
import assert from "node:assert";

const client = Client.forTestnet();

Before(function (scenario) {
  this.scenario = scenario;
});

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
  const firstAccount = {
    id: accounts[1].id,
    privateKey: PrivateKey.fromStringED25519(accounts[1].privateKey)
  }
  this.firstClient = Client.forTestnet().setOperator(firstAccount.id, firstAccount.privateKey);
  assert.equal(this.firstClient.getOperator()?.accountId.toString(), firstAccount.id, "Unable to set first Hedera account");
});
Given(/^A second Hedera account$/, async function () {
  const secondAccount = {
    id: accounts[2].id,
    privateKey: PrivateKey.fromStringED25519(accounts[2].privateKey)
  }
  this.secondClient = Client.forTestnet().setOperator(secondAccount.id, secondAccount.privateKey);
  assert.equal(this.secondClient.getOperator()?.accountId.toString(), secondAccount.id, "Unable to set second Hedera account");
});
Given(/^A token named Test Token \(HTT\) with (\d+) tokens$/, async function (totalSupply: number) {
  const tokenTransaction = await createToken("Test Token", "HTT", 2, true, client, BigInt(totalSupply));
  const receipt = await tokenTransaction.getReceipt(client)
  this.tokenId = receipt.tokenId;
  assert.ok(this.tokenId, "Received invalid tokenId");

  // In one scenario, I need to initialise 1st account, while on other scenario, I need to initialised other accounts
  if(this.scenario.pickle.name === "Transfer tokens between 2 accounts"){
    this.firstAccountUnitialised = true;
  }else if(this.scenario.pickle.name === "Create a token transfer transaction paid for by the recipient"){
    this.secondAccountUnitialised = true;
  }
});
Given(/^The first account holds (\d+) HTT tokens$/, {timeout: 10000}, async function (expectedTokenBalance: number) {
  const senderAccount: Account = accounts[0];
  const firstAccount = accounts[1];
  const receiverAccountId = AccountId.fromString(firstAccount.id);
  const firstClient: Client = this.firstClient;

  // Assosciate Account
  const isFirstAccountAssosciated = await isAssosciated(firstAccount, this.tokenId);
  if(!isFirstAccountAssosciated){
    const assosciateTransaction = await assosciateAccount(firstAccount, this.tokenId);
    const receipt = await assosciateTransaction.getReceipt(firstClient);
    assert.equal(receipt.status.toString(), "SUCCESS", "Token assosciation failed");
  }

  // Add balance to first account. Same step is run before and after. First time, I need to have some HTT from 0 HTT
  // while second time I need to only check balance, not add HTT.
  // Either I need to add a step in feature file to initialise account, or use some global variable to know
  // when I need to add balance vs when I do not need to add balance.
  if(this.firstAccountUnitialised){
    const tokenTransferTx = await transferToken(expectedTokenBalance, this.tokenId, senderAccount, receiverAccountId);
    const receipt = await tokenTransferTx.getReceipt(firstClient);
    assert.equal(receipt.status.toString(), "SUCCESS", "Token transfer failed");
    this.firstAccountUnitialised = false;
  }

  // Confirm balance
  const balance = await new AccountBalanceQuery().setAccountId(firstAccount.id).execute(firstClient);
  assert.ok(balance.tokens, "Expected account to hold tokens but none found");
  const tokenbalance = balance.tokens.get(this.tokenId);
  assert.ok(tokenbalance, "Token balance not found or token does not exists");
  assert.equal(tokenbalance.toNumber(), expectedTokenBalance, "Token balance and expected balance does not match");
});
Given(/^The second account holds (\d+) HTT tokens$/, {timeout: 10000}, async function (expectedTokenBalance: number) {
  const senderAccount: Account = accounts[0];
  const secondAccount = accounts[2];
  const receiverAccountId = AccountId.fromString(secondAccount.id);
  const secondClient: Client = this.secondClient;

  // Assosciate Account
  const isSecondAccountAssosciated = await isAssosciated(secondAccount, this.tokenId);
  if(!isSecondAccountAssosciated){
    const assosciateTransaction = await assosciateAccount(secondAccount, this.tokenId);
    const receipt = await assosciateTransaction.getReceipt(secondClient);
    assert.equal(receipt.status.toString(), "SUCCESS", "Token assosciation failed");
  }

  // Add balance to first account. Same step is run before and after. First time, I need to have 100 HTT from 0 HTT
  // while second time I need to only check balance, not add HTT.
  // Either I need to add a step in feature file to initialise account, or use some global variable to know
  // when I need to add balance vs when I do not need to add balance.
  if(this.secondAccountUnitialised){
    const tokenTransferTx = await transferToken(expectedTokenBalance, this.tokenId, senderAccount, receiverAccountId);
    const receipt = await tokenTransferTx.getReceipt(secondClient);
    assert.equal(receipt.status.toString(), "SUCCESS", "Token transfer failed");
    this.secondAccountUnitialised = false;
  }
  
  // Confirm balance
  const balance = await new AccountBalanceQuery().setAccountId(secondAccount.id).execute(secondClient);
  assert.ok(balance.tokens, "Expected account to hold tokens but none found");
  const tokenbalance = balance.tokens.get(this.tokenId);
  assert.ok(tokenbalance, "Token balance not found or token does not exists");
  assert.equal(tokenbalance.toNumber(), expectedTokenBalance, "Token balance and expected balance does not match");
});
When(/^The first account creates a transaction to transfer (\d+) HTT tokens to the second account$/, async function (amount: number) {
  const receiverAccountId = AccountId.fromString(accounts[2].id);
  const createTokenTrasferTx = await createTransferTokenTx(amount, this.tokenId, accounts[1], receiverAccountId);
  assert.ok(createTokenTrasferTx, "Token transfer transaction could not be created");
  this.createTokenTrasferTx = createTokenTrasferTx;
});
When(/^The first account submits the transaction$/, async function () {
  const client: Client = this.firstClient;
  const createTokenTrasferTx: TransferTransaction = this.createTokenTrasferTx;
  const tokenTransferTx = await createTokenTrasferTx.execute(client);
  const receipt = await tokenTransferTx.getReceipt(client);
  assert.equal(receipt.status.toString(), "SUCCESS", "Unable to submit token transfer transaction");
  this.executedTokenTransferTx = tokenTransferTx;
});
When(/^The second account creates a transaction to transfer (\d+) HTT tokens to the first account$/, async function (amount: number) {
  const receiverAccountId = AccountId.fromString(accounts[1].id);
  const createTokenTrasferTx = await createTransferTokenTx(amount, this.tokenId, accounts[2], receiverAccountId, this.firstClient);
  assert.ok(createTokenTrasferTx, "Token transfer transaction could not be created");
  this.createTokenTrasferTx = createTokenTrasferTx;
});
Then(/^The first account has paid for the transaction fee$/, async function () {
  const createdTokenTrasferTx: TransactionResponse = this.executedTokenTransferTx;
  const record = await createdTokenTrasferTx.getRecord(client);
  const transfers = record.transfers;
  const payer = transfers.find(transfer => transfer.accountId.toString() === accounts[1].id);
  assert.ok(payer, "Payer is not found. First Account has not paid the transaction fees");
  assert.ok(payer.amount.toTinybars().isNegative(), "Expected payer did not pay the transaction fees");
});
Given(/^A first hedera account with more than (\d+) hbar and (\d+) HTT tokens$/, {timeout: 20000}, async function (expectedBalance: number, expectedTokenBalance: number) {
  const privateKey = PrivateKey.fromStringED25519(accounts[1].privateKey);
  const firstClient = Client.forTestnet().setOperator(accounts[1].id, privateKey);

  // Assosciate Account
  const assosciateTransaction = await assosciateAccount(accounts[1], this.tokenId);
  let receipt = await assosciateTransaction.getReceipt(firstClient);
  assert.equal(receipt.status.toString(), "SUCCESS", "Token assosciation failed");

  // Check hbar balance
  const query = new AccountBalanceQuery().setAccountId(accounts[1].id);
  const balance = await query.execute(client);
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance, `Account balance is: ${balance.hbars.toBigNumber().toNumber()}`);  

  // Transfer token
  const receiverAccountId = AccountId.fromString(accounts[1].id);
  const tokenTransferTx = await transferToken(expectedTokenBalance, this.tokenId, accounts[0], receiverAccountId);
  receipt = await tokenTransferTx.getReceipt(client);
  assert.equal(receipt.status.toString(), "SUCCESS", "Token transfer failed");

  // Confirm token balance
  const tokenBalanceQuery = await new AccountBalanceQuery().setAccountId(accounts[1].id).execute(firstClient); // Transfer by default/zero client and query by first client
  assert.ok(tokenBalanceQuery.tokens, "Expected account to hold tokens but none found");
  const tokenbalance = tokenBalanceQuery.tokens.get(this.tokenId);
  assert.ok(tokenbalance, "Token balance not found or token does not exists");
  assert.equal(tokenbalance.toNumber(), expectedTokenBalance, "Token balance and expected balance does not match");

  this.firstClient = firstClient;
});
Given(/^A second Hedera account with (\d+) hbar and (\d+) HTT tokens$/, {timeout: 20000}, async function (expectedBalance: number, expectedTokenBalance: number) {
  const privateKey = PrivateKey.fromStringED25519(accounts[2].privateKey);
  const secondClient = Client.forTestnet().setOperator(accounts[2].id, privateKey);

  // Assosciate Account
  const assosciateTransaction = await assosciateAccount(accounts[2], this.tokenId);
  let receipt = await assosciateTransaction.getReceipt(secondClient);
  assert.equal(receipt.status.toString(), "SUCCESS", "Token assosciation failed");

  // Check hbar balance
  const query = new AccountBalanceQuery().setAccountId(accounts[2].id);
  const balance = await query.execute(client);
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance, `Account balance is: ${balance.hbars.toBigNumber().toNumber()}`);  

  // Transfer token
  const receiverAccountId = AccountId.fromString(accounts[2].id);
  const tokenTransferTx = await transferToken(expectedTokenBalance, this.tokenId, accounts[0], receiverAccountId);
  receipt = await tokenTransferTx.getReceipt(client);
  assert.equal(receipt.status.toString(), "SUCCESS", "Token transfer failed");

  // Confirm token balance
  const tokenBalanceQuery = await new AccountBalanceQuery().setAccountId(accounts[2].id).execute(secondClient); // Transfer by default/zero client and query by first client
  assert.ok(tokenBalanceQuery.tokens, "Expected account to hold tokens but none found");
  const tokenbalance = tokenBalanceQuery.tokens.get(this.tokenId);
  assert.ok(tokenbalance, "Token balance not found or token does not exists");
  assert.equal(tokenbalance.toNumber(), expectedTokenBalance, "Token balance and expected balance does not match");
  this.secondClient = secondClient;
});
Given(/^A third Hedera account with (\d+) hbar and (\d+) HTT tokens$/, {timeout: 20000}, async function (expectedBalance: number, expectedTokenBalance: number) {
  const privateKey = PrivateKey.fromStringED25519(accounts[3].privateKey);
  const thirdClient = Client.forTestnet().setOperator(accounts[3].id, privateKey);

  // Assosciate Account
  const assosciateTransaction = await assosciateAccount(accounts[3], this.tokenId);
  let receipt = await assosciateTransaction.getReceipt(thirdClient);
  assert.equal(receipt.status.toString(), "SUCCESS", "Token assosciation failed");

  // Check hbar balance
  const query = new AccountBalanceQuery().setAccountId(accounts[3].id);
  const balance = await query.execute(client);
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance, `Account balance is: ${balance.hbars.toBigNumber().toNumber()}`);  

  // Transfer token
  const receiverAccountId = AccountId.fromString(accounts[3].id);
  const tokenTransferTx = await transferToken(expectedTokenBalance, this.tokenId, accounts[0], receiverAccountId);
  receipt = await tokenTransferTx.getReceipt(client);
  assert.equal(receipt.status.toString(), "SUCCESS", "Token transfer failed");

  // Confirm token balance
  const tokenBalanceQuery = await new AccountBalanceQuery().setAccountId(accounts[2].id).execute(thirdClient); // Transfer by default/zero client and query by first client
  assert.ok(tokenBalanceQuery.tokens, "Expected account to hold tokens but none found");
  const tokenbalance = tokenBalanceQuery.tokens.get(this.tokenId);
  assert.ok(tokenbalance, "Token balance not found or token does not exists");
  assert.equal(tokenbalance.toNumber(), expectedTokenBalance, "Token balance and expected balance does not match");
  this.thirdClient = thirdClient;
});
Given(/^A fourth Hedera account with (\d+) hbar and (\d+) HTT tokens$/, {timeout: 20000}, async function (expectedBalance: number, expectedTokenBalance: number) {
  const privateKey = PrivateKey.fromStringED25519(accounts[4].privateKey);
  const fourthClient = Client.forTestnet().setOperator(accounts[4].id, privateKey);

  // Assosciate Account
  const assosciateTransaction = await assosciateAccount(accounts[4], this.tokenId);
  let receipt = await assosciateTransaction.getReceipt(fourthClient);
  assert.equal(receipt.status.toString(), "SUCCESS", "Token assosciation failed");

  // Check hbar balance
  const query = new AccountBalanceQuery().setAccountId(accounts[4].id);
  const balance = await query.execute(client);
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance, `Account balance is: ${balance.hbars.toBigNumber().toNumber()}`);  

  // Transfer token
  const receiverAccountId = AccountId.fromString(accounts[4].id);
  const tokenTransferTx = await transferToken(expectedTokenBalance, this.tokenId, accounts[0], receiverAccountId);
  receipt = await tokenTransferTx.getReceipt(client);
  assert.equal(receipt.status.toString(), "SUCCESS", "Token transfer failed");

  // Confirm token balance
  const tokenBalanceQuery = await new AccountBalanceQuery().setAccountId(accounts[4].id).execute(fourthClient); // Transfer by default/zero client and query by first client
  assert.ok(tokenBalanceQuery.tokens, "Expected account to hold tokens but none found");
  const tokenbalance = tokenBalanceQuery.tokens.get(this.tokenId);
  assert.ok(tokenbalance, "Token balance not found or token does not exists");
  assert.equal(tokenbalance.toNumber(), expectedTokenBalance, "Token balance and expected balance does not match");
  this.fourthClient = fourthClient;
});
When(/^A transaction is created to transfer (\d+) HTT tokens out of the first and second account and (\d+) HTT tokens into the third account and (\d+) HTT tokens into the fourth account$/, async function (amountToSend: number, amountReceivedByThird: number, amountReceivedByFourth: number) {
  const amounts = [-amountToSend, -amountToSend, amountReceivedByThird, amountReceivedByFourth];
  const senderAccounts = [accounts[1], accounts[2]];
  const receiverAccounts = [accounts[3], accounts[4]];
  const accountsArr = [...senderAccounts, ...receiverAccounts];

  const createMultiPartyTx = await createMultiPartyTransferTokenTx(amounts, this.tokenId, accountsArr, this.firstClient);
  assert.ok(createMultiPartyTx, "Multiparty token transfer transaction could not be created");
  this.createTokenTrasferTx = createMultiPartyTx;
});
Then(/^The third account holds (\d+) HTT tokens$/, async function (expectedTokenBalance: number) {
  const balance = await new AccountBalanceQuery().setAccountId(accounts[3].id).execute(this.thirdClient);
  assert.ok(balance.tokens, "Expected account to hold tokens but none found");
  const tokenbalance = balance.tokens.get(this.tokenId);
  assert.ok(tokenbalance, "Token balance not found or token does not exists");
  assert.equal(tokenbalance.toNumber(), expectedTokenBalance, "Token balance and expected balance does not match");
});
Then(/^The fourth account holds (\d+) HTT tokens$/, async function (expectedTokenBalance: number) {
  const balance = await new AccountBalanceQuery().setAccountId(accounts[4].id).execute(this.fourthClient);
  assert.ok(balance.tokens, "Expected account to hold tokens but none found");
  const tokenbalance = balance.tokens.get(this.tokenId);
  assert.ok(tokenbalance, "Token balance not found or token does not exists");
  assert.equal(tokenbalance.toNumber(), expectedTokenBalance, "Token balance and expected balance does not match");
});
