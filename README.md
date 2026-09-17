# NORA React Native storefront

NORA is now an Expo React Native app. The native entry point is [app.js](app.js), with the product catalog, filters, search, cart modal, checkout placeholder, and newsletter form implemented using React Native components and state.

## Run locally

Install dependencies, then start Expo:

```bash
npm install
npm start
```

Use the Expo CLI to open the app on a simulator, physical device, or web. The scripts `npm run android`, `npm run ios`, and `npm run web` are also available.

The cart is intentionally client-side for this starter. For production payments, connect the checkout action to a secure backend such as AWS Lambda/API Gateway with Stripe, and move product data into a managed data source such as Amplify Data.

## Amplify backend

The `amplify/` folder defines:

- An authenticated S3 bucket (`appStorage`) for `user-images/*` uploads.
- A private MySQL 8 RDS instance in a VPC.
- A Lambda/API Gateway endpoint that writes newsletter subscribers to the RDS table.

After installing dependencies, deploy a sandbox backend with:

```bash
npx ampx sandbox
```

Copy the generated `amplify_outputs.json` into the project root for Amplify Storage configuration. Set `EXPO_PUBLIC_RDS_API_URL` to the `RdsApiUrl` output before starting Expo. The app must use an authenticated Amplify user before calling `uploadUserImage`; guest write access is intentionally disabled for the bucket.

## Deploy through Amplify Hosting

Connect this repository to Amplify Hosting and deploy the branch containing [amplify.yml](amplify.yml). The build first runs `npx ampx pipeline-deploy`, which provisions or updates the S3 bucket, Cognito auth, VPC, private MySQL RDS instance, Lambda, and API Gateway. It then runs `npx expo export --platform web`, and Amplify Hosting serves the resulting `dist` folder.

This does not create an Android or iOS binary; use Expo/EAS for mobile builds. RDS is a billable AWS resource, and the current database uses a snapshot removal policy, so configure an AWS budget before deploying.

Cart and order requests currently use a per-install guest identifier. Add a Cognito sign-in flow and replace that identifier with the authenticated user subject before using this as a production checkout system.
