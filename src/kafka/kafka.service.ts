import * as fs from 'fs';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import {
  Consumer,
  ConsumerRunConfig,
  ConsumerSubscribeTopics,
  EachBatchHandler,
  Kafka,
  KafkaConfig,
  KafkaMessage,
  Producer,
  ProducerRecord,
  RecordMetadata,
} from 'kafkajs';
import * as jks from 'jks-js';

@Injectable()
export class KafkaService implements OnApplicationShutdown {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;

  private isProducerReady = false;
  private isConsumerReady = false;

  constructor() {
    // TODO: Make singleton because each resolve constructor will define new kafka service if it was used
    this.initKafka(true, true);
  }

  /**
   * @param lazyConsumer if not lazy, will connect consumer right now
   * @param lazyProducer if not lazy, will connect producer right now
   * @private
   */
  private initKafka(lazyConsumer = true, lazyProducer = true) {
    const keystoreFile = process.env.KAFKA_SSL_KEYSTORE_FILE;
    const isSSL = !!keystoreFile;

    // Create the client with the broker list
    const config: KafkaConfig = {
      clientId: process.env.KAFKA_CLIENT_ID,
      brokers: [process.env.KAFKA_BROKER],

      // authenticationTimeout: 10000,
      // reauthenticationThreshold: 10000,

      // ssl: {
      //   rejectUnauthorized: true,
      //   ca: [ca],
      //   key: key,
      //   cert: cert,
      //   passphrase: keystorePw,
      // },

      // sasl: {
      //   // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //   // @ts-ignore
      //   mechanism: process.env.KAFKA_AUTH_MECHANISM, // scram-sha-256 or scram-sha-512
      //   username: process.env.KAFKA_AUTH_USER,
      //   password: process.env.KAFKA_AUTH_PASS,
      // },

      retry: {
        maxRetryTime: 120000, // 2 min
        retries: 5,
        // restartOnFailure: this.restartOnFailure,
      },
    };

    const saslEnabled = process.env.KAFKA_AUTH_SASL == '1';
    if (saslEnabled) {
      config.sasl = {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        mechanism: process.env.KAFKA_AUTH_MECHANISM, // scram-sha-256 or scram-sha-512
        username: process.env.KAFKA_AUTH_USER,
        password: process.env.KAFKA_AUTH_PASS,
      };
    }

    if (isSSL) {
      const keystorePw = process.env.KAFKA_SSL_KEYSTORE_PASS;
      const keystore = jks.toPem(fs.readFileSync(keystoreFile), keystorePw);
      // console.log('keystore: ', keystore);

      const host = 'localhost';
      const { cert, key } = keystore[host];
      const ca = keystore.caroot.ca; // for cloudcluster.io
      // const ca = keystore.CARoot.ca; // for bitnami kafka docker image
      // console.log('cert, key: ', cert, key);

      config.ssl = {
        rejectUnauthorized: true,
        ca: [ca],
        key: key,
        cert: cert,
        passphrase: keystorePw,
      };
    }

    this.kafka = new Kafka(config);

    this.consumer = this.kafka.consumer({
      groupId: process.env.KAFKA_CLIENT_ID,
      sessionTimeout: 90000,
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 20000,
    });

    if (!lazyConsumer) {
      this.ensureConsumerReady();
    }
    if (!lazyProducer) {
      this.ensureProducerReady();
    }
  }

  private async ensureProducerReady() {
    if (!this.isProducerReady) {
      await this.producer.connect();
      this.isProducerReady = true;
      console.log('{KafkaService.ensureProducerReady} connected');
    }
  }

  private async ensureConsumerReady() {
    if (!this.isConsumerReady) {
      await this.consumer.connect();
      this.isConsumerReady = true;
      console.log('{KafkaService.ensureConsumerReady} connected');
    }
  }

  private async safeDisconnectProducer() {
    if (this.isProducerReady) {
      await this.producer.disconnect();
    }
  }

  private async safeDisconnectConsumer() {
    if (this.isConsumerReady) {
      await this.consumer.disconnect();
    }
  }

  async onApplicationShutdown() {
    await this.safeDisconnectProducer();
    await this.safeDisconnectConsumer();
  }

  /**
   * producer n message to kafka
   *
   * @param record: ProducerRecord = {
   *    topic: topic_name,
   *    messages: [
   *        { value: 'hello world ' + new Date() },
   *        { value: 'hello world ' + new Date() },
   *        { value: 'hello world ' + new Date() },
   *    ]
   * }
   */
  public async sendToQueue(record: ProducerRecord): Promise<RecordMetadata[]> {
    if (!this.isProducerReady) {
      await this.ensureProducerReady();
    }

    return this.producer.send(record);
  }

  /**
   * NOTE: Please ensure that you only subscribe to a topic once
   *
   * @param topic
   * @param onMessage
   * @param config
   */
  public async listenFromQueue(
    topic: ConsumerSubscribeTopics,
    // eslint-disable-next-line no-unused-vars
    onMessage: (msg: KafkaMessage) => void,
    config?: ConsumerRunConfig,
  ) {
    await this.ensureConsumerReady();
    await this.consumer.subscribe(topic);

    const eachBatch: EachBatchHandler = async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
      for (const message of batch.messages) {
        if (!isRunning() || isStale()) break;

        /*
        console.log('consumed: ', {
          topic: batch.topic,
          partition: batch.partition,
          highWatermark: batch.highWatermark,
          message: {
            offset: message.offset,
            //key: message.key.toString(),
            value: message.value.toString(),
            headers: message.headers,
            timestamp: message.timestamp,
          },
        });
        */
        await onMessage(message);
        resolveOffset(message.offset);
        await heartbeat();
      }
    };

    const defaultConfig: ConsumerRunConfig = {
      eachBatchAutoResolve: true,
      eachBatch,
    };

    // TODO: notice to telegram if consumer stopped and cannot restart
    await this.consumer.run({
      ...defaultConfig,
      ...config,
      eachBatch, // prohibit anyone to override eachBatch
    });
  }

  async seek(topic: string, offset: string, partition = 0) {
    await this.ensureConsumerReady();
    this.consumer.seek({ topic, partition, offset });
  }

  // https://kafka.js.org/docs/configuration#restartonfailure
  // async restartOnFailure(error: Error): Promise<boolean> {
  //   return false;
  // }
}
