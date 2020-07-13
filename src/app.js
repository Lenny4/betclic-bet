class App {
    constructor(browser) {
        this.bets = [];
        this.isBetting = false;
        this.browser = browser;
    }

    async addBets(matchs) {
        for (let match of matchs) {
            this.bets.push({
                betCode: match.betCode,
                betName: match.betName,
                choiceName: match.choiceName,
                choiceOdd: match.choiceOdd,
                matchId: match.matchId,
                matchName: match.matchName,
            });
        }
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
        const bet = this.bets[0];
        const page = await this.browser.newPage();
        await page.addScriptTag({url: 'https://code.jquery.com/jquery-3.4.1.min.js'});
        await page.goto('https://www.betclic.fr/' + bet.matchName + '-m' + bet.matchId);
        await this.login(page);
    }

    async login(page = null) {
        if (page === null) {
            page = await this.browser.newPage();
            await page.addScriptTag({url: 'https://code.jquery.com/jquery-3.4.1.min.js'});
            await page.goto('https://www.betclic.fr/');
        }
        if (await this.isLogin(page, false)) {
            return true;
        }
        await page.evaluate(async (username, password, date, month, year) => {
                $('#login-username').val(username);
                $('#login-password').val(password);
                $('#login-submit')[0].click();
                const checkExist = setInterval(() => {
                    const formEl = $('#RecapForm');
                    if ($(formEl).length === 1 && $(formEl).is(":visible")) {
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
        await page.goto('about:blank');
        await page.close();
        return true;
    }

    /**
     * @param page: need to be on a betclic page with jquery injected
     * @param reloadPage
     * @returns {Promise<boolean>}
     */
    async isLogin(page, reloadPage = true) {
        if (reloadPage) {
            await page.reload({waitUntil: ["networkidle0", "domcontentloaded"]});
        }
        return await page.evaluate(() => {
            const formEl = $('#loginForm');
            return !($(formEl).length === 1 && $(formEl).is(":visible"));
        });
    }
}

module.exports = App;