import { KafkajsBuffer, IDeliveredMessage } from "../src";
import {
  Kafka,
  CompressionTypes,
  RecordMetadata,
  ProducerRecord,
  Message,
} from "kafkajs";

const MESSAGE_TO_SEND = {
  key: "key",
  value: "value",
};

const kafka = new Kafka({
  brokers: [],
});

process.env.KAFKAJS_NO_PARTITIONER_WARNING = "1";

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("KafkajsBuffer", () => {
  beforeAll(() => {});

  it("Options are correctly assigned", async () => {
    const producer = kafka.producer();
    const kafkajsBuffer = new KafkajsBuffer(producer, {
      queueBufferingMaxMessages: 999,
      qeueuBufferingMaxMs: 99,
      batchNumMessages: 10,
      messageAcks: 0 as -1 | 0 | 1,
      responseTimeout: 300,
      messageCompression: CompressionTypes.GZIP,
    });
    expect(kafkajsBuffer.options.queueBufferingMaxMessages).toBe(999);
    expect(kafkajsBuffer.options.qeueuBufferingMaxMs).toBe(99);
    expect(kafkajsBuffer.options.batchNumMessages).toBe(10);
    expect(kafkajsBuffer.options.messageAcks).toBe(0);
    expect(kafkajsBuffer.options.responseTimeout).toBe(300);
    expect(kafkajsBuffer.options.messageCompression).toBe(
      CompressionTypes.GZIP
    );
  });

  it("Poll sends the messages immediately when 'qeueuBufferingMaxMs' is 0", async () => {
    let receivedMessage: Message | undefined = undefined;

    const producer = kafka.producer();

    producer.send = async (record: ProducerRecord) => {
      receivedMessage = record.messages[0];
      return [{} as RecordMetadata];
    };

    const kafkajsBuffer = new KafkajsBuffer(producer, {
      qeueuBufferingMaxMs: 0,
    });

    kafkajsBuffer.push({
      topic: "test",
      messages: [MESSAGE_TO_SEND],
    });

    kafkajsBuffer.poll();
    expect(receivedMessage).toStrictEqual(MESSAGE_TO_SEND);
  });

  it("Poll sends the messages immediately when flush is called", async () => {
    let receivedMessage: Message | undefined = undefined;

    const producer = kafka.producer();

    producer.send = async (record: ProducerRecord) => {
      receivedMessage = record.messages[0];
      return [{} as RecordMetadata];
    };

    const kafkajsBuffer = new KafkajsBuffer(producer, {
      qeueuBufferingMaxMs: 0,
    });

    kafkajsBuffer.push({
      topic: "test",
      messages: [MESSAGE_TO_SEND],
    });

    await kafkajsBuffer.flush();
    expect(receivedMessage).toStrictEqual(MESSAGE_TO_SEND);
  });

  it("Autopolling sends the message", async () => {
    let receivedMessage: Message | undefined = undefined;

    const producer = kafka.producer();

    producer.send = async (record: ProducerRecord) => {
      receivedMessage = record.messages[0];
      return [{} as RecordMetadata];
    };

    const kafkajsBuffer = new KafkajsBuffer(producer, {
      qeueuBufferingMaxMs: 0,
    });

    kafkajsBuffer.push({
      topic: "test",
      messages: [MESSAGE_TO_SEND],
    });

    kafkajsBuffer.startAutoPolling(10);

    await sleep(10);

    kafkajsBuffer.stopAutoPolling();

    expect(receivedMessage).toStrictEqual(MESSAGE_TO_SEND);
  });

  it("Checks message delivery callback", async () => {
    let deliveredMessage: IDeliveredMessage | undefined = undefined;

    const producer = kafka.producer();

    producer.send = async (_: ProducerRecord) => [{} as RecordMetadata];

    const kafkajsBuffer = new KafkajsBuffer(producer, {
      onMessageDelivered: (message: IDeliveredMessage) => {
        deliveredMessage = message;
      },
    });

    kafkajsBuffer.push({
      topic: "test",
      messages: [MESSAGE_TO_SEND],
    });

    await kafkajsBuffer.flush();

    expect(deliveredMessage).toEqual({
      topic: "test",
      key: MESSAGE_TO_SEND.key,
      info: undefined,
    });
  });

  it("Checks batch delivery callback", async () => {
    let deliveredMessagesCount = 0;

    const producer = kafka.producer();

    producer.send = async (_: ProducerRecord) => [{} as RecordMetadata];

    const kafkajsBuffer = new KafkajsBuffer(producer, {
      onBatchDelivered: (messages: IDeliveredMessage[]) => {
        deliveredMessagesCount = messages.length;
      },
      qeueuBufferingMaxMs: 0,
    });

    kafkajsBuffer.push({
      topic: "test",
      messages: [MESSAGE_TO_SEND, MESSAGE_TO_SEND],
    });

    kafkajsBuffer.poll();
    await sleep(0);

    expect(deliveredMessagesCount).toEqual(2);
  });

  it("Messages are sent in batches according to the configuration", async () => {
    let batchesCount: number = 0;

    const producer = kafka.producer();

    producer.send = async (_: ProducerRecord) => {
      batchesCount++;
      return [{} as RecordMetadata];
    };

    const kafkajsBuffer = new KafkajsBuffer(producer, {
      batchNumMessages: 2,
    });

    kafkajsBuffer.push({
      topic: "test",
      messages: [...Array(6)].map(() => MESSAGE_TO_SEND),
    });

    await kafkajsBuffer.flush();

    expect(batchesCount).toEqual(3);
  });

  it("Flush waits for pending sending ends", async () => {
    const MESSAGE_EXTRA = {
      key: "extra",
      value: "extra",
    };

    let sendingCount: number = 0;
    let messagesSent: Message[] = [];
    const producer = kafka.producer();

    producer.send = async (producer: ProducerRecord) => {
      sendingCount += 1;
      if (sendingCount > 1) {
        throw new Error("Send called in parallel");
      }
      if (producer.messages.length != 1) {
        throw new Error("Size of each sent must be 1");
      }
      await sleep(10);

      messagesSent.push(producer.messages[0]);
      sendingCount -= 1;
      return [{} as RecordMetadata];
    };

    const kafkajsBuffer = new KafkajsBuffer(producer, {
      qeueuBufferingMaxMs: 0,
    });

    kafkajsBuffer.push({
      topic: "test",
      messages: [MESSAGE_TO_SEND],
    });

    kafkajsBuffer.poll();

    kafkajsBuffer.push({
      topic: "test",
      messages: [MESSAGE_EXTRA],
    });

    await kafkajsBuffer.flush();

    expect(messagesSent).toEqual([MESSAGE_TO_SEND, MESSAGE_EXTRA]);
  });
});
