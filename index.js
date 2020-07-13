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

puppeteer.launch({headless: process.env.HEADLESS === '1', args: ['--no-sandbox']}).then(async (browser) => {
    const betclicBet = new App(browser);
    console.log('ready');

    const job = new CronJob('0 1,6,11,16,21,26,31,36,41,46,51,56 * * * *', () => {
        superagent.get(process.env.BET_URL)
            .then(res => {
                console.log(res.body);
                betclicBet.addBets(res.body.matchs);
            })
            .catch(err => {
                console.log('err get matchs', err);
            });
    }, null, true, 'UTC');
    job.start();

    // should be never call
    app.post('/bets', async (req, res) => {
        const matchs = req.body.matchs;
        await betclicBet.addBets(matchs);
        res.send(true);
    });
});
