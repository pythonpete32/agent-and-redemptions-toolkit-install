const {encodeCallScript} = require('@aragon/test-helpers/evmScript');
const {encodeActCall, execAppMethod} = require('mathew-aragon-toolkit');
const ethers = require('ethers');
const utils = require('ethers/utils');
const {keccak256} = require('web3-utils');

const {RLP} = utils;
const provider = ethers.getDefaultProvider('rinkeby');
const BN = utils.bigNumberify;
const env = 'rinkeby';


// DAO addresses
const dao = '';
const acl = '';
const tokenManager = '';
const voting = '';
const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';
const ANY_ADDRESS = '0xffffffffffffffffffffffffffffffffffffffff';


// new apps
const agentAppId = '0x9ac98dc5f995bf0211ed589ef022719d1487e5cb2bab505676f0d084c07cf89a';
const agentBase = '0xd3bbC93Dbc98128fAC514Be911e285102B931b5e';
let agent;

const redemptionsAppId = '0x743bd419d5c9061290b181b19e114f36e9cc9ddb42b4e54fc811edb22eb85e9d';
const redemptionsBase = '0xe47d2A5D3319E30D1078DB181966707d8a58dE98';
let redemptions;


// signatures
const newAppInstanceSignature = 'newAppInstance(bytes32,address,bytes,bool)';
const createPermissionSignature = 'createPermission(address,address,bytes32,address)';
const grantPermissionSignature = 'grantPermission(address,address,bytes32)'; 
const redemptionsInitSignature = 'initialize(address,address,address[])'; // find in `Redemptions.sol`
const agentInitSignature = 'initialize()'; 


// functions for counterfactual addresses
async function buildNonceForAddress(_address, _index, _provider) {
    const txCount = await _provider.getTransactionCount(_address);
    return `0x${(txCount + _index).toString(16)}`;
}

async function calculateNewProxyAddress(_daoAddress, _nonce) {
    const rlpEncoded = RLP.encode([_daoAddress, _nonce]);
    const contractAddressLong = keccak256(rlpEncoded);
    const contractAddress = `0x${contractAddressLong.substr(-40)}`;

    return contractAddress;
}


async function tx1() {
    // counterfactual addresses
    const nonce1 = await buildNonceForAddress(dao, 0, provider);
    agent = await calculateNewProxyAddress(dao, nonce1);
  

    // app initialisation payloads
    const agentInitPayload = await encodeActCall(agentInitSignature, [])


    // package first tx1
    const calldatum = await Promise.all([
        // Agent Stuff
        encodeActCall(newAppInstanceSignature, [
            agentAppId,
            agentBase,
            agentInitPayload,
            true,
        ]),
        encodeActCall(createPermissionSignature, [
            voting,
            agent,
            keccak256('TRANSFER_ROLE'),
            voting,
        ])
    ]);

    const actions = [
        {
            to: dao,
            calldata: calldatum[0],
        },
        {
            to: acl,
            calldata: calldatum[1],
        }
    ];

    const script = encodeCallScript(actions);

    await execAppMethod(
        dao,
        voting,
        'newVote',
        [
            script,
            `
            installing agent
            `,
        ],
        () => {},
        env,
    );
}

async function tx2() {
    const nonce2 = await buildNonceForAddress(dao, 1, provider);
    redemptions = await calculateNewProxyAddress(dao, nonce2);

    const redemptionsInitPayload = await encodeActCall(redemptionsInitSignature, [
        agent,
        tokenManager,
        [ETH_ADDRESS]
    ]);

    const calldatum = await Promise.all([
        encodeActCall(newAppInstanceSignature, [
            redemptionsAppId,
            redemptionsBase,
            redemptionsInitPayload,
            true,
        ]),
        encodeActCall(createPermissionSignature, [
            ANY_ADDRESS,
            redemptions,
            keccak256('REDEEM_ROLE'),
            voting,
        ]),
        encodeActCall(createPermissionSignature, [
            voting,
            redemptions,
            keccak256('ADD_TOKEN_ROLE'),
            voting,
        ]),
        encodeActCall(createPermissionSignature, [
            voting,
            redemptions,
            keccak256('REMOVE_TOKEN_ROLE'),
            voting,
        ]),
        encodeActCall(grantPermissionSignature, [
            redemptions,
            tokenManager,
            keccak256('BURN_ROLE'),
        ])
    ])

    const actions = [
        {
            to: dao,
            calldata: calldatum[0],
        },
        {
            to: acl,
            calldata: calldatum[1],
        },
        {
            to: acl,
            calldata: calldatum[2],
        },
        {
            to: acl,
            calldata: calldatum[3],
        },
        {
            to: acl,
            calldata: calldatum[4],
        },
    ];

    const script = encodeCallScript(actions);

    await execAppMethod(
        dao,
        voting,
        'newVote',
        [
            script,
            `
            installing redemptions
            `,
        ],
        () => {},
        env,
    );

}

const main = async () => {
    console.log('Installing Agent');
    await tx1()
    console.log('Installing Redemptions');
    await tx2()
    console.log('\n--------------------------------------------------------------------------------------------------------------------------')
    console.log(`Vote at http://rinkeby.aragon.org/#/${dao}/${voting}`)
    console.log('Ensure you wait for the first transaction has passed before voting on the second')
    console.log('--------------------------------------------------------------------------------------------------------------------------')


};

main()
    .then(() => {
        process.exit();
    })
    .catch((e) => {
        console.error(e);
        process.exit();
    });
