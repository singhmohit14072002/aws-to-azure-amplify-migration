import { defineBackend } from "@aws-amplify/backend";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as rds from "aws-cdk-lib/aws-rds";
import { CfnOutput, Duration, RemovalPolicy } from "aws-cdk-lib";
import { auth } from "./auth/resource";
import { storage } from "./storage/resource";
import * as path from "node:path";

const backend = defineBackend({ auth, storage });
const databaseStack = backend.createStack("noraDatabase");
const vpc = new ec2.Vpc(databaseStack, "NoraVpc", { maxAzs: 2, natGateways: 1 });
const database = new rds.DatabaseInstance(databaseStack, "NoraMysql", {
  engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0_39 }),
  vpc,
  databaseName: "nora",
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
  allocatedStorage: 20,
  maxAllocatedStorage: 100,
  publiclyAccessible: false,
  deletionProtection: false,
  removalPolicy: RemovalPolicy.SNAPSHOT,
  backupRetention: Duration.days(7),
});
const apiHandler = new nodejs.NodejsFunction(databaseStack, "NoraRdsApi", {
  entry: path.join(__dirname, "functions/rds-api/handler.ts"),
  runtime: lambda.Runtime.NODEJS_22_X,
  timeout: Duration.seconds(30),
  memorySize: 512,
  vpc,
  bundling: { externalModules: [] },
  environment: {
    DB_SECRET_ARN: database.secret?.secretArn ?? "",
    DB_HOST: database.dbInstanceEndpointAddress,
    DB_PORT: database.dbInstanceEndpointPort,
    DB_NAME: "nora",
  },
});
database.connections.allowDefaultPortFrom(apiHandler);
database.secret?.grantRead(apiHandler);
const api = new apigateway.LambdaRestApi(databaseStack, "NoraRdsApiGateway", {
  handler: apiHandler,
  proxy: true,
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
  },
  deployOptions: { stageName: "prod" },
});
new CfnOutput(databaseStack, "RdsApiUrl", { value: api.url });
void api;
