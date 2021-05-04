const {exec} = require('child_process');
const slugify = require('slugify');
const fs = require('fs');
const {readdirSync} = require('fs')
const SlackService = require('./Service/SlackService');

class App {
    constructor(browser) {
        this.bets = [];
        this.doublons = [];
        this.isBetting = false;
        this.browser = browser;
        this.videoFolder = 'videos';
        this.loginButton = 'body > app-desktop > bc-gb-header > header > div > div.buttonWrapper > a';
        this.profileButton = 'body > app-desktop > bc-gb-header > header > div > a.header_account.prebootFreeze > span';
        this.loginForm = 'login-form';
        this.listBetSelector = 'div.verticalScroller_wrapper > div > div > sports-markets-single-market:nth-child';
        this.listBetSelectorDoubleChanceFoot = 'div.verticalScroller_wrapper > div > div > sports-markets-grouped-markets';
        // region slack
        this.slackCurrentLog = '';
        this.slackCurrentChannel = process.env.SLACK_CHANNEL_SUCCESS_DETAIL_ID;
        this.slackMessageDisplay = '';
        this.currentMatchName = '';
        this.slackCurrentVideoPath = null;
        // endregion
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
        this.doublons = this.doublons.filter(x => x.time >= (now - (3600 * 24)));
        if (!this.isBetting) {
            this.bet();
        }
    }

    convertDateToFolderName(date) {
        return date.toISOString().split('T')[0];
    }

    addLog(...messages) {
        for (let message of messages) {
            console.log(message);
            if (this.canStringify(message)) {
                this.slackCurrentLog += JSON.stringify(message) + "\n";
            }
        }
    }

    canStringify(str) {
        try {
            JSON.stringify(str);
        } catch (e) {
            console.log('Error isJson');
            console.log(str);
            console.log(e);
            return false;
        }
        return true;
    }

    async bet() {
        this.isBetting = true;
        if (this.bets.length === 0) {
            this.isBetting = false;
            return;
        }
        const bet = this.bets[0];
        // region slack
        this.slackCurrentChannel = process.env.SLACK_CHANNEL_SUCCESS_DETAIL_ID;
        this.slackMessageDisplay = '';
        this.slackCurrentLog = '';
        this.currentMatchName = bet.matchName;
        this.slackCurrentVideoPath = null;
        // endregion
        await this.startRecord(bet.matchName + '-' + bet.betName + '-' + bet.choiceName, [this.convertDateToFolderName(new Date())]);
        this.addLog('is betting on ', bet);
        let page = await this.browser.newPage();
        this.addLog('start try, page created for bet');
        const url = 'https://www.betclic.fr/' + '-m' + bet.matchId;
        this.addLog('page going to ' + url);
        await page.goto(url, {
            waitUntil: ['load', 'networkidle0', 'domcontentloaded', 'networkidle2'],
            // Remove the timeout
            timeout: 0
        });
        await this.closeCookiePopUp(page);
        await page.addScriptTag({path: 'lib/jquery-3.4.1.min.js'});
        this.addLog('page before login');
        page = await this.login(page, url);
        this.addLog('start betting');
        let maxAttemptWinning = 0;
        while (page.url().includes('winnings')) {
            await page.goto(url, {
                waitUntil: ['load', 'networkidle0', 'domcontentloaded', 'networkidle2'],
                // Remove the timeout
                timeout: 0
            });
            await page.addScriptTag({path: 'lib/jquery-3.4.1.min.js'});
            maxAttemptWinning++;
            if (maxAttemptWinning >= 5) {
                break;
            }
        }
        if (page.url().includes(bet.matchId)) {
            await this.clearPanier(page);
            await this.timeout(2000);
            let buttonSelector = null;

            // ------------------- FOOT

            // Résultat du match Foot -> %1% ou nul ou %2%
            if (bet.betCode === 'Ftb_Mr3') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // But pour les 2 équipes -> Oui ou Non
            if (bet.betCode === 'Ftb_Bts') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Nombre total de but
            if (bet.betCode === 'Ftb_10') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Double chance
            if (bet.betCode === 'Ftb_Dbc') {
                buttonSelector = await this.getDoubleChanceSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Résultat du match (Remboursé si match nul)
            if (bet.betCode === 'Ftb_5') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Ecart de buts
            if (bet.betCode === 'Ftb_23') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }

            // ------------------- TENNIS

            // Vainqueur du match Tennis -> %1% ou %2%
            if (bet.betCode === 'Ten_Mr2') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Score final (Set) Tennis
            if (bet.betCode === 'Ten_Set') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Score exact du 1er set Tennis
            if (bet.betCode === 'Ten_Cs1') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Nombre total de jeux
            if (bet.betCode === 'Ten_Tgm') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }

            // ------------------- BASEBALL

            // Baseball nombre total de run
            if (bet.betCode === 'Bsb_Trn') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Vainqueur du match
            if (bet.betCode === 'Bsb_Mwi') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }

            // ------------------- BASKETBALL

            // Vainqueur du match (Basket)
            if (bet.betCode === 'Bkb_Mr6') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Résultat du match (Basket)
            if (bet.betCode === 'Bkb_Mrs') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Nombre total de points (Bkb_Tpt)
            if (bet.betCode === 'Bkb_Tpt') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }

            // ------------------- VOLLEY

            // Vainqueur du match (Volley)
            if (bet.betCode === 'Vlb_Mr2') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Vainqueur du match (Volley)
            if (bet.betCode === 'Vlb_Tpt') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }

            // ------------------- SNOOKER

            // Vainqueur du match (Snooker)
            if (bet.betCode === 'Snk_Mr2') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }

            // ------------------- HOCKEY

            // Résultat (Hockey)
            if (bet.betCode === 'Ihk_Mrs') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Nombre total de but
            if (bet.betCode === 'Ihk_TglM') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Vainqueur du match
            if (bet.betCode === 'Ihk_Mnl') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Double chance
            if (bet.betCode === 'Ihk_Dbc') {
                buttonSelector = await this.getDoubleChanceSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Ecart de buts
            if (bet.betCode === 'Ihk_Han') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }

            // ------------------- RUGBY

            // Résultat (Rugby)
            if (bet.betCode === 'Rgb_Mr3') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }
            // Nombre de points (Rugby)
            if (bet.betCode === 'Rgb_Tpt') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }

            // ------------------- HAND-BALL

            // Résultat (Hand-ball)
            if (bet.betCode === 'Hdb_Mr2') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }

            // Nombre total de buts (Hand-ball)
            if (bet.betCode === 'Hdb_Tgt') {
                buttonSelector = await this.getSelectorToBet(page, bet.betName, bet.choiceName);
            }

            // -------------------

            if (buttonSelector == null) {
                const errorMessage = "Le paris n'a pas été trouvé";
                this.addLog(errorMessage);
                this.sendBetToServer(bet.betActionSerieId, 0, 0, true);
                this.slackMessageDisplay = ": " + errorMessage;
                this.endBetting(page);
                return;
            }
            const oddValue = parseFloat((await this.getTextFromSelector(page, buttonSelector)).trim().replace(',', '.'));
            if (oddValue < 1.1) {
                const errorMessage = 'Impossible de parier sur une côte inférieure à 1.1 sur betclic';
                this.addLog(errorMessage);
                this.sendBetToServer(bet.betActionSerieId, 0, oddValue, true);
                this.slackMessageDisplay = ": " + errorMessage;
                this.endBetting(page);
                return;
            }
            let amountToBet = this.getAmountToBet(bet.amountToWin, oddValue);
            if (oddValue > bet.maxOdd) {
                const errorMessage = 'Cote ' + oddValue + ' trop élevé par rapport à ' + bet.maxOdd + ' qui était attendu';
                this.addLog(errorMessage);
                // Cas particulier pour permettre de parier dessus plus tard si l'heure change
                this.doublons = this.doublons.filter(x => x.matchId !== bet.matchId && x.betCode !== bet.betCode);
                this.sendBetToServer(bet.betActionSerieId, amountToBet, oddValue, true);
                this.slackMessageDisplay = ": " + errorMessage;
                this.endBetting(page);
                return;
            }
            try {
                this.addLog('click on odd ...');
                if (await page.$(buttonSelector) === null) {
                    await this.timeout(5000);
                }
                await this.selectorClick(page, buttonSelector);
            } catch (e) {
                await page.screenshot({path: bet.matchName + '_click_odd.png', fullPage: true});
                await this.logError(e);
            }
            try {
                this.addLog('enter amount ...' + amountToBet);
                await this.selectorTypeValue(page, 'app-betting-slip-single-bet-item > div > app-betting-slip-single-bet-item-footer > div > div > app-bs-stake > div > input', amountToBet);
            } catch (e) {
                await this.logError(e);
            }
            if (await page.$('bc-gb-cookie-banner > div > div > button') !== null) {
                this.addLog('click remove cookie ...');
                await this.selectorClick(page, 'bc-gb-cookie-banner > div > div > button');
            }
            try {
                this.addLog('click on bet button ...');
                await this.selectorClick(page, '#betBtn');
                await this.timeout(2000);
            } catch (e) {
                await this.logError(e);
            }
            const closeConfirmationBetButton = '#closeBetConfirmation';
            if (await page.$(closeConfirmationBetButton) !== null) {
                this.addLog('click on close confirmation bet ...');
                await this.selectorClick(page, closeConfirmationBetButton);
                this.sendBetToServer(bet.betActionSerieId, amountToBet, oddValue, false);
            } else {
                await this.logError('button close confirmation bet not found');
                this.sendBetToServer(bet.betActionSerieId, amountToBet, oddValue, true);
            }
        } else {
            this.sendBetToServer(bet.betActionSerieId, 0, 0, true);
            this.addLog(bet.matchName + ' is not available on betclic : ' + page.url());
            this.slackCurrentChannel = process.env.SLACK_CHANNEL_ERROR_ID;
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
        await this.stopAllRecord();
        // region slack
        await SlackService.sendMessage(this.slackCurrentLog, this.slackCurrentChannel);
        // https://api.slack.com/docs/rate-limits
        await this.timeout(1000);
        if (this.slackCurrentChannel === process.env.SLACK_CHANNEL_SUCCESS_DETAIL_ID) {
            let message = this.currentMatchName;
            if(this.slackMessageDisplay !== '') {
                message += this.slackMessageDisplay;
            }
            await SlackService.sendMessage(message, process.env.SLACK_CHANNEL_SUCCESS_ID);
        }
        // send video
        if (this.slackCurrentChannel === process.env.SLACK_CHANNEL_ERROR_ID) {
            // no await here file upload might take time
            SlackService.sendFile(this.slackCurrentVideoPath, this.slackCurrentChannel);
        }
        // endregion
        this.bet();
    }

    async getSelectorToBet(page, betName, choiceName) {
        let buttonSelector;
        const indexBet = await this.getIndexOfBet(page, betName);
        if (indexBet === null) {
            this.addLog('Error : no bet.betName defined for ' + betName);
            this.slackCurrentChannel = process.env.SLACK_CHANNEL_ERROR_ID;
        } else {
            buttonSelector = this.listBetSelector + '(' + indexBet + ') > div';
            let showMorebuttonSelector = buttonSelector + ' > sports-markets-single-market-selections-group > div.seeMoreButton.prebootFreeze.ng-star-inserted';
            if (await page.$(showMorebuttonSelector) !== null) {
                await this.selectorClick(page, showMorebuttonSelector);
            }
            const selectorChoice = await this.getIndexOfChoice(page, buttonSelector, choiceName);
            if (selectorChoice === null) {
                this.addLog('Error : no bet.choiceName defined for ' + choiceName);
                this.slackCurrentChannel = process.env.SLACK_CHANNEL_ERROR_ID;
            } else {
                buttonSelector = selectorChoice + ' > sports-selections-selection > div > span';
            }
        }
        return buttonSelector;
    }

    async getDoubleChanceSelectorToBet(page, betName, choiceName) {
        let selectorTmp = this.listBetSelectorDoubleChanceFoot + ' > div > div.marketBox_head > h2';
        const betNameTmp = (await this.getTextFromSelector(page, selectorTmp)).trim();
        let buttonSelector;
        if (betName.toLowerCase().trim() !== betNameTmp.toLowerCase()) {
            this.addLog('Error : no bet.betName defined for ' + betName);
            this.slackCurrentChannel = process.env.SLACK_CHANNEL_ERROR_ID;
        } else {
            buttonSelector = this.listBetSelectorDoubleChanceFoot + ' > div > div.marketBox_body.ng-star-inserted >';
            if (choiceName.toLowerCase() === '%1% ou Nul'.toLowerCase()) {
                buttonSelector += 'div:nth-child(2) > div.marketBox_list > div:nth-child(1) > sports-selections-selection';
            } else if (choiceName.toLowerCase() === 'Nul ou %2%'.toLowerCase()) {
                buttonSelector += 'div:nth-child(4) > div.marketBox_list > div:nth-child(1) > sports-selections-selection';
            } else if (choiceName.toLowerCase() === '%1% ou %2%'.toLowerCase()) {
                buttonSelector += 'div:nth-child(3) > div.marketBox_list > div:nth-child(1) > sports-selections-selection';
            } else {
                this.addLog('Error : no bet.choiceName defined for ' + choiceName + ' and ' + betName);
                this.slackCurrentChannel = process.env.SLACK_CHANNEL_ERROR_ID;
            }
        }
        return buttonSelector;
    }

    async getIndexOfBet(page, betName) {
        const listBetSelectorParent = 'div.verticalScroller_wrapper > div > div';
        // plusieurs appels necessaire pour load toute la page
        await this.scrollToSelector(page, listBetSelectorParent);
        await this.scrollToSelector(page, listBetSelectorParent);
        const childrenLenght = await this.getChildrenLenght(page, listBetSelectorParent);
        for (let index = 1; index < childrenLenght; index++) {
            const selectorTmp = this.listBetSelector + '(' + index + ') > div >  div.marketBox_head > h2';
            const betNameTmp = (await this.getTextFromSelector(page, selectorTmp)).trim();
            if (betName.toLowerCase().trim() === betNameTmp.toLowerCase()) {
                return index;
            }
        }
        return null;
    }

    async getIndexOfChoice(page, selector, choiceName) {
        let listChoiceSelectorParent = selector + ' > sports-markets-single-market-selections-group > div.marketBox_body.is-2col.ng-star-inserted';
        let childrenLenght = await this.getChildrenLenght(page, listChoiceSelectorParent);
        if(childrenLenght === 0) {
            listChoiceSelectorParent = selector + ' > sports-markets-single-market-selections-group > div.marketBox_body.is-spacious.ng-star-inserted';
            childrenLenght = await this.getChildrenLenght(page, listChoiceSelectorParent);
        }
        if(childrenLenght === 0) {
            listChoiceSelectorParent = selector + ' > sports-markets-single-market-selections-group > div';
            childrenLenght = await this.getChildrenLenght(page, listChoiceSelectorParent);
        }
        for (let index = 1; index <= childrenLenght; index++) {
            const selectorTmp = listChoiceSelectorParent + ' > div:nth-child(' + index + ')';
            const choiceNameTmp = (await this.getTextFromSelector(page, selectorTmp + ' > p')).trim();
            const realChoiceNameWithMatchNames = (await this.replaceMathBetName(page, choiceName)).toLowerCase();
            if (choiceNameTmp.toLowerCase() === realChoiceNameWithMatchNames) {
                return selectorTmp;
            }
        }
        return null;
    }

    async replaceMathBetName(page, choiceName) {
        const pageTitle = await page.title();
        const pageTitleSplitted = pageTitle.slice('Parier sur '.length).split(' | ');
        const matchNameArray = pageTitleSplitted[0].split(" - ");
        if(matchNameArray.length !== 2) {
            return choiceName;
        }
        choiceName = choiceName.replace("%1%", matchNameArray[0]);
        choiceName = choiceName.replace("%2%", matchNameArray[1]);
        return choiceName;
    }

    async logError(error) {
        this.slackCurrentChannel = process.env.SLACK_CHANNEL_ERROR_ID;
        this.addLog('==============================================================================');
        this.addLog(error);
        this.addLog('==============================================================================');

        try {
            const okButton = '#action';
            if (await page.$(okButton) !== null) {
                if (await page.waitForSelector(okButton, {timeout: 2000})) {
                    await this.selectorClick(page, okButton);
                    await this.timeout(2000);
                    this.addLog('==============================================================================');
                    this.addLog('Ok button found after error');
                    this.addLog('==============================================================================');
                }
            }
        } catch (e) {
            this.addLog('==============================================================================');
            this.addLog('button ok not found after logging error');
            this.addLog('==============================================================================');
        }
    }

    async getTextFromSelector(page, selector) {
        if (await this.selectorVisible(page, selector)) {
            await page.$eval(selector,
                e => {
                    e.scrollIntoView({behavior: 'smooth', block: 'end', inline: 'end'})
                });
            await this.timeout(300);
        }
        return await page.evaluate((selector) => {
            return $(selector).text();
        }, selector);
    }

    async clearPanier(page) {
        try {
            this.addLog("Nettoyage panier");
            const deletePanierButton = 'div.bettingslip_headerDelete > div > button';
            if (await this.selectorVisible(page, deletePanierButton)) {
                await this.selectorClick(page, deletePanierButton);
                const supprimerButton = '#mat-dialog-0 > bcdk-mandatory-action-dialog > div > div.buttonWrapper.modal_footer > button:nth-child(2)';
                if (await this.selectorVisible(page, supprimerButton)) {
                    await this.selectorClick(page, supprimerButton);
                }
            }
            this.addLog("Panier supprimé");
            await this.timeout(2000);
        } catch (e) {
            this.addLog('==============================================================================');
            this.addLog(e);
            this.addLog('==============================================================================');
        }
    }

    async login(page = null, returnUrl) {
        if (page === null) {
            page = await this.browser.newPage();
            await page.goto('https://www.betclic.fr/');
            await page.addScriptTag({path: 'lib/jquery-3.4.1.min.js'});
        }
        if (await this.isLogin(page)) {
            this.addLog('already logging');
            return page;
        }
        let previousUrl = page.url();
        let hasReturnUrl = false;
        this.addLog('not logging yet, go to login page');
        await this.timeout(1000);
        await this.deletePopUp(page);
        await page.goto('https://www.betclic.fr/connexion');
        await page.addScriptTag({path: 'lib/jquery-3.4.1.min.js'});
        await page.waitForSelector(this.loginForm, {visible: true});
        await this.selectorTypeValue(page, '#loginPage_username > input', process.env.LOGIN_USERNAME);
        await this.selectorTypeValue(page, '#loginpage_password > input', process.env.LOGIN_PASSWORD);
        await this.selectorTypeValue(page, '#date', process.env.LOGIN_DAY + process.env.LOGIN_MONTH + process.env.LOGIN_YEAR);
        await this.deletePopUp(page);
        await this.selectorClick(page, 'login-page > div > div > div.container_content > div.box > div.box_content > login-form > form > div.buttonWrapper > button');
        this.addLog('logging done !');
        await this.timeout(2000);
        try {
            const okButton = '#action';
            if (await page.$(okButton) !== null) {
                if (await page.waitForSelector(okButton, {timeout: 2000})) {
                    await this.selectorClick(page, okButton);
                    await this.timeout(2000);
                    this.addLog('Ok button found after login');
                    this.addLog('page going to ' + returnUrl);
                    hasReturnUrl = true;
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
                    this.addLog('Ok button found after login');
                }
            }
        } catch (e) {
            this.addLog('==============================================================================');
            this.addLog('button ok not found after logging error');
            this.addLog('==============================================================================');
        }
        if (hasReturnUrl === false) {
            await page.goto(previousUrl, {
                waitUntil: ['load', 'networkidle0', 'domcontentloaded', 'networkidle2'],
                // Remove the timeout
                timeout: 0
            });
            await page.addScriptTag({path: 'lib/jquery-3.4.1.min.js'});
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
                this.addLog("Pop up deleted");
                elements[i].parentNode.removeChild(elements[i]);
            }
        }, popUpSelector)
    }

    async selectorVisible(page, selector) {
        return await page.$(selector) != null;
    }

    async selectorClick(page, selector) {
        await page.$eval(selector,
            e => {
                e.scrollIntoView({behavior: 'smooth', block: 'end', inline: 'end'})
            });
        await page.$eval(selector, element => element.click());
        await this.timeout(500);
    }

    async selectorTypeValue(page, selector, value) {
        await this.deleteInputValue(page, selector);
        await page.type(selector, value.toString());
        await this.timeout(500);
    }

    async getChildrenLenght(page, selector) {
        await this.scrollToSelector(page, selector);
        return await page.evaluate((selector) => {
            if (document.querySelector(selector) === null) {
                return 0;
            }
            return (Array.from(document.querySelector(selector).children).length);
        }, selector);
    }

    async scrollToSelector(page, selector) {
        if (await this.selectorVisible(page, selector)) {
            await page.$eval(selector,
                e => {
                    e.scrollIntoView({behavior: 'smooth', block: 'end', inline: 'end'})
                });
            await this.timeout(300);
        }
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

    async startRecord(name, folders) {
        console.log('start recording ...');
        const mainFolder = this.videoFolder;
        let filePath = './' + mainFolder;
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath);
        }
        if (Array.isArray(folders)) {
            for (let folder of folders) {
                filePath += '/' + folder;
                if (!fs.existsSync(filePath)) {
                    fs.mkdirSync(filePath);
                }
            }
        }
        filePath = filePath + "/" + slugify(name) + ".avi";
        // https://unix.stackexchange.com/questions/14979/how-to-record-my-full-screen-with-audio
        exec("ffmpeg -f x11grab -s `xdpyinfo | grep -i dimensions: | sed 's/[^0-9]*pixels.*(.*).*//' | sed 's/[^0-9x]*//'` -r 25 -i " + process.env.DISPLAY + " -qscale 0 " + filePath, (err, stdout, stderr) => {
            if (err) {
                console.log(err);
            } else {
                console.log(stdout);
            }
        });
        this.slackCurrentVideoPath = filePath;
        await this.timeout(1000);
        return filePath;
    }

    async closeCookiePopUp(page) {
        try {
            await page.waitForSelector('#popin_tc_privacy_button_2', {
                timeout: 2000
            });
            await page.click('#popin_tc_privacy_button_2');
        } catch (e) {
            // nothing
        }
    }

    deleteOldVideos(maxDaysToKeep) {
        const availableDates = [];
        for (let i = 0; i <= maxDaysToKeep; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            availableDates.push(this.convertDateToFolderName(date));
        }
        const mainFolder = './' + this.videoFolder;
        const allFolders = readdirSync(mainFolder, {withFileTypes: true})
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        for (let folder of allFolders) {
            if (!availableDates.includes(folder)) {
                fs.rmdirSync(mainFolder + '/' + folder, {recursive: true});
            }
        }
    }

    async stopAllRecord() {
        console.log('stop recording');
        exec('pkill -f ffmp');
        await this.timeout(1000);
    }
}

module.exports = App;
