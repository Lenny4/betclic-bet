const superagent = require('superagent');

module.exports = {
    sendMessage: async function sendMessage(message, channel) {
        // https://api.slack.com/docs/rate-limits
        return new Promise(async (resolve) => {
            if (process.env.SLACK_ACTIVE === '1') {
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
                            resolve(true);
                        }
                    })
                    .catch(err => {
                        console.log('ERROR: ', err);
                        resolve(false);
                    });
            } else {
                resolve(true);
            }
        });
    },
};