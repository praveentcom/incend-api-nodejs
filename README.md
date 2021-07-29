## IPaaS - Incend Platform as a Service

[![EC2 Deploy](https://github.com/incend-digital/IPaaS-API/actions/workflows/awsDeploy.yml/badge.svg)](https://github.com/incend-digital/IPaaS-API/actions/workflows/awsDeploy.yml) [![Better Uptime Badge](https://betteruptime.com/status-badges/v1/monitor/865g.svg)](https://betteruptime.com/?utm_source=status_badge)

IPaaS supports authentication, communication and other common services specifically designed to be used by in-house teams for their products. The mission for IPaaS is to help the sub-products in Incend to work seemlessly without any issues, get new products rolled out to market faster and fix security vulnerabilities related to key components faster.

<hr>

### Auth APIs - For Clients

API Documentation - [Follow this link](http://documenter.getpostman.com/view/16309153/TzmCgY2P)

The Auth APIs collection contains all the APIs for the client to perform authentication services from the backend. Includes user account creation via initialization of OTP send request, OTP verify request and token status request.

OTP can be sent via `sms` or `email` channel for now. Addition of `WhatsApp` as another channel will be available soon. The client must be authorised by IPaaS to use authentication and the services to send or verify OTPs. Contact the IPaaS support team to complete this process.

**Description of the terms used**

1. `Client` - The sub-division of Incend. An example for a client can be Pupl.
1. `User` - The user of the products the client provides.

**Process for user authentication**

1. Start user OTP verification
1. Verify user OTP to get JWT
1. Transfer JWT to user
1. Verify JWT for all client tasks

**Note - Privacy Disclaimer**

Incend has a strict policy of protecting user data. None of the personally identifiable information can be stored in the client database. While performing API communications between IPaaS and client backend services, IPaaS don't transfer any kind of this information as well.

For the sake of managing the user data, the client **IS ONLY ALLOWED** to save the userId passed during authentication. The userId can be enough for the client to save data that will be anonymous and difficult to track down in case of breaches.

**For showing the PII (Personally Identifiable Information) like name inside the client app or website, user can directly contact IPaaS's `User Profile API` with their Base64 version of `userJwtToken` provided via the client after authentication. Similarly, edits can also be made to such information only via direct call to our `User Profile Edit API` from the user device. Both these APIs are not allowed from client backend.**

<hr>

### User APIs - For Client's Users

API Documentation - [Follow this link](https://documenter.getpostman.com/view/16309153/TzmChD4g)

The User APIs collection contains all the APIs for the client's users and can be accessed directly from the client's frontend. Includes user details view and edit APIs.

The client user can be authenticated by sending a Bearer token with each request. The token will be the Base64 version of JWT shared during authentication.

<hr>

This library can be used directly in the nodejs applications with the help of `ipaas-nodejs` package available in the NPM registry.

To install, run - ```npm install ipaas-nodejs```.

Once installed, the library can be used as follows,

```
const ipaas = require('ipaas-nodejs');

async () => {
    var sendOtpResponse = await ipaas(apiKey).auth().sendOtp('mobile', '+918838118348');
    var verifyOtpResponse = await ipaas(apiKey).auth().verifyOtp('mobile', '+918838118348', '0123');
}
```
