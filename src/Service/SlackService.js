const superagent = require('superagent');
const {WebClient, LogLevel} = require("@slack/web-api");
const fs = require('fs');

module.exports = {
    sendMessage: async function sendMessage(message, channel) {
        // https://api.slack.com/docs/rate-limits
        return new Promise(async (resolve) => {
            if (process.env.SLACK_ACTIVE === '1') {
                console.log('SlackService sendMessage sending message to channel ' + channel);
                superagent
                    .post('https://slack.com/api/chat.postMessage')
                    .send({
                        channel: channel,
                        text: message
                    })
                    .set('Content-Type', 'application/json')
                    .set('Authorization', 'Bearer ' + process.env.SLACK_BOT_TOKEN)
                    .then(res => {
                        if (res.statusCode !== 200) {
                            console.log('ERROR: sendNotification status code : ' + res.statusCode);
                            resolve(false);
                        } else {
                            console.log('SlackService sendMessage sended');
                            resolve(true);
                        }
                    })
                    .catch(err => {
                        console.log('ERROR: ', err);
                        resolve(false);
                    });
            } else {
                console.log('SlackService sendMessage not active');
                resolve(true);
            }
        });
    },

    // https://api.slack.com/methods/files.upload/code
    sendFile: async function sendFile(filePath, channel) {
        if (process.env.SLACK_ACTIVE !== '1') {
            console.log('SlackService sendFile not active');
            return;
        } else {
            console.log('SlackService sendFile to channel' + channel);
        }
        const client = new WebClient(process.env.SLACK_BOT_TOKEN, {
            // LogLevel can be imported and used to make debugging simpler
            logLevel: LogLevel.WARN
        });
        try {
            // Call the files.upload method using the WebClient
            const result = await client.files.upload({
                // channels can be a list of one to many strings
                channels: channel,
                // Include your filename in a ReadStream here
                file: fs.createReadStream(filePath)
            });
            console.log('SlackService sendFile ' + filePath + ' uploaded');
        } catch (error) {
            console.error(error);
        }
    },
};