import { Given, Then, When } from "@cucumber/cucumber";
import {
  AccountBalanceQuery,
  AccountId,
  Client,
  KeyList,
  PrivateKey, PublicKey, RequestType,
  TopicCreateTransaction, TopicId, TopicInfoQuery,
  TopicMessage,
  TopicMessageQuery, TopicMessageSubmitTransaction
} from "@hashgraph/sdk";
import { accounts } from "../../src/config";
import assert from "node:assert";
import ConsensusSubmitMessage = RequestType.ConsensusSubmitMessage;

import {createTopic, submitMessage, subscribeToTopic} from "../../src/topic";

// Pre-configured client for test network (testnet)
const client = Client.forTestnet()

//Set the operator with the account ID and private key

Given(/^a first account with more than (\d+) hbars$/, async function (expectedBalance: number) {
  const acc = accounts[0];
  const account: AccountId = AccountId.fromString(acc.id);
  this.account = account;
  const privKey: PrivateKey = PrivateKey.fromStringED25519(acc.privateKey);
  this.privKey = privKey;
  client.setOperator(this.account, privKey);

  //Create the query request
  const query = new AccountBalanceQuery().setAccountId(account);
  const balance = await query.execute(client)
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance)
});

When(/^A topic is created with the memo "([^"]*)" with the first account as the submit key$/, async function (memo: string) {
  const topicTransaction = await createTopic(memo, client);
  const topic = await topicTransaction.getReceipt(client);
  this.topicId = topic.topicId;
  assert.ok(topic.topicId, "Invalid topic id received");
});

When(/^The message "([^"]*)" is published to the topic$/, async function (message: string) {
  assert.ok(this.topicId instanceof TopicId, "Invalid topic id");
  const topicTransaction = await submitMessage(this.topicId, message, client);
  const receipt = await topicTransaction.getReceipt(client);
  assert.equal(receipt.status.toString(), "SUCCESS", "Invalid receipt status received");
});

Then(/^The message "([^"]*)" is received by the topic and can be printed to the console$/, async function (message: string) {
  assert.ok(this.topicId instanceof TopicId, "Invalid topic id");

  const errorHandler = (topicMessage: TopicMessage | null, err: Error) => {
    assert.ok(topicMessage, "Empty message received");
    assert.equal(err, undefined, "Error received while subscribing to topic");
    assert.equal(topicMessage.contents.toString(), message, "Topic message doesnt match");
  }

  const listener = (topicMessage: TopicMessage) => {
    assert.equal(topicMessage.contents.toString(), message, "Topic message doesnt match");
  }

  const subscriptionHandle = await subscribeToTopic(this.topicId, client, errorHandler, listener);
  subscriptionHandle.unsubscribe();
});

Given(/^A second account with more than (\d+) hbars$/, async function (expectedBalance: number) {
  const acc = accounts[1];
  const account: AccountId = AccountId.fromString(acc.id);
  this.account = account;
  const privKey: PrivateKey = PrivateKey.fromStringED25519(acc.privateKey);
  this.privKey = privKey;
  client.setOperator(this.account, privKey);

  //Create the query request
  const query = new AccountBalanceQuery().setAccountId(account);
  const balance = await query.execute(client)
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance)
});

Given(/^A (\d+) of (\d+) threshold key with the first and second account$/, async function (thresholdVote: number, totalVotes: number) {
  // Create a new threshold key?? Assuming that from text in scenario: Wording of step needs to be more clear

  assert.ok(accounts.length >= totalVotes, "Total number of available accounts are less than total number of accounts/ votes required");
  
  const requiredAccounts = accounts.slice(0, totalVotes);
  const publicKeys = requiredAccounts.map(account => PrivateKey.fromStringED25519(account.privateKey).publicKey);

  //Create a threshold key: threshold vote of totalVote
  const thresholdKeys = new KeyList(publicKeys, thresholdVote);

  // Confirm size of key and equality
  assert.equal(thresholdKeys.toArray().length, 2, `Invalid threshold key size. Expected 2, found ${thresholdKeys.toArray().length}`);

  thresholdKeys.toArray().forEach((thresholdKey, index) => {
    assert.ok(thresholdKey instanceof PublicKey, "Threshold key not made of public key");
    assert.equal(thresholdKey.toStringRaw(), PrivateKey.fromStringED25519(accounts[index].privateKey).publicKey.toStringRaw(), "Public Keys do not match");
  });

  this.thresholdKeys = thresholdKeys; // Add it to this for next step
  
});

When(/^A topic is created with the memo "([^"]*)" with the threshold key as the submit key$/, async function (memo: string) {
  assert.ok(this.thresholdKeys instanceof KeyList, "Invalid thresholdKey");

  const topicTransaction = await createTopic(memo, client, this.thresholdKeys);
  const receipt = await topicTransaction.getReceipt(client);

  assert.ok(receipt.topicId, "Invalid topic Id received");
  this.topicId = receipt.topicId;
});
