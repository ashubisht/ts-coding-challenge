import { Client, Key, TopicCreateTransaction, TopicId, TopicMessage, TopicMessageQuery, TopicMessageSubmitTransaction } from "@hashgraph/sdk"

export async function createTopic(memo: string, client: Client, submitKey?: Key){

  const operator = client.getOperator();
  if(!operator){
    throw new Error("Client operator is null or undefined");
  }

  return new TopicCreateTransaction()
    .setTopicMemo(memo)
    .setSubmitKey(submitKey || operator.publicKey)
    .execute(client);
}

export async function submitMessage(topicId: TopicId, message: string, client: Client) {
  return new TopicMessageSubmitTransaction().
    setTopicId(topicId)
    .setMessage(message)
    .execute(client);
}

export async function subscribeToTopic(topicId: TopicId, client: Client, 
    errorHandler: ((message: TopicMessage | null, error: Error) => void) | null,
    listener: (message: TopicMessage) => void) {
  return new TopicMessageQuery()
    .setTopicId(topicId)
    .subscribe(client, errorHandler, listener);
}