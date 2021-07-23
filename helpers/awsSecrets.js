const SecretsManager = require("aws-sdk/clients/secretsmanager");
const region = 'ap-south-1';

const client = new SecretsManager({
    region,
});

async function getSecret(secretName) {
    const response = await client.getSecretValue({ SecretId: secretName }).promise();
    if ("SecretString" in response) {
        return response.SecretString;
    }
    console.log('Secrets file is loaded');
    return Buffer.from(response.SecretBinary, "base64").toString("ascii");
}

module.exports = { getSecret };