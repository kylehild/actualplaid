const { getAppConfigFromEnv } = require("./config");
const actual = require("@actual-app/api");
const fs = require("fs");
const inquirer = require("inquirer");

const appConfig = getAppConfigFromEnv();

/**
 * 
 * @returns {Promise<typeof actual>}
 */
async function initialize(config) {
    try {
        const tmp_dir = `./temp_data_actual/${config.get("user")}`
        fs.mkdirSync(tmp_dir, { recursive: true });
        await actual.init({
            serverURL: appConfig.ACTUAL_SERVER_URL,
            password: appConfig.ACTUAL_SERVER_PASSWORD,
            dataDir: tmp_dir
        });

        let id = config.get("budget_id")
        if (!id) {
            id = (await inquirer.prompt({
                name: "budget_id",
                message: `This is your (${config.get('user')}) first time using this user, what is your budget id? (Can be found is advanced settings on Actual as the 'sync-id')`,
            })).budget_id
            config.set("budget_id", id)
        }

        await actual.downloadBudget(id);
    } catch (e) {
        throw new Error(`Actual Budget Error: ${e.message}`);
    }

    return actual;
}

/**
 * 
 * @param {typeof actual} actualInstance 
 */
function listAccounts(actualInstance) {
    return actualInstance.getAccounts();
}

/**
 * Only works for the past month
 * @param {typeof actual} actualInstance 
 * @param {*} accountId 
 */
function getLastTransactionDate(actualInstance, accountId) {
    const account = actualInstance.getAccount(accountId);

    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);


    const transactions = actualInstance.getTransactions(accountId, monthAgo, new Date(),);
    const last = transactions[account.transactions.length - 1];

    return last.date;
}


const transactionMapper = (accountId) => (transaction) => ({
    account: accountId,
    date: transaction.date,
    amount: -transaction.amount * 100,
    payee_name: transaction.merchant_name || transaction.name,
    imported_payee: transaction.merchant_name || transaction.name,
    notes: transaction.name,
    imported_id: transaction.transaction_id,
});


async function importPlaidTransactions(actualInstance, accountId, transactions) {
    const mapped = transactions
        .map(transactionMapper(accountId))

    const actualResult = await actualInstance.importTransactions(
        accountId,
        mapped
    );
    console.log("Actual logs: ", actualResult);
}

/**
 * 
 * @param {typeof actual} actualInstance 
 */
async function finalize(actualInstance) {
    await actualInstance.sync()
    await actualInstance.shutdown();
}

module.exports = {
    initialize,
    listAccounts,
    getLastTransactionDate,
    importPlaidTransactions,
    transactionMapper,
    finalize
}