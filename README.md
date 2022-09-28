# nft block scan service
Scan all nft from EVM-compatible blockchain node

Output: TODO: fill here

## Installation

```bash
$ yarn install
```

Prepare kafka auth file, put it here:
```
secrets/kafka.keystore.jks
```

Create and edit the `.env` file:
```
cp .env.example .env
```


## Develoment

```bash
# development
$ yarn start

# watch mode
$ yarn start:dev

# production mode
$ yarn start:prod
```

## Test

```bash
# unit tests
$ yarn test

# e2e tests
$ yarn test:e2e

# test coverage
$ yarn test:cov
```

## Operation
This is how you operate this service:

### O1. Deploy new scan instance (new process)
TODO

### O2. Do Scan
Open graphql interface and run the mutation:
```
scanBlockRange(
    from_block: Float!
    to_block: Float!
    chain: String!
    block_per_step: Float!
): Boolean
```

### O3. Scan with multiple threads
Let's say you wanna scan block 100-1000 and 3000-4000 parallel.

Approach to run scan in multiple threads.
- Run 2 mutation:
```
  - scanBlockRange(100, 1000, "ETH", 50)
  - scanBlockRange(3000, 4000, "ETH", 50)
  ```
This will start 2 threads in a same process
- Start 2 node process with different port on a single machine or multiple vps:
  - `pm2 start nft-blockscan-1` > Run the mutation against this process
  - `pm2 start nft-blockscan-2` > Run the mutation against this process

### 04. Scan block in the future
Open the graphql interface and run the mutation:
```
scanFromBlock(
  chain: String
  from_block: Float!
): Boolean
```
- This will scan from from_block to future
- If you don't fill in from_block field, this will scan from the (lastest block - 10) to the future

### 05. Rescan blocks failed
Open the graphql interface and run the query:
```
query {
  getBlocksFailed{
    blockRange,
    singleBlock
  }
}
```
- This will return a list of blocks failed and reason.
- Then you can use the `scanBlockRange` api to rescan these blocks.