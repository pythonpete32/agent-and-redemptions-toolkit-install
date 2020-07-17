const { TokenManager } = require("@aragon/connect-thegraph-tokens");
const { connect } = require('@aragon/connect')
const { ethers } = require("ethers")

const ACCOUNT = '0x75B98710D5995AB9992F02492B7568b43133161D'
const MINT_TOKENS = '0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686'



async function main() {
    const org = await connect('x.aragonid.eth', 'thegraph')

    // get apps
    const apps = await org.apps()
    const acl = await org.app('acl')
    const finance = await org.app('finance')

    // get token managers & intents
    const intents = apps
        .filter(app => {
            app.name === 'token-manager' ? console.log(`address: ${app.address}`) : null
            return app.name === 'token-manager'
        })
        .map(tm => {
            return org.appIntent(acl.address, 'grantPermission', [
                ACCOUNT,
                tm.address,
                MINT_TOKENS,
            ])
        })

    const mintIntent = org.appIntent(finance.address, 'newImmediatePayment', [
        ethers.constants.AddressZero,
        ACCOUNT,
        ethers.utils.parseEther('1'),
        'Tests Payment',
      ])

    console.log(JSON.stringify(mintIntent, null, 2))
    // console.log(`intents:\n ${JSON.stringify(intents, null, 2)}`)

    //const txPath = await intents[0].paths(ACCOUNT)
    const txPath = await mintIntent.paths(ACCOUNT)
    

    // check transaction path intent
    let path
    console.log(`\n--------------------------------------------------------\ntx path for ${ACCOUNT} create payment\n--------------------------------------------------------\n`)
    txPath.apps.map((app) => {
        console.log(`${app.name}: ${app.address}`)
    })
}


main()
  .then(() => process.exit(0))
  .catch(err => {
    console.log(`Error: `, err);
    console.log(
      "\nPlease report any problem to https://github.com/aragon/connect/issues"
    );
    process.exit(1);
});