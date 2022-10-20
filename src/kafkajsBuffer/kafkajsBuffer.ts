import { CompressionTypes, Producer, TopicMessages, Message } from "kafkajs";
import { getElapsedTimeInMs } from "../utils";
import {
  AutoPollingAlreadyStartedError,
  BufferMaxSizeExceeded,
} from "./errors";

interface MessagesByTopic<T> {
  [topic: string]: IMessageWithInfo<T>[];
}

export interface IMessageWithInfo<T = void> extends Message {
  info?: T;
}

export interface ITopicMessagesWithInfo<T> extends TopicMessages {
  messages: IMessageWithInfo<T>[];
}

export interface IDeliveredMessage<T = void> {
  topic: string;
  key?: string | Buffer | null;
  info?: T;
}

export interface ISendMessagesQueueOptions<T = void> {
  queueBufferingMaxMessages?: number;
  qeueuBufferingMaxMs?: number;
  batchNumMessages?: number;
  onMessageDelivered?: (message: IDeliveredMessage<T>) => void;
  onBatchDelivered?: (messages: IDeliveredMessage<T>[]) => void;
  onSendError?: (error: Error) => void;
  messageAcks?: -1 | 0 | 1;
  responseTimeout?: number;
  messageCompression?: CompressionTypes;
  debug?: (message?: any, ...optionalParams: any[]) => void;
}

const defaultOptions = {
  queueBufferingMaxMessages: 100000,
  qeueuBufferingMaxMs: 1000,
  batchNumMessages: 1000,
  onMessageDelivered: () => {},
  onBatchDelivered: () => {},
  onSendError: () => {},
  messageAcks: -1 as -1 | 0 | 1,
  responseTimeout: 30000,
  messageCompression: CompressionTypes.None,
  debug: () => {},
};

// Next event loop iteration
const nextTick = () => new Promise((resolve) => setImmediate(resolve));

/**
 * KafkaJS producer util that buffers messages and sends them in batches.
 */
export class KafkajsBuffer<T = void> {
  private producer: Producer;
  private hrTime: [number, number];
  options: {
    queueBufferingMaxMessages: number;
    qeueuBufferingMaxMs: number;
    batchNumMessages: number;
    onMessageDelivered: (messageRecord: IDeliveredMessage<T>) => void;
    onBatchDelivered: (messagesDelivered: IDeliveredMessage<T>[]) => void;
    onSendError: (error: Error) => void;
    messageAcks: -1 | 0 | 1;
    responseTimeout: number;
    messageCompression: CompressionTypes;
    debug: (message?: any, ...optionalParams: any[]) => void;
  };

  private messagesByTopic: MessagesByTopic<T>;
  private messagesByTopicCount: number;
  private sending: boolean;
  private maxQueueLength: number;
  private interval: NodeJS.Timeout;

  constructor(producer: Producer, options: ISendMessagesQueueOptions<T> = {}) {
    this.producer = producer;
    this.options = { ...defaultOptions, ...options };
    this.messagesByTopic = {};
    this.hrTime = process.hrtime();
    this.sending = false;
    this.messagesByTopicCount = 0;
    this.maxQueueLength = 0;
  }

  /**
   * Tries to flush the queue of messages to Kafka based on the queue buffering max ms and the queue buffering max messages
   */
  poll() {
    const elapsed = getElapsedTimeInMs(this.hrTime);
    if (
      !this.sending &&
      (this.messagesByTopicCount >= this.options.queueBufferingMaxMessages ||
        elapsed >= this.options.qeueuBufferingMaxMs)
    ) {
      this.hrTime = process.hrtime();
      this.sending = true;

      // No needed to await, if it's already sending the poll is ignored.
      this.sendQueue()
        .catch((err) => {
          this.options.debug(err);
          this.options.onSendError(err);
        })
        .finally(() => (this.sending = false));
    }
  }

  startAutoPolling(ms: number) {
    if (this.interval) {
      throw new AutoPollingAlreadyStartedError();
    }

    this.interval = setInterval(() => {
      this.poll();
    }, ms);
  }

  stopAutoPolling() {
    clearInterval(this.interval);
  }

  /**
   * @param messages Messages to send
   */
  push(messages: ITopicMessagesWithInfo<T> | ITopicMessagesWithInfo<T>[]) {
    if (!Array.isArray(messages)) {
      messages = [messages];
    }

    messages.forEach((element) => {
      if (!this.messagesByTopic[element.topic]) {
        this.messagesByTopic[element.topic] = [];
      }

      this.messagesByTopicCount += element.messages.length;
      if (this.messagesByTopicCount > this.maxQueueLength) {
        this.maxQueueLength = this.messagesByTopicCount;
        this.options.debug("Max queue size until now: ", this.maxQueueLength);
      }
      if (this.messagesByTopicCount > this.options.queueBufferingMaxMessages) {
        throw new BufferMaxSizeExceeded();
      }

      this.messagesByTopic[element.topic].push(...element.messages);
    });
  }

  async flush() {
    while (this.sending) {
      this.options.debug("Waiting for a previous sending to finish");
      await nextTick();
    }

    try {
      this.sending = true;
      await this.sendQueue();
    } catch (err) {
      this.options.debug(err);
      throw err;
    } finally {
      this.sending = false;
    }
  }

  /**
   * Send the queue of messages to Kafka
   */
  private async sendQueue(): Promise<void> {
    let topic = Object.keys(this.messagesByTopic)[0];
    while (topic) {
      const messages = this.messagesByTopic[topic];
      if (messages && messages.length > 0) {
        const batch = messages.splice(
          0,
          Math.min(this.options.batchNumMessages, messages.length)
        );
        this.messagesByTopicCount -= batch.length;

        const producerRecord = {
          acks: this.options.messageAcks,
          timeout: this.options.responseTimeout,
          compression: this.options.messageCompression,
          messages: batch,
          topic,
        };

        this.options.debug("Sending batch of messages: ", batch.length);
        await this.producer.send(producerRecord);

        const deliveredMessages: IDeliveredMessage<T>[] = [];
        batch.forEach((message) => {
          const deliveredMessage = {
            topic,
            key: message.key,
            info: message.info,
          };
          deliveredMessages.push(deliveredMessage);
          this.options.onMessageDelivered(deliveredMessage);
        });
        this.options.onBatchDelivered(deliveredMessages);
      } else {
        delete this.messagesByTopic[topic];
        topic = Object.keys(this.messagesByTopic)[0];
      }
    }
  }
}
