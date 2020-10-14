const clone = require('clone');

class App {
    constructor(browser) {
        this.bets = [];
        this.doublons = [];
        this.isBetting = false;
        this.browser = browser;
        this.loginButton = 'header.header a[href^="/connexion"]';
        this.loginForm = 'login-form';
    }

    async addBets(matchs) {
        const now = Math.round(new Date().getTime() / 1000);
        for (let match of matchs) {
            const doublon = this.doublons.find(x => x.matchId === match.matchId);
            const bet = {
                betCode: match.betCode,
                matchName: match.matchName,
                guadeloupeDate: match.guadeloupeDate,
                choiceName: match.choiceName,
                choiceOdd: match.choiceOdd,
                matchId: match.matchId,
                maxOdd: match.maxOdd,
                time: now,
                try: 0,
            };
            if (typeof doublon === 'undefined') {
                console.log('ajout du bet ', bet);
                this.bets.push(bet);
                this.doublons.push(bet);
            } else {
                console.log('doublon du bet ', bet);
            }
        }
        this.doublons = this.doublons.filter(x => x.time >= (now - 3600));
        if (!this.isBetting) {
            this.bet();
        }
    }

    async bet() {
        this.isBetting = true;
        if (this.bets.length === 0) {
            this.isBetting = false;
            return;
        }
        const now = Math.round(new Date().getTime() / 1000);
        const bet = this.bets[0];
        console.log('is betting on ', bet);
        let page = await this.browser.newPage();
        console.log('start try, page created for bet');
        const url = 'https://www.betclic.fr/' + '-m' + bet.matchId;
        console.log('page going to ' + url);
        await page.goto(url);
        await page.addScriptTag({path: 'lib/jquery-3.4.1.min.js'});
        console.log('page before login');
        page = await this.login(page);
        console.log('start canBet');
        let r = true;
        if (page.url().includes(bet.matchId)) {
            await this.clearPanier(page);
            let buttonSelector = null;
            // Résultat du match Foot -> %1% ou nul ou %2%
            if(bet.betCode === 'Ftb_Mr3') {
                buttonSelector = 'app-match > div > app-match-markets > app-market:nth-child(1) > div > div.ng-star-inserted > div > div > ';
                if (bet.choiceName.toLowerCase() === '%1%') {
                    buttonSelector += 'div:nth-child(1) > app-selection';
                } else if (bet.choiceName.toLowerCase() === '%2%') {
                    buttonSelector += 'div:nth-child(3) > app-selection';
                } else if (bet.choiceName.toLowerCase() === 'nul') {
                    buttonSelector += 'div:nth-child(2) > app-selection';
                } else {
                    r = false;
                    console.log('Error : no bet.choiceName defined for ' + bet.choiceName + ' and ' + bet.betCode);
                }
            }
            // Vainqueur du match Tennis -> %1% ou %2%
            if(bet.betCode === 'Ten_Mr2') {
                buttonSelector = 'app-match > div > app-match-markets > app-market:nth-child(1) > div > div.ng-star-inserted > div > div > ';
                if (bet.choiceName.toLowerCase() === '%1%') {
                    buttonSelector += 'div:nth-child(1) > app-selection';
                } else if (bet.choiceName.toLowerCase() === '%2%') {
                    buttonSelector += 'div:nth-child(2) > app-selection';
                } else {
                    r = false;
                    console.log('Error : no bet.choiceName defined for ' + bet.choiceName + ' and ' + bet.betCode);
                }
            }
            // Score final (Set) Tennis -> 2 - 0 ou 2 - 1 ou 0 - 2 ou 1 - 2
            //TODO: Attention quand il y aura des GC ca ne fonctionnera sûrement plus car ça se joue en 3 set
            //      -> 3 - 0 ou 3 - 1 ou 3 - 2 ou 0 - 3 ou 1 - 3 ou 2 - 3
            //      Pas de match actuellement donc on peut pas tester le 3 set
            if(bet.betCode === 'Ten_Set') {
                buttonSelector = 'app-match > div > app-match-markets > app-market:nth-child(3) > div >  ';
                const betName = await this.getTextFromSelector(page, buttonSelector + 'div.marketBox_head > h2');
                console.log(betName);
                if(betName.trim() === 'Score final (sets)') {
                    buttonSelector += 'div.ng-star-inserted > div > div > ';
                    if (bet.choiceName.toLowerCase() === '2 - 0') {
                        buttonSelector += 'div:nth-child(1) > app-selection';
                    } else if (bet.choiceName.toLowerCase() === '0 - 2') {
                        buttonSelector += 'div:nth-child(2) > app-selection';
                    } else if (bet.choiceName.toLowerCase() === '2 - 1') {
                        buttonSelector += 'div:nth-child(3) > app-selection';
                    } else if (bet.choiceName.toLowerCase() === '1 - 2') {
                        buttonSelector += 'div:nth-child(4) > app-selection';
                    } else {
                        r = false;
                        console.log('Error : no bet.choiceName defined for ' + bet.choiceName + ' and ' + bet.betCode);
                    }
                } else {
                    r = false;
                    console.log('Error : no bet.choiceName defined for ' + bet.choiceName + ' and ' + bet.betCode);
                }
            }
            if (r && buttonSelector !== null) {
                console.log('click on odd ...');
                await page.click(buttonSelector);
                await this.timeout(500);
                console.log('enter amount ...');
                await page.type('app-betting-slip-single-bet-item-footer > div > div > app-bs-stake > div > input', process.env.AMOUNT_BET);
                await this.timeout(500);
                if (await page.$('bc-gb-cookie-banner > div > div > button') !== null) {
                    console.log('click remove cookie ...');
                    await page.click('bc-gb-cookie-banner > div > div > button');
                    await this.timeout(500);
                }
                console.log('click Parier ...');
                await page.click('#betBtn');
            }
        } else {
            console.log(bet.matchName + ' is not available on betclic : ' + page.url());
        }
        this.bets.splice(0, 1);
        await this.timeout(2000);
        await this.clearPanier(page);
        await this.timeout(2000);

        await page.goto('about:blank');
        await page.close();
        this.bet();
    }

    async getTextFromSelector(page, selector) {
        return await page.evaluate((selector) => {
            return $(selector).text();
        }, selector);
    }

    async clearPanier(page) {
        try {
            const closePlaceBetButton = '#closeBetConfirmation';
            if (await page.waitForSelector(closePlaceBetButton, {timeout: 2000})) {
                await page.click(closePlaceBetButton);
                await this.timeout(1000);
            }
            const deletePanierButton = 'app-desktop > div.layout > div > div > div > app-right-menu > app-betting-slip > div > div > div.bettingslip_headerDelete.ng-star-inserted > div > button';
            if (await page.waitForSelector(deletePanierButton, {timeout: 2000})) {
                await page.click(deletePanierButton);
                await this.timeout(500);
                if (await page.waitForSelector('#action', {timeout: 2000})) {
                    await page.click('#action');
                    await this.timeout(2000);
                }
            }
        } catch (e) {
            console.log('==============================================================================');
            console.log(e);
            console.log('==============================================================================');
        }
    }

    async login(page = null) {
        if (page === null) {
            page = await this.browser.newPage();
            await page.goto('https://www.betclic.fr/');
            await page.addScriptTag({path: 'lib/jquery-3.4.1.min.js'});
        }
        if (await this.isLogin(page, false)) {
            console.log('already logging');
            return page;
        }
        console.log('not logging yet, click logging button');
        const loginFormVisible = page.waitForSelector(this.loginForm, {visible: true});
        await page.click(this.loginButton);
        await loginFormVisible;
        const loginDone = page.waitForSelector('body > app-desktop > bc-gb-header > header > div > a.header_account.prebootFreeze.ng-star-inserted > span', {visible: true});
        await this.timeout(500);
        const loginSelector = '#loginPage_username > input';
        await this.deleteInputValue(page, loginSelector);
        await page.type(loginSelector, process.env.LOGIN_USERNAME);
        await this.timeout(500);
        const passwordSelector = '#loginpage_password > input';
        await this.deleteInputValue(page, passwordSelector);
        await page.type(passwordSelector, process.env.LOGIN_PASSWORD);
        await this.timeout(500);
        await page.type('#date', process.env.LOGIN_DAY + process.env.LOGIN_MONTH + process.env.LOGIN_YEAR);
        await this.timeout(500);
        await page.click('login-form > form > div.buttonWrapper > button');
        await this.timeout(500);
        await loginDone;
        console.log('logging done !');
        return page;
    }

    async deleteInputValue(page, selector) {
        await page.focus(selector);
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
    }

    /**
     * @param page: need to be on a betclic page with jquery injected
     * @param reloadPage
     * @returns {Promise<boolean>}
     */
    async isLogin(page, reloadPage = true) {
        if (reloadPage) {
            await page.reload({waitUntil: ['networkidle0', 'domcontentloaded']});
        }
        return await page.evaluate((loginButton) => {
            const loginButtonEl = $(loginButton);
            return (!($(loginButtonEl).length >= 1 && $(loginButtonEl).is(':visible')));
        }, this.loginButton);
    }

    async timeout(time) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, time);
        });
    }
}

module.exports = App;
