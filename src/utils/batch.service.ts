/* eslint-disable no-unused-vars */
/*
Usage:
  const b = new BatchService<number>(...)
  await b.addItem(1)
 */
import { delay } from './time';

export class BatchService<T> {
  private logger: any = new DefaultLogger();
  public items: T[] = [];
  public batchLength = 10;
  public executeBatch: (items: T[]) => Promise<boolean> = async () => false;
  public onBatchError: (items: T[], e: Error) => Promise<boolean> = async () => false;

  /**
   * Store items key in hash map to check if new item is duplicate with O(1)
   */
  public itemKeys: Record<any, boolean> = {};
  public getItemUniqueKeyValue?: (item: T) => string;

  /**
   * Auto flush the batch after some milliseconds
   */
  private autoResolveTimeout = 30000;
  private autoResolveJobId = null;
  private retryCount = 0;
  private MAX_RETRY = 1;

  /**
   * @param batchLength batch item count is full then executeBatch will be run if batch size reach this amount
   * @param autoResolveTimeout Force run executeBatch if no item was added in this duration
   * @param executeBatch run sth when batch is full
   * @param onBatchError handle executeBatch errors
   * @param getItemUniqueKeyValue [optional] if you need to ignore duplicate item, just add this fn to help
   * @param logger [Optional]
   */
  public constructor(
    batchLength: number,
    autoResolveTimeout: number,
    executeBatch: (items: T[]) => Promise<boolean>,
    onBatchError: (items: T[], e: Error) => Promise<boolean>,
    getItemUniqueKeyValue?: (item: T) => string,
    logger?: any,
  ) {
    if (logger) {
      this.logger = logger;
    }

    this.reset(batchLength, autoResolveTimeout, executeBatch, onBatchError, getItemUniqueKeyValue).then(() => {
      this.logger.log('BatchService initialized');
    });
  }

  async reset(
    batchLength: number,
    autoResolveTimeout: number,
    executeBatch: (items: T[]) => Promise<boolean>,
    onBatchError: (items: T[], e: Error) => Promise<boolean>,
    getItemUniqueKeyValue?: (item: T) => any,
  ) {
    // Resolve some existing data
    await this.flush();

    // Then reset to initial state
    this.batchLength = batchLength;
    this.autoResolveTimeout = autoResolveTimeout;
    this.executeBatch = executeBatch;
    this.onBatchError = onBatchError;
    this.getItemUniqueKeyValue = getItemUniqueKeyValue;
  }

  async addItem(item: T): Promise<boolean> {
    if (!this.getItemUniqueKeyValue) {
      this.items.push(item);
    } else {
      // check duplicate
      const uniqueValue = this.getItemUniqueKeyValue(item);
      if (uniqueValue in this.itemKeys) {
        // just ignore it
        this.logger.verbose('{BatchService.addItem} ignore because of duplicate key: ', uniqueValue);
      } else {
        this.items.push(item);
        this.itemKeys[uniqueValue] = true;
      }
    }

    await this.handleFullState();
    this.addAutoResolveTask();

    return true;
  }

  async flush() {
    if (this.items.length > 0) {
      await this.safeExecute(this.items);
    }
    this.prepareNewBatch();
  }

  private async safeExecute(items: T[]) {
    try {
      await this.executeBatch(items);
    } catch (e) {
      if (this.retryCount < this.MAX_RETRY) {
        this.retryCount += 1;
        this.logger.warn('{BatchService.safeExecute} Retry ' + this.retryCount + ' times because of error: ', e);
        await this.safeExecute(items);
      } else {
        // save error to db
        await this.onBatchError(items, e);
      }
    }
  }

  isFull(): boolean {
    return this.items.length >= this.batchLength;
  }

  private prepareNewBatch() {
    this.items = [];
    this.itemKeys = {};
    this.retryCount = 0;
    clearTimeout(this.autoResolveJobId);
  }

  private async handleFullState() {
    if (this.isFull()) {
      await this.flush();
    }
  }

  private addAutoResolveTask() {
    clearTimeout(this.autoResolveJobId);
    this.autoResolveJobId = setTimeout(() => {
      this.flush();
    }, this.autoResolveTimeout);
  }

  static async test() {
    const b = new BatchService<number>(
      10,
      5000,
      async (items) => {
        console.log('Executing: ', items);

        if (Math.random() > 0.75) {
          throw new Error('Execute batch item with error FORCE_FAKE_ERROR');
        }

        await delay(1000);
        console.log('Executed');

        return true;
      },
      async (items, e) => {
        console.log('Error: ', e, items);
        console.log('Error items: ', items);
        return false;
      },
    );

    for (let i = 0; i < 45; i++) {
      await b.addItem(i);
    }
  }
}

class DefaultLogger {
  verbose(msg: string) {
    console.log(msg);
  }
  log(msg: string) {
    console.log(msg);
  }
  warn(msg: string) {
    console.warn(msg);
  }
  error(msg: string) {
    console.error(msg);
  }
}
