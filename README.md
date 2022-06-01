# kafkjajs-buffer
Pluging for [kafkajs](https://github.com/tulios/kafkajs) to buffer messages and send them in batches, inspired by [node-rdkafka](https://github.com/Blizzard/node-rdkafka)

# Overview
kafkajs-buffer adds queue/buffer capabilities to a kafkajs producer to buffer the messages before sending. It splits the buffer in batches and sends the messages to Kafka, optmizing the number of requests and hidding all this complexity. Delivered messages will be notified in a callback function avoiding the need of awaiting and improving streaming times.

# Usage
You can install the kafkajs-buffer module like any other module:

```
npm install kafkajs-buffer
```

To use the module, you must require and instance it.

```typescript
import { KafkajsBuffer} from "kafkajs-buffer";
```

```typescript
const producerBuffer = new KafkajsBuffer(producer, options);
```

To send the messages push them in the buffer, similar the way you would send it using Kafkajs.
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

You can also push messages for different topics.
```typescript
  producerBuffer.push([
    {
      topic: "topic-1",
      messages: [
        {
          key: "m1",
          value: "message 1",
        }
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

To avoid reach the max buffer size and send the messages you can programatically request to send the buffer. Depending on the time from the last sending, the messages in the buffer queue will be sent immediatelly or postponed.

```typescript
producerBuffer.poll();
```

In addition you can set the producer to poll on an interval.
```typescript
producerBuffer.startAutoPolling(100);
```

Don't forget stop the autopolling before your program execution ends.
```typescript
producerBuffer.stopAutoPolling();
```

To receive the confirmation when the messages are published to kafka use the callback functions 'onBatchDelivered' and 'onMessageDelivered'.
```typescript
// This function is called everytime a message is successfully sent to Kafka
const onMessageDelivered = (messageDelivered) => {
  messagesDeliveredCount += 1;
}
```

```typescript
// This function is called everytime a batch is successfully sent to Kafka
const onBatchDelivered = (messagesDelivered: IDeliveredMessage[]) => {
  messagesDeliveredCount += messagesDelivered.length;
}
```

In addition you can add extra information to the messages that won't be sent to kafka but will be received in the callback function.
```typescript
type Info = {
  timestamp: number;
};

const producerBuffer = new KafkajsBuffer<Info>(producer, options);

const messageToSend: IMessageWithInfo<Info> = {
  key: "1",
  value: "message value",
  info: {
    timestamp: Date.now(),
  }
};

const onMessageDelivered = (messageDelivered: IDeliveredMessage<Info>) => {
  console.log(`Message created at ${messageDelivered.info?.timestamp} was delivered to kafka`);
}
```


To greacefully shutdonwn your process you must call and await 'flush'. It will wait until a possible onprogress sending ends and/or will send any pending message still in the buffer.

```typescript
await producerBuffer.flush();
```

