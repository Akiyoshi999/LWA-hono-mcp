import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Architecture } from "aws-cdk-lib/aws-lambda";
import { LayerVersion } from "aws-cdk-lib/aws-lambda";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class MastraMcpServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const layerArn = `arn:aws:lambda:${this.region}:753240598075:layer:LambdaAdapterLayerArm64:1`;

    const webAdapterLayer = LayerVersion.fromLayerVersionArn(
      this,
      "WebAdapterLayer",
      layerArn
    );

    const honoFn = new NodejsFunction(this, "MastraMcpServer", {
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      entry: path.join(__dirname, "../lambda/index.ts"),
      layers: [webAdapterLayer],
      handler: "run.sh",
      bundling: {
        minify: true,
        commandHooks: {
          beforeInstall: () => [],
          beforeBundling: () => [],
          afterBundling: (inputDir, outputDir) => {
            return [`cp -r ${inputDir}/lambda/run.sh ${outputDir}`];
          },
        },
      },
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/bootstrap",
        AWS_LWA_INVOKE_MODE: "streaming",
        PORT: "8080",
      },
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
    });

    const honoFn2 = new NodejsFunction(this, "MastraMcpServer2", {
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      entry: path.join(__dirname, "../lambda/mcp/index.ts"),
      layers: [webAdapterLayer],
      handler: "run.sh",
      bundling: {
        minify: true,
        commandHooks: {
          beforeInstall: () => [],
          beforeBundling: () => [],
          afterBundling: (inputDir, outputDir) => {
            return [`cp -r ${inputDir}/lambda/mcp/run.sh ${outputDir}`];
          },
        },
      },
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/bootstrap",
        AWS_LWA_INVOKE_MODE: "streaming",
        PORT: "8080",
      },
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      logRetention: cdk.aws_logs.RetentionDays.ONE_DAY,
    });

    const honoFnUrl = honoFn.addFunctionUrl({
      authType: cdk.aws_lambda.FunctionUrlAuthType.NONE,
    });

    const honoFnUrl2 = honoFn2.addFunctionUrl({
      authType: cdk.aws_lambda.FunctionUrlAuthType.NONE,
    });
  }
}
