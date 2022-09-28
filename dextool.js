const poolListenReq = {"jsonrpc":"2.0","method":"subscribe","params":{"chain":"bsc","channel":"bsc:pools"},"id":2}

const poolPairCreationRes = {
  "jsonrpc": "2.0",
  "result": {
    "status": "ok",
    "data": {
      "pair": {
        "creation": {
          "blockNumber": "21382824",
          "timeStamp": "1663332350",
          "hash": "0xc402d7cc7eb33f7af565a863b48b9b0087e1593126b3197c134b4ebddcbe0e89",
          "nonce": "0",
          "blockHash": "0xf69a0df1150db4bddebd009087f85f51baa0fe590a864635c561cc0fa37e56b3",
          "transactionIndex": "149",
          "from": "0xadb239245864f8469b4f918c6832710e6d2b1512",
          "to": "",
          "value": "0",
          "gas": "809853",
          "gasPrice": "5000000000",
          "isError": "0",
          "txreceipt_status": "1",
          "input": "",
          "contractAddress": "0x234e1d120bffdcba913b89082979d4caa51de22f",
          "cumulativeGasUsed": "14127852",
          "gasUsed": "809853",
          "confirmations": "346003",
          "methodId": "0x60806040",
          "functionName": "atInversebrah(int248 a, uint48[] b, uint32 c, bytes20[] d, bytes30[] e)"
        },
        "info": {
          "locks": [],
          "address": "0x234e1d120bffdcba913b89082979d4caa51de22f",
          "holders": 71,
          "decimals": 18,
          "name": "Stake To Own",
          "symbol": "STCK",
          "totalSupply": "1000000000000000000000000000",
          "maxSupplyFormatted": 1000000000,
          "totalSupplyFormatted": 1000000000,
          "totalSupplyFormattedUpdatedAt": "2022-09-28T16:08:04.398Z"
        },
        "team": {
          "wallet": "0xadb239245864f8469b4f918c6832710e6d2b1512"
        },
        "_id": "63346b03e805927f8951d6b0",
        "id": "0x6bb517ded0652e8cda918cf3d2c0df019312ae51",
        "exchange": "pancakev2",
        "createdAt": "2022-09-28T15:40:51.055Z",
        "updatedAt": 1664389888,
        "__v": 1,
        "createdAtBlockNumber": 21728827,
        "createdAtTimestamp": 1664379646,
        "token0": {
          "_id": "63346b03e805927f8951d6c2",
          "id": "0x234e1d120bffdcba913b89082979d4caa51de22f",
          "name": "Stake To Own",
          "symbol": "STCK",
          "decimals": 18,
          "audit": {
            "_id": "633492ffe805927f8952c8c9",
            "codeVerified": true,
            "date": "2022-09-28T15:40:51.888Z",
            "lockTransactions": false,
            "mint": false,
            "proxy": false,
            "status": "OK",
            "unlimitedFees": false,
            "version": 1
          },
          "totalSupply": "1000000000000000000000000000"
        },
        "token1": {
          "_id": "61dd397d91051aa34b108b2e",
          "id": "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
          "decimals": 18,
          "name": "Wrapped BNB",
          "symbol": "WBNB",
          "audit": {
            "_id": "63346b03e805927f8951d6c4",
            "codeVerified": true,
            "date": "2022-08-18T11:35:46.823Z",
            "lockTransactions": false,
            "mint": false,
            "proxy": false,
            "status": "OK",
            "unlimitedFees": false,
            "version": 1
          }
        },
        "tokenIndex": 0,
        "type": "standard-pair",
        "initialReserve0": 117600000,
        "initialReserve1": 133.2411038541738,
        "initialLiquidity": 73755.93838769678,
        "initialLiquidityUpdatedAt": "2022-09-28T15:40:46.000Z",
        "liquidity": 31060.719075125737,
        "reserve0": 283170871.3183756,
        "reserve1": 55.823190855939714,
        "reserveUpdatedAt": "2022-09-28T18:31:23.000Z",
        "txCount": 904
      },
      "event": "update"
    }
  },
  "id": 2
}
