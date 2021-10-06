# Gasless Conviction Voting Client SDK

## Background

This SDK is for use with the [Gasless Conviction Service]. It abstracts away
the details of interacting with the service and Ceramic to create and update
user docs, and retrieve the global state document and the documents it
references.

[gasless conviction service]: https://github.com/topocount/gasless-conviction-voting

## Getting Started

Install the package in your webapp

```bash
npm i @topocount/gasless-conviction-sdk
```

Then import the class and use it to interact with ceramic and the service:

```js
// index.js
import {CvApi} from "@topocount/gasless-conviction-sdk";
{
  // some async scope
  const cvApi = await CvApi.from({
    ceramic,
    serviceURI: "https://myCVService.io",
  });
}
```

See [api.ts] for inline api documentation.

[api.ts]: ./src/api.ts

## Lifecycle Details

Currently, there is no way to delete proposals from the global state document
using the SDK. This is still an undeveloped lifecycle, since it requires some
compromise on decentralization. Ideas and feedback are welcome.

For now, frontend developers can implement policies that filter out proposals
based on some combination of:

- trigger state
- age
- proposer
