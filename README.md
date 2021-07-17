## IPaaS - Incend Platform as a Service
##### v1.0.1 - IPaaS supports authentication, communication and other common services specifically designed to be used by in-house teams for their products. The mission for IPaaS is to help the sub-products in Incend to work seemlessly without any issues, get new products rolled out to market faster and fix security vulnerabilities related to key components faster.

<hr><br>

### Auth APIs - For Clients

<br>

API Documentation - [Follow this link](http://documenter.getpostman.com/view/16309153/TzmCgY2P)

The Auth APIs collection contains all the APIs for the client's users and the client themselves. Includes user account creation via initialization of OTP send request, edit user profiles and more.

OTP can be sent via `sms` or `email` channel for now. Addition of `WhatsApp` as another channel will be available soon. The client must be authorised by IPaaS to use authentication and the services to send or verify OTPs. Contact the IPaaS support team to complete this process.

<br>

**Description of the terms used**
1. `Client` - The sub-division of Incend. An example for a client can be Pupl.
2. `User` / `End User` - The user of the products the client provides.

<br>

**Process for user authentication**

**Step 1** - Start user OTP verification\
**Step 2** - Verify user OTP to get JWT\
**Step 3** - Transfer JWT to user\
**Step 4** - Verify JWT for all client tasks

<br>

>**Note - Privacy Disclaimer**
>
>Incend has a strict policy of protecting user data. None of the personally identifiable information can be stored in the client database. While performing API communications between IPaaS and client backend services, IPaaS don't transfer any kind of this information as well.
>
>For the sake of managing the user data, the client **IS ONLY ALLOWED** to save the userId passed during authentication. The userId can be enough for the client to save data that will be anonymous and difficult to track down in case of breaches.
>
>**For showing the PII (Personally Identifiable Information) like name inside the client app or website, user can directly contact IPaaS's `Auth Master View API` with their Base64 version of `userJwtToken` provided via the client after authentication. Similarly, edits can also be made to such information only via direct call to our `Auth Master Edit API` from the user device. Both these APIs are not allowed from client backend.**

<br>

---