# Kafkjajs-buffer

Plugin for [Kafkajs](https://github.com/tulios/kafkajs) to buffer messages and send them in batches, inspired by [node-rdkafka](https://github.com/Blizzard/node-rdkafka).

# Overview

Kafkajs-buffer adds queue/buffer capabilities to a kafkajs producer. It enqueues messages until a specific size is reached or a given amount of time has passed. It also splits the buffer into smaller batches when it's too big to be sent in a single one. Delivered messages will be notified in a callback function.

# Why use it
When publishing messages to Kafka, it's crucial to control the size and frequency of the requests. This library solves two common issues:

- Buffering before sending: It's essential. Sending messages one by one or even in unmanaged batches leads to overload and poor performance in high-traffic services. One of the reasons is the time until Kafka acknowledgment is received (roundtrip). 

- Request size. By default, Kafka max request is 1Mb. Kafkajs-buffer allows setting the length of the batches to fit the Kafka configured size. It splits the buffer into batches with the configured number of messages and sends them to Kafka. 

Batching in blocks of the proper size and sending them to Kafka usually leads to complex logic in our code. To delay, group, and send messages based on a given size or time is not an easy task.  Kafkajs-buffer solves this problem in the background to keep the code clean and simple.

# Usage

The installation of Kafkajs-buffer is like any other module:

```
npm install kafkajs-buffer
```

To use the module, just require and create an instance of it.

```typescript
import { KafkajsBuffer } from "kafkajs-buffer";
```

```typescript
const producerBuffer = new KafkajsBuffer(producer, options);
```

To send the messages, push them into the buffer. Similar to how you would send them using Kafkajs. Basically, replacing Kafkajs "send(...)" with KafkajsBuffer "push(...)" calls.

```typescript
  producerBuffer.push({
    "topic-1",
    messages: [
      {
        key: "m1",
        value: "message 1",
      },
      {
        key: "m2",
        value: "message 2",
      },
    ],
  });
```

It's possible to push messages to different topics.

```typescript
producerBuffer.push([
  {
    topic: "topic-1",
    messages: [
      {
        key: "m1",
        value: "message 1",
      },
    ],
  },
  {
    topic: "topic-2",
    messages: [
      {
        key: "m2",
        value: "message 2",
      },
      {
        key: "m3",
        value: "message 3",
      },
    ],
  },
]);
```

You can programmatically request to send the buffer messages to Kafka. Depending on the time passed from the last sending, the messages in the buffer will be sent immediately or postponed until "poll()" it's called again.

```typescript
producerBuffer.poll();
```

In addition, or as an alternative, you can set the producer to poll automatically on an interval. Remember, Nodejs is single-threaded and runs new events only when an async IO operation is executed. Depending on your implementation and the duration of your synchronous code, the polling interval event could be blocked and triggered later than the time configured. In this case, you may want to call "poll()" explicitly.

```typescript
producerBuffer.startAutoPolling(100);
```

Don't forget to stop the autopolling before your program execution ends.

```typescript
producerBuffer.stopAutoPolling();
```

To receive the response when the messages are published to kafka, use the callback functions 'onBatchDelivered' and/or 'onMessageDelivered'. You can handle the responses by message or by batch.

```typescript
// This function is called every time a message is successfully sent to Kafka
const onMessageDelivered = (messageDelivered) => {
  messagesDeliveredCount += 1;
};
```

```typescript
// This function is called every time a batch is successfully sent to Kafka
const onBatchDelivered = (messagesDelivered: IDeliveredMessage[]) => {
  messagesDeliveredCount += messagesDelivered.length;
};
```

In addition, you can add extra information to the messages using the field 'info'. That information won't be sent to kafka but will be received in the callback function. It's very useful to set information you will need to identify the original request or message for which the produced message was created. A typical scenario is a service that consumes messages to produce new ones. Here, we can commit the consumed messages with the guarantee they have been processed.
Notice you can set the type for your extra info.

```typescript
type Info = {
  timestamp: number;
};

const messageToSend: IMessageWithInfo<Info> = {
  key: "1",
  value: "message value",
  info: {
    timestamp: Date.now(),
  },
};

const onMessageDelivered = (messageDelivered: IDeliveredMessage<Info>) => {
  console.log(
    `Message created at ${messageDelivered.info?.timestamp} was delivered to Kafka`
  );
};

const options = {
  onMessageDelivered,
  // Another options ...
}

const producerBuffer = new KafkajsBuffer<Info>(producer, options);
```

To gracefully shut down your process, you must first flush the buffer. It will send any remaining message in its internal queue. Remember to wait until the buffer is flushed.

```typescript
await producerBuffer.flush();
```

# Configuration

```typescript
const options = {
  batchNumMessages: 1000, // The buffer is sent to Kafka splitted in batches of this size.
  queueBufferingMaxMs: 1000, // Time the messages are buffered before sending. Polling actions will trigger the sending after this time.
  queueBufferingMaxMessages: 100000, // Max number of messages allowed in the buffer. When more messages are pushed it will throw an error.
  onMessageDelivered: () => {}, // Callback confirmation when a message is delivered to Kafka.
  onBatchDeliverd: () => {}, // Callback confirmation when a batch is delivered to Kafka.
  onSendError: (err) => {}, // Callback with error when the messages are tried to be sent after a poll and fail
  messageAcks: -1, // Control the number of required acks (https://kafka.js.org/docs/producing)
  responseTimeout: 30000, // The time to wait a response from Kafka, in ms (https://kafka.js.org/docs/producing)
  messageCompression: CompressionTypes.None, // Compression codec (https://kafka.js.org/docs/producing)
};
```
