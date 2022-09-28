#!/bin/bash


APP_NAME=$1
APP_PORT=$2
WILL_REBUILD=$3

echo "Please run 'git pull' if needed, this deploy script will not use git"

if [ -z "$APP_NAME" ]
  then
    echo "Error: Invalid argument"
    echo "./deploy_pm2_new_deploy.sh <APP_NAME> <APP_PORT>"
    echo "Eg for prod: ./deploy_pm2_new_deploy.sh img_optimize_0 13300 --build"
    echo "Eg for prod: ./deploy_pm2_new_deploy.sh img_optimize_0 13300"
    exit 0
fi

if [ -z "$APP_PORT" ]
  then
    echo "Error: Invalid argument"
    echo "./deploy_pm2_new_deploy.sh <APP_NAME> <APP_PORT>"
    echo "Eg for prod: ./deploy_pm2_new_deploy.sh img_optimize_0 13300 --build"
    echo "Eg for prod: ./deploy_pm2_new_deploy.sh img_optimize_0 13300"
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

APP_PORT="$APP_PORT" pm2 start dist/src/main.js --name $APP_NAME

echo "🚀 All done !!"
