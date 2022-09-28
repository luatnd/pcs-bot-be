#!/bin/bash


PROCESS_NAME_PREFIX=$1
NUMBER_OF_PROCESS=$2
FROM_PORT=$3
WILL_REBUILD=$4

echo "Please run 'git pull' if needed, this deploy script will not use git"

if [ -z "$PROCESS_NAME_PREFIX" ]
  then
    echo "Error: Invalid argument"
    echo "./deploy-multiple-process.sh <PROCESS_NAME_PREFIX> <NUMBER_OF_PROCESS> <FROM_PORT>"
    echo "Eg for prod: ./deploy-multiple-process.sh blockscan 30 13100 --build"
    echo "Eg for prod: ./deploy-multiple-process.sh blockscan 30 13100"
    exit 0
fi

if [ -z "$NUMBER_OF_PROCESS" ]
  then
    echo "Error: Invalid argument"
    echo "./deploy-multiple-process.sh <PROCESS_NAME_PREFIX> <NUMBER_OF_PROCESS> <FROM_PORT>"
    echo "Eg for prod: ./deploy-multiple-process.sh blockscan 30 13100 --build"
    echo "Eg for prod: ./deploy-multiple-process.sh blockscan 30 13100"
    exit 0
fi

if [ -z "$FROM_PORT" ]
  then
    echo "Error: Invalid argument"
    echo "./deploy-multiple-process.sh <PROCESS_NAME_PREFIX> <NUMBER_OF_PROCESS> <FROM_PORT>"
    echo "Eg for prod: ./deploy-multiple-process.sh blockscan 30 13100 --build"
    echo "Eg for prod: ./deploy-multiple-process.sh blockscan 30 13100"
    exit 0
fi


if [[ "$WILL_REBUILD" != "--build" ]]
  then
    echo "Skip rebuild because no --build param"
  else
    echo "Rebuild because of --build param"
    yarn generate
    yarn build
fi

for ((i = 0; i < $NUMBER_OF_PROCESS; i++))
do
  # shellcheck disable=SC2003
  PORT=$(expr "$i" + "$FROM_PORT")
  APP_PORT="$PORT" pm2 start dist/src/main.js --name "$PROCESS_NAME_PREFIX"_"$i"
done
