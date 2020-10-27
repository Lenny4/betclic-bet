const clone = require('clone');

class App {
    constructor(browser) {
        this.bets = [];
        this.doublons = [];
        this.isBetting = false;
        this.browser = browser;
        this.loginButton = 'body > app-desktop > bc-gb-header > header > div > div.buttonWrapper > a';
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
            console.log('start betting');
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
        await page.goto(url, {
            waitUntil: 'load',
            // Remove the timeout
            timeout: 0
        });
        await page.addScriptTag({path: 'lib/jquery-3.4.1.min.js'});
        console.log('page before login');
        page = await this.login(page);
        await this.timeout(5000);
        console.log('start canBet');
        let r = true;
        if (page.url().includes(bet.matchId)) {
            await this.clearPanier(page);
            let buttonSelector = null;
            // Résultat du match Foot -> %1% ou nul ou %2%
            if (bet.betCode === 'Ftb_Mr3') {
                const betNameFtb_Mr3 = 'Résultat du match';
                const indexBetFtb_Mr3 = await this.getIndexOfBet(page, betNameFtb_Mr3);
                if (indexBetFtb_Mr3 === null) {
                    console.log('Error : no bet.betName defined for ' + betNameFtb_Mr3);
                } else {
                    buttonSelector = 'div.verticalScroller_wrapper > div > div > app-market:nth-child(' + indexBetFtb_Mr3 + ') > div > div.ng-star-inserted > div > div > ';
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
            }
            // Vainqueur du match Tennis -> %1% ou %2%
            if (bet.betCode === 'Ten_Mr2') {
                const betNameTen_Mr2 = 'Vainqueur du match';
                const indexBetTen_Mr2 = await this.getIndexOfBet(page, betNameTen_Mr2);
                if (indexBetTen_Mr2 === null) {
                    console.log('Error : no bet.betName defined for ' + betNameTen_Mr2);
                } else {
                    buttonSelector = 'div.verticalScroller_wrapper > div > div > app-market:nth-child(' + indexBetTen_Mr2 + ') > div > div.ng-star-inserted > div > div > ';
                    if (bet.choiceName.toLowerCase() === '%1%') {
                        buttonSelector += 'div:nth-child(1) > app-selection';
                    } else if (bet.choiceName.toLowerCase() === '%2%') {
                        buttonSelector += 'div:nth-child(2) > app-selection';
                    } else {
                        r = false;
                        console.log('Error : no bet.choiceName defined for ' + bet.choiceName + ' and ' + bet.betCode);
                    }
                }
            }
            // Score final (Set) Tennis
            if (bet.betCode === 'Ten_Set') {
                buttonSelector = await this.getSelectorToBet(page, 'Score final (sets)', bet.choiceName);
            }
            // Baseball nombre total de run
            if (bet.betCode === 'Bsb_Trn') {
                buttonSelector = await this.getSelectorToBet(page, 'Total Runs', bet.choiceName);
            }
            // Vainqueur du match (Basket)
            if (bet.betCode === 'Bkb_Mr6') {
                const betNameBkb_Mr6 = 'Vainqueur du match';
                const indexBetTen_Mr2 = await this.getIndexOfBet(page, betNameBkb_Mr6);
                if (indexBetTen_Mr2 === null) {
                    console.log('Error : no bet.betName defined for ' + betNameBkb_Mr6);
                } else {
                    buttonSelector = 'div.verticalScroller_wrapper > div > div > app-market:nth-child(' + indexBetTen_Mr2 + ') > div > div.ng-star-inserted > div > div > ';
                    if (bet.choiceName.toLowerCase() === '%1%') {
                        buttonSelector += 'div:nth-child(1) > app-selection';
                    } else if (bet.choiceName.toLowerCase() === '%2%') {
                        buttonSelector += 'div:nth-child(2) > app-selection';
                    } else {
                        r = false;
                        console.log('Error : no bet.choiceName defined for ' + bet.choiceName + ' and ' + bet.betCode);
                    }
                }
            }
            // Résultat du match (Basket)
            if (bet.betCode === 'Bkb_Mrs') {
                const betNameBkb_Mrs = 'Résultat du match';
                const indexBetFtb_Mr3 = await this.getIndexOfBet(page, betNameBkb_Mrs);
                if (indexBetFtb_Mr3 === null) {
                    console.log('Error : no bet.betName defined for ' + betNameBkb_Mrs);
                } else {
                    buttonSelector = 'div.verticalScroller_wrapper > div > div > app-market:nth-child(' + indexBetFtb_Mr3 + ') > div > div.ng-star-inserted > div > div > ';
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
            }
            if (r && buttonSelector !== null) {
                try {
                    console.log('click on odd ...');
                    if (await page.$(buttonSelector) === null) {
                        await this.timeout(5000);
                    }
                    await page.click(buttonSelector);
                    await this.timeout(500);
                } catch (e) {
                    await page.screenshot({path: bet.matchName + '_click_odd.png', fullPage: true});
                    await this.logError(e);
                }
                try {
                    console.log('enter amount ...');
                    await page.type('app-betting-slip-single-bet-item-footer > div > div > app-bs-stake > div > input', process.env.AMOUNT_BET);
                    await this.timeout(500);
                } catch (e) {
                    await this.logError(e);
                }
                if (await page.$('bc-gb-cookie-banner > div > div > button') !== null) {
                    console.log('click remove cookie ...');
                    await page.click('bc-gb-cookie-banner > div > div > button');
                    await this.timeout(500);
                }
                try {
                    console.log('click on bet button ...');
                    await page.click('#betBtn');
                    await this.timeout(2000);
                } catch (e) {
                    await this.logError(e);
                }
                const closeConfirmationBetButton = '#closeBetConfirmation';
                if (await page.$(closeConfirmationBetButton) !== null) {
                    console.log('click on close confirmation bet ...');
                    await page.click(closeConfirmationBetButton);
                    await this.timeout(500);
                } else {
                    await this.logError('button close confirmation bet not found');
                }
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

    async getSelectorToBet(page, betName, choiceName) {
        let buttonSelector;
        const indexBet = await this.getIndexOfBet(page, betName);
        if (indexBet === null) {
            console.log('Error : no bet.betName defined for ' + betName);
        } else {
            buttonSelector = 'div.verticalScroller_wrapper > div > div > app-market:nth-child(' + indexBet + ') > div';
            const indexChoice = await this.getIndexOfChoice(page, buttonSelector, choiceName);
            if (indexChoice === null) {
                console.log('Error : no bet.choiceName defined for ' + choiceName);
            } else {
                buttonSelector += ' > div.ng-star-inserted > div > div > div:nth-child(' + indexChoice + ') > app-selection';
            }
        }
        return buttonSelector;
    }

    async getIndexOfBet(page, betName) {
        for (let index = 0; index < 10; index++) {
            const selectorTmp = 'div.verticalScroller_wrapper > div > div > app-market:nth-child(' + index + ') > div >  div.marketBox_head > h2';
            const betNameTmp = (await this.getTextFromSelector(page, selectorTmp)).trim();
            if (betName.toLowerCase() === betNameTmp.toLowerCase()) {
                return index;
            }
        }
        return null;
    }

    async getIndexOfChoice(page, selector, choiceName) {
        for (let index = 0; index < 20; index++) {
            const selectorTmp = selector + ' > div.ng-star-inserted > div > div > div:nth-child(' + index + ') > p';
            const choiceNameTmp = (await this.getTextFromSelector(page, selectorTmp)).trim();
            if (choiceNameTmp.toLowerCase() === choiceName.toLowerCase()) {
                return index;
            }
        }
        return null;
    }

    async logError(error) {
        console.log('==============================================================================');
        console.log(error);
        console.log('==============================================================================');

        try {
            const okButton = '#action';
            if (await page.$(okButton) !== null) {
                if (await page.waitForSelector(okButton, {timeout: 2000})) {
                    await page.click(okButton);
                    await this.timeout(2000);
                    console.log('==============================================================================');
                    console.log('Ok button found after error');
                    console.log('==============================================================================');
                }
            }
        } catch (e) {
            console.log('==============================================================================');
            console.log('button ok not found after logging error');
            console.log('==============================================================================');
        }
    }

    async getTextFromSelector(page, selector) {
        return await page.evaluate((selector) => {
            return $(selector).text();
        }, selector);
    }

    async clearPanier(page) {
        try {
            const deletePanierButton = 'body > app-desktop > div.layout > div > div > div > app-right-menu > app-betting-slip > div > div > div.bettingslip_headerDelete.ng-star-inserted > div > button';
            if (await page.$(deletePanierButton) !== null) {
                if (await page.waitForSelector(deletePanierButton, {timeout: 2000})) {
                    await page.click(deletePanierButton);
                    await this.timeout(500);
                    const supprimerButton = '#action';
                    if (await page.waitForSelector(supprimerButton, {timeout: 2000})) {
                        await page.click(supprimerButton);
                        await this.timeout(2000);
                    }
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
        await this.timeout(5000);
        await page.click(this.loginButton);
        const loginFormVisible = page.waitForSelector(this.loginForm, {visible: true});
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
        try {
            const okButton = '#action';
            if (await page.$(okButton) !== null) {
                if (await page.waitForSelector(okButton, {timeout: 2000})) {
                    await page.click(okButton);
                    await this.timeout(2000);
                    console.log('==============================================================================');
                    console.log('Ok button found after login');
                    console.log('==============================================================================');
                }
            }
            const okButton2 = 'body > app-desktop > div.layout > div > app-content-scroller > div > winnings-page > div > div > div.buttonWrapper > button ';
            if (await page.$(okButton2) !== null) {
                if (await page.waitForSelector(okButton, {timeout: 2000})) {
                    await page.click(okButton);
                    await this.timeout(2000);
                    console.log('==============================================================================');
                    console.log('Ok button found after login');
                    console.log('==============================================================================');
                }
            }
        } catch (e) {
            console.log('==============================================================================');
            console.log('button ok not found after logging error');
            console.log('==============================================================================');
        }
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
