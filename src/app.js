const clone = require('clone');

class App {
    constructor(browser) {
        this.bets = [];
        this.doublons = [];
        this.isBetting = false;
        this.browser = browser;
        this.loginButton = 'body > app-desktop > bc-gb-header > header > div > div.buttonWrapper > a';
        this.profileButton = 'body > app-desktop > bc-gb-header > header > div > a.header_account.prebootFreeze > span';
        this.loginForm = 'login-form';
    }

    async addBets(matchs) {
        const now = Math.round(new Date().getTime() / 1000);
        for (let match of matchs) {
            const doublon = this.doublons.find(x =>
                x.matchId === match.matchId
                && x.betCode === match.betCode);
            const bet = {
                betCode: match.betCode,
                betName: match.betName,
                matchName: match.matchName,
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
        console.log('start betting');
        const now = Math.round(new Date().getTime() / 1000);
        const bet = this.bets[0];
        console.log('is betting on ', bet);
        let page = await this.browser.newPage();
        console.log('start try, page created for bet');
        const url = 'https://www.betclic.fr/' + '-m' + bet.matchId;
        console.log('page going to ' + url);
        await page.goto(url, {
            waitUntil: ['load', 'networkidle0', 'domcontentloaded', 'networkidle2'],
            // Remove the timeout
            timeout: 0
        });
        await page.addScriptTag({path: 'lib/jquery-3.4.1.min.js'});
        console.log('page before login');
        page = await this.login(page, url);
        await this.timeout(2000);
        console.log('start betting');
        if (page.url().includes(bet.matchId)) {
            await this.clearPanier(page);
            let buttonSelector = null;
            // Résultat du match Foot -> %1% ou nul ou %2%
            if (bet.betCode === 'Ftb_Mr3') {
                buttonSelector = await this.getResultSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Vainqueur du match Tennis -> %1% ou %2%
            if (bet.betCode === 'Ten_Mr2') {
                buttonSelector = await this.getWinnerSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Score final (Set) Tennis
            if (bet.betCode === 'Ten_Set') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Baseball nombre total de run
            if (bet.betCode === 'Bsb_Trn') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Vainqueur du match (Basket)
            if (bet.betCode === 'Bkb_Mr6') {
                buttonSelector = await this.getWinnerSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Résultat du match (Basket)
            if (bet.betCode === 'Bkb_Mrs') {
                buttonSelector = await this.getResultSelectorToBet(page, bet.betName, bet.choiceName);
            }
            if (buttonSelector == null) {
                console.log("Le paris n'a pas été trouvé");
                this.endBetting(page);
                return;
            }
            const oddValue = parseFloat((await this.getTextFromSelector(page, buttonSelector)).trim().replace(',', '.'));
            if (oddValue > bet.maxOdd) {
                console.log('Odd value ' + oddValue + ' to bet is greater than max odd ' + bet.maxOdd);
                this.endBetting(page);
                return;
            }
            try {
                console.log('click on odd ...');
                if (await page.$(buttonSelector) === null) {
                    await this.timeout(5000);
                }
                await this.selectorClick(page, buttonSelector);
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
                await this.selectorClick(page, 'bc-gb-cookie-banner > div > div > button');
            }
            try {
                console.log('click on bet button ...');
                await this.selectorClick(page, '#betBtn');
                await this.timeout(2000);
            } catch (e) {
                await this.logError(e);
            }
            const closeConfirmationBetButton = '#closeBetConfirmation';
            if (await page.$(closeConfirmationBetButton) !== null) {
                console.log('click on close confirmation bet ...');
                await this.selectorClick(page, closeConfirmationBetButton);
            } else {
                await this.logError('button close confirmation bet not found');
            }
        } else {
            console.log(bet.matchName + ' is not available on betclic : ' + page.url());
        }
        this.endBetting(page);
    }

    async endBetting(page) {
        this.bets.splice(0, 1);
        await this.timeout(2000);
        await this.clearPanier(page);
        await this.timeout(2000);

        await page.goto('about:blank');
        await page.close();
        this.bet();
    }

    async getWinnerSelectorToBet(page, betName, choiceName) {
        let buttonSelector;
        const indexBet = await this.getIndexOfBet(page, betName);
        if (indexBet === null) {
            console.log('Error : no bet.betName defined for ' + betName);
        } else {
            buttonSelector = 'div.verticalScroller_wrapper > div > div > app-market:nth-child(' + indexBet + ') > div > div.ng-star-inserted > div > div > ';
            if (choiceName.toLowerCase() === '%1%') {
                buttonSelector += 'div:nth-child(1) > app-selection';
            } else if (choiceName.toLowerCase() === '%2%') {
                buttonSelector += 'div:nth-child(2) > app-selection';
            } else {
                console.log('Error : no bet.choiceName defined for ' + bet.choiceName + ' and ' + bet.betCode);
            }
        }
        return buttonSelector;
    }

    async getResultSelectorToBet(page, betName, choiceName) {
        let buttonSelector;
        const indexBet = await this.getIndexOfBet(page, betName);
        if (indexBet === null) {
            console.log('Error : no bet.betName defined for ' + betName);
        } else {
            buttonSelector = 'div.verticalScroller_wrapper > div > div > app-market:nth-child(' + indexBet + ') > div > div.ng-star-inserted > div > div > ';
            if (choiceName.toLowerCase() === '%1%') {
                buttonSelector += 'div:nth-child(1) > app-selection';
            } else if (choiceName.toLowerCase() === '%2%') {
                buttonSelector += 'div:nth-child(3) > app-selection';
            } else if (choiceName.toLowerCase() === 'nul') {
                buttonSelector += 'div:nth-child(2) > app-selection';
            } else {
                console.log('Error : no bet.choiceName defined for ' + bet.choiceName + ' and ' + bet.betCode);
            }
        }
        return buttonSelector;
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
                    await this.selectorClick(page, okButton);
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
                    await this.selectorClick(page, deletePanierButton);
                    const supprimerButton = '#action';
                    if (await page.waitForSelector(supprimerButton, {timeout: 2000})) {
                        await this.selectorClick(page, supprimerButton);
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

    async login(page = null, returnUrl) {
        if (page === null) {
            page = await this.browser.newPage();
            await page.goto('https://www.betclic.fr/');
            await page.addScriptTag({path: 'lib/jquery-3.4.1.min.js'});
        }
        if (await this.isLogin(page)) {
            console.log('already logging');
            return page;
        }
        console.log('not logging yet, go to login page');
        await this.timeout(1000);
        await this.deletePopUp(page);
        await this.selectorClick(page, this.loginButton);
        const loginFormVisible = page.waitForSelector(this.loginForm, {visible: true});
        await loginFormVisible;
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
        await this.deletePopUp(page);
        await this.selectorClick(page, 'login-page > div > div > div.container_content > div.box > div.box_content > login-form > form > div.buttonWrapper > button');
        await this.timeout(2000);
        console.log('logging done !');
        try {
            const okButton = '#action';
            if (await page.$(okButton) !== null) {
                if (await page.waitForSelector(okButton, {timeout: 2000})) {
                    await this.selectorClick(page, okButton);
                    await this.timeout(2000);
                    console.log('==============================================================================');
                    console.log('Ok button found after login');
                    console.log('==============================================================================');
                    console.log('page going to ' + returnUrl);
                    await page.goto(returnUrl, {
                        waitUntil: ['load', 'networkidle0', 'domcontentloaded', 'networkidle2'],
                        // Remove the timeout
                        timeout: 0
                    });
                    await page.addScriptTag({path: 'lib/jquery-3.4.1.min.js'});
                }
            }
            const okButton2 = 'body > app-desktop > div.layout > div > app-content-scroller > div > winnings-page > div > div > div.buttonWrapper > button ';
            if (await page.$(okButton2) !== null) {
                if (await page.waitForSelector(okButton2, {timeout: 2000})) {
                    await this.selectorClick(page, okButton2);
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
        return page;
    }

    async deleteInputValue(page, selector) {
        await page.focus(selector);
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
    }

    async isLogin(page) {
        return !await this.selectorVisible(page, this.loginButton) && await this.selectorVisible(page, this.profileButton);
    }

    async deletePopUp(page) {
        const popUpSelector = 'body > app-desktop > bc-gb-modal-popup > div';
        await page.evaluate((selector) => {
            const elements = document.querySelectorAll(selector);
            for (let i = 0; i < elements.length; i++) {
                console.log("Pop up deleted");
                elements[i].parentNode.removeChild(elements[i]);
            }
        }, popUpSelector)
    }

    async selectorVisible(page, selector) {
        return await page.$(selector) != null;
    }

    async selectorClick(page, selector) {
        await page.$eval(selector, element => element.click());
        await this.timeout(500);
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
