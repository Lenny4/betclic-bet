require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.urlencoded({extended: true}));
app.use(express.json());
const server = require('http').createServer(app);
const puppeteer = require('puppeteer');
const CronJob = require('cron').CronJob;
require('log-timestamp');
const superagent = require('superagent');

const App = require('./src/app');

server.listen(process.env.PORT, () => {
    console.log('Server listening at port %d', process.env.PORT);
});

// https://stackoverflow.com/questions/53681161/why-puppeteer-needs-no-sandbox-to-launch-chrome-in-cloud-functions
puppeteer.launch({
    headless: process.env.HEADLESS === '1',
    ignoreHTTPSErrors: true,
    userDataDir: './tmp',
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certifcate-errors',
        '--ignore-certifcate-errors-spki-list',
        '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3312.0 Safari/537.36"'
    ]
}).then(async (browser) => {
    const betclicBet = new App(browser);
    console.log('ready');
    if (false) {
        betclicBet.addBets(
            [{
                choiceName: '%1%',
                matchName: 'test matchName',
                matchId: '2556677',
                betCode: 'Ftb_Mr3',
                betName: 'Résultat du match',
                choiceOdd: 1.67,
                maxOdd: 2.054,
            }]
        );
    }

    const job = new CronJob('1 11,21,31,41,51 * * * *', () => {
        try {
            superagent.get(process.env.BET_URL + "?minutesRange=" + process.env.MINUTES_RANGE)
                .then(res => {
                    betclicBet.addBets(res.body.matchs);
                })
                .catch(err => {
                    console.log('err get matchs', err);
                });
        } catch (e) {
            console.log('==============================================================================');
            console.log('Error when get match to bet on ' + process.env.BET_URL);
            console.log(e);
            console.log('==============================================================================');
        }
    }, null, true, 'UTC');
    job.start();
});
