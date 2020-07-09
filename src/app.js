class App {
    constructor(browser) {
        this.bets = [];
        this.browser = browser;
    }

    async login() {
        const page = await this.browser.newPage();
        await page.addScriptTag({url: 'https://code.jquery.com/jquery-3.4.1.min.js'});
        await page.goto(`https://www.betclic.fr/`);
        await page.evaluate(async (username, password) => {
            $('#login-username').val(username);
            $('#login-password').val(password);
            $('#login-submit')[0].click();
        }, process.env.USERNAME, process.env.PASSWORD);
        // await page.goto('about:blank');
        // await page.close();
    }

    async checkLogin() {

    }
}

module.exports = App;