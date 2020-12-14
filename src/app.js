const clone = require('clone');
const superagent = require('superagent');

class App {
    constructor(browser) {
        this.bets = [];
        this.doublons = [];
        this.isBetting = false;
        this.browser = browser;
        this.loginButton = 'body > app-desktop > bc-gb-header > header > div > div.buttonWrapper > a';
        this.profileButton = 'body > app-desktop > bc-gb-header > header > div > a.header_account.prebootFreeze > span';
        this.loginForm = 'login-form';
        this.listBetSelector = 'div.verticalScroller_wrapper > div > div > sports-markets-single-market:nth-child';
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
                amountToWin: match.amountToWin,
                betActionSerieId: match.betActionSerieId,
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
        console.log('start betting');
        if (page.url().includes(bet.matchId)) {
            await this.clearPanier(page);
            let buttonSelector = null;
            // Résultat du match Foot -> %1% ou nul ou %2%
            if (bet.betCode === 'Ftb_Mr3') {
                buttonSelector = await this.getResultSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // But pour les 2 équipes -> Oui ou Non
            if (bet.betCode === 'Ftb_Bts') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Nombre total de but
            if (bet.betCode === 'Ftb_10') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Vainqueur du match Tennis -> %1% ou %2%
            if (bet.betCode === 'Ten_Mr2') {
                buttonSelector = await this.getWinnerSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Score final (Set) Tennis
            if (bet.betCode === 'Ten_Set') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Score exact du 1er set Tennis
            if (bet.betCode === 'Ten_Cs1') {
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
            // Nombre total de points (Bkb_Tpt)
            if (bet.betCode === 'Bkb_Tpt') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Vainqueur du match (Volley)
            if (bet.betCode === 'Vlb_Mr2') {
                buttonSelector = await this.getWinnerSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Vainqueur du match (Snooker)
            if (bet.betCode === 'Snk_Mr2') {
                buttonSelector = await this.getWinnerSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Résultat (Hockey)
            if (bet.betCode === 'Ihk_Mrs') {
                buttonSelector = await this.getResultSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Nombre total de but
            if (bet.betCode === 'Ihk_TglM') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Vainqueur du match
            if (bet.betCode === 'Ihk_Mnl') {
                buttonSelector = await this.getWinnerSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Résultat (Rugby)
            if (bet.betCode === 'Rgb_Mr3') {
                buttonSelector = await this.getResultSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Nombre de points (Rugby)
            if (bet.betCode === 'Rgb_Tpt') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Résultat (Hand-ball)
            if (bet.betCode === 'Hdb_Mr2') {
                buttonSelector = await this.getResultSelectorToBet(page, bet.betName, bet.choiceName);
            }
            if (buttonSelector == null) {
                console.log("Le paris n'a pas été trouvé");
                this.sendBetToServer(bet.betActionSerieId, 0, 0, true);
                this.endBetting(page);
                return;
            }
            const oddValue = parseFloat((await this.getTextFromSelector(page, buttonSelector)).trim().replace(',', '.'));
            if(oddValue < 1.1) {
                console.log('Impossible de parier sur une côte inférieure à 1.1 sur betclic');
                this.sendBetToServer(bet.betActionSerieId, 0, oddValue, true);
                this.endBetting(page);
                return;
            }
            let amountToBet = this.getAmountToBet(bet.amountToWin, oddValue);
            if (oddValue > bet.maxOdd) {
                console.log('Odd value ' + oddValue + ' to bet is greater than max odd ' + bet.maxOdd);
                this.sendBetToServer(bet.betActionSerieId, amountToBet, oddValue, true);
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
                console.log('enter amount ...' + amountToBet);
                await this.selectorTypeValue(page, 'app-betting-slip-single-bet-item > div > app-betting-slip-single-bet-item-footer > div > div > app-bs-stake > div > input', amountToBet);
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
                this.sendBetToServer(bet.betActionSerieId, amountToBet, oddValue, false);
            } else {
                await this.logError('button close confirmation bet not found');
                this.sendBetToServer(bet.betActionSerieId, amountToBet, oddValue, true);
            }
        } else {
            this.sendBetToServer(bet.betActionSerieId, 0, 0, true);
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
            buttonSelector = this.listBetSelector + '(' + indexBet + ') > div > sports-markets-single-market-selections-group > div > ';
            if (choiceName.toLowerCase() === '%1%') {
                buttonSelector += 'div:nth-child(1) > sports-selections-selection';
            } else if (choiceName.toLowerCase() === '%2%') {
                buttonSelector += 'div:nth-child(2) > sports-selections-selection';
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
            buttonSelector = this.listBetSelector + '(' + indexBet + ') > div > sports-markets-single-market-selections-group > div > ';
            if (choiceName.toLowerCase() === '%1%') {
                buttonSelector += 'div:nth-child(1) > sports-selections-selection';
            } else if (choiceName.toLowerCase() === '%2%') {
                buttonSelector += 'div:nth-child(3) > sports-selections-selection';
            } else if (choiceName.toLowerCase() === 'nul') {
                buttonSelector += 'div:nth-child(2) > sports-selections-selection';
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
            buttonSelector = this.listBetSelector + '(' + indexBet + ') > div';
            let showMorebuttonSelector = buttonSelector + ' > sports-markets-single-market-selections-group > div.seeMoreButton.prebootFreeze.ng-star-inserted';
            if (await page.$(showMorebuttonSelector) !== null) {
                await this.selectorClick(page, showMorebuttonSelector);
            }
            const indexChoice = await this.getIndexOfChoice(page, buttonSelector, choiceName);
            if (indexChoice === null) {
                console.log('Error : no bet.choiceName defined for ' + choiceName);
            } else {
                buttonSelector += ' > sports-markets-single-market-selections-group > div.marketBox_body.is-2col.ng-star-inserted > div:nth-child(' + indexChoice + ') > sports-selections-selection';
            }
        }
        return buttonSelector;
    }

    async getIndexOfBet(page, betName) {
        for (let index = 0; index < 10; index++) {
            const selectorTmp = this.listBetSelector + '(' + index + ') > div >  div.marketBox_head > h2';
            const betNameTmp = (await this.getTextFromSelector(page, selectorTmp)).trim();
            if (betName.toLowerCase().trim() === betNameTmp.toLowerCase()) {
                return index;
            }
        }
        return null;
    }

    async getIndexOfChoice(page, selector, choiceName) {
        for (let index = 0; index < 20; index++) {
            const selectorTmp = selector + ' > sports-markets-single-market-selections-group > div.marketBox_body.is-2col.ng-star-inserted > div:nth-child(' + index + ') > p';
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
        await page.waitForSelector(this.loginForm, {visible: true});
        await this.selectorTypeValue(page, '#loginPage_username > input', process.env.LOGIN_USERNAME);
        await this.selectorTypeValue(page, '#loginpage_password > input', process.env.LOGIN_PASSWORD);
        await this.selectorTypeValue(page, '#date', process.env.LOGIN_DAY + process.env.LOGIN_MONTH + process.env.LOGIN_YEAR);
        await this.deletePopUp(page);
        await this.selectorClick(page, 'login-page > div > div > div.container_content > div.box > div.box_content > login-form > form > div.buttonWrapper > button');
        console.log('logging done !');
        await this.timeout(2000);
        try {
            const okButton = '#action';
            if (await page.$(okButton) !== null) {
                if (await page.waitForSelector(okButton, {timeout: 2000})) {
                    await this.selectorClick(page, okButton);
                    await this.timeout(2000);
                    console.log('Ok button found after login');
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
                    console.log('Ok button found after login');
                }
            }
        } catch (e) {
            console.log('==============================================================================');
            console.log('button ok not found after logging error');
            console.log('==============================================================================');
        }
        await this.timeout(2000);
        return page;
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

    async selectorTypeValue(page, selector, value) {
        await this.deleteInputValue(page, selector);
        await page.type(selector, value.toString());
        await this.timeout(500);
    }

    async deleteInputValue(page, selector) {
        await page.focus(selector);
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
    }

    async timeout(time) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, time);
        });
    }

    getAmountToBet(amountToWin, odd) {
        return process.env.AMOUNT_BET;
    }

    sendBetToServer(betActionSerieId, amountBet, odd, canceled) {
        // Nothing to send to server
    }
}

module.exports = App;
