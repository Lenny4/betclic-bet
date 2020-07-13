require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.urlencoded({extended: true}));
app.use(express.json());
const server = require('http').createServer(app);
const puppeteer = require('puppeteer');
require('log-timestamp');

const App = require('./src/app');

server.listen(process.env.PORT, () => {
    console.log('Server listening at port %d', process.env.PORT);
});

console.log(process.env.HEADLESS === '1');
puppeteer.launch({headless: process.env.HEADLESS === '1', args: ['--no-sandbox']}).then(async (browser) => {
    const betclicBet = new App(browser);
    console.log('ready');
    app.post('/bets', async (req, res) => {
        const matchs = req.body.matchs;
        await betclicBet.addBets(matchs);
        res.send(true);
    });
});
