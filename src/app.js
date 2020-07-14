class App {
    constructor(browser) {
        this.bets = [];
        this.doublons = [];
        this.isBetting = false;
        this.browser = browser;
        this.inputBet = '#bets-container div.betDetails div.wrap-stake-value input.stake-value';
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
        await page.addScriptTag({url: 'https://code.jquery.com/jquery-3.4.1.min.js'});
        await page.goto('https://www.betclic.fr/' + '-m' + bet.matchId);
        page = await this.login(page);
        const canBet = await page.evaluate(async (bet, inputBetSelector) => {
            return new Promise((resolve) => {
                const marketEl = $('#market_marketTypeCode_' + bet.betCode);
                let oddButton = null;
                const firstTrTable = $(marketEl).find('table tr:first');
                if (bet.choiceName === '%1%') {
                    oddButton = $(firstTrTable).find('td:nth-child(1) .odd-button');
                } else if (bet.choiceName === '%2%') {
                    oddButton = $(firstTrTable).find('td:nth-child(3) .odd-button');
                } else if (bet.choiceName === 'nul') {
                    oddButton = $(firstTrTable).find('td:nth-child(2) .odd-button');
                }
                if (oddButton !== null && $(oddButton).length === 1) {
                    $(oddButton)[0].click();
                    const checkExist = setInterval(() => {
                        const inputBet = $(inputBetSelector);
                        if ($(inputBet).length === 1 && $(inputBet).is(':visible')) {
                            clearInterval(checkExist);
                            resolve(oddButton !== null);
                        }
                    }, 100);
                } else {
                    resolve(false);
                }
            });
        }, bet, this.inputBet);
        if (canBet) {
            await page.type(this.inputBet, process.env.AMOUNT_BET);
            const betIsSuccess = await page.evaluate(async () => {
                return new Promise((resolve) => {
                    const checkExist = setInterval(() => {
                        const placeBetButton = $('#PlaceBet');
                        if ($(placeBetButton).length === 1 && $(placeBetButton).is(':visible') && $(placeBetButton).is(':not(:disabled)')) {
                            clearInterval(checkExist);
                            $(placeBetButton)[0].click();
                            let nbCheckBetPlaced = 0;
                            const betPlaced = setInterval(() => {
                                const betAgainButton = $('#bet-again');
                                if ($(betAgainButton).length === 1 && $(betAgainButton).is(':visible') && $(betAgainButton).is(':not(:disabled)')) {
                                    clearInterval(betPlaced);
                                    resolve(true);
                                } else if (nbCheckBetPlaced >= 50) {
                                    clearInterval(betPlaced);
                                    resolve(false);
                                } else {
                                    nbCheckBetPlaced++;
                                }
                            }, 100);
                        }
                    }, 100);
                })
            });
            if (betIsSuccess) {
                console.log('bet placed', bet);
                this.bets.splice(0, 1);
            } else {
                await page.screenshot({path: bet.matchId + '-' + now + '.png'});
                console.log('can\'t place bet', bet);
                bet.try = bet.try + 1;
                if (bet.try <= process.env.RETRY_ERROR_BET) {
                    console.log('wait 5s and bet again ... ');
                    await this.timeout(5000);
                } else {
                    console.log('max try for bet ', bet);
                    this.bets.splice(0, 1);
                }
            }
            await this.clearPanier(page);
            await page.goto('about:blank');
            await page.close();
            this.bet();
        } else {
            console.log('can\'t bet on ' + 'https://www.betclic.fr/' + '-m' + bet.matchId);
            await this.clearPanier(page);
            this.bets.splice(0, 1);
            await page.goto('about:blank');
            await page.close();
            this.bet();
        }
    }

    async clearPanier(page) {
        return await page.evaluate(async () => {
            return new Promise((resolve) => {
                $('#bs-empty-all')[0].click();
                setTimeout(() => {
                    resolve(true);
                }, 5000);
            });
        });
    }

    async login(page = null) {
        if (page === null) {
            page = await this.browser.newPage();
            await page.addScriptTag({url: 'https://code.jquery.com/jquery-3.4.1.min.js'});
            await page.goto('https://www.betclic.fr/');
        }
        if (await this.isLogin(page, false)) {
            console.log('already logging');
            return page;
        }
        console.log('is logging ...');
        await page.evaluate(async (username, password, date, month, year) => {
                $('#login-username').val(username);
                $('#login-password').val(password);
                $('#login-submit')[0].click();
                const checkExist = setInterval(() => {
                    const formEl = $('#RecapForm');
                    if ($(formEl).length === 1 && $(formEl).is(':visible')) {
                        clearInterval(checkExist);
                        $(formEl).find('#CustBirthDate_Day').val(date);
                        $(formEl).find('#CustBirthDate_Month').val(month);
                        $(formEl).find('#CustBirthDate_Year').val(year);
                        $(formEl).find('#submitRecap')[0].click();
                    }
                }, 100);
            },
            process.env.LOGIN_USERNAME,
            process.env.LOGIN_PASSWORD,
            process.env.LOGIN_DAY,
            process.env.LOGIN_MONTH,
            process.env.LOGIN_YEAR,
        );
        await page.waitForNavigation();
        return page;
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
        return await page.evaluate(() => {
            const formEl = $('#loginForm');
            return !($(formEl).length === 1 && $(formEl).is(':visible'));
        });
    }

    async timeout(time) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, time);
        })
    }
}

module.exports = App;