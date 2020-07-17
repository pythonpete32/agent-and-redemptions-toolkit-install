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
const dao = '0x2C4f3fa8Da1843EEaa1e56Eba505b5aA335fb5EA';
const acl = '0xfecab8b3885d7b17bc2f7c09b4b5080ba5fd6357';
const tokenManager = '0xc68be21fc6f9cd41ea97e74e8845edea520f39c4';
const voting = '0x395e1eb7285e786a18d63ada9aeef9dfacb3e2cd';
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
const redemptionsInitSignature = 'initialize(address,address,address[])';
const agentInitSignature = 'initialize(TBD, TBD, TBD)'; // HOW/WHERE DO WE GET THiS INFO?

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

// first tx
async function firstTx() {
    // counterfactual addresses
    const nonce1 = await buildNonceForAddress(dao, 1, provider);
    const newAddress1 = await calculateNewProxyAddress(dao, nonce1);
    agent = newAddress1;

    const nonce2 = await buildNonceForAddress(dao, 0, provider);
    const newAddress2 = await calculateNewProxyAddress(dao, nonce2);
    redemptions = newAddress2;

    // app initialisation payloads
    const agentInitPayload = await encodeActCall(agentInitSignature, [
        TBD,
        TBD,
        TBD
    ])
    const redemptionsInitPayload = await encodeActCall(redemptionsInitSignature, [
        agent,
        tokenManager,
        [ETH_ADDRESS]
    ]);

    // package first transaction
    const calldatum = await Promise.all([
        // Agent Stuff
        encodeActCall(newAppInstanceSignature, [
            agentAppId,
            agentBase,
            agentInitPayload,
            true,
        ]),
        encodeActCall(createPermissionSignature, [
            redemptions,
            keccak256('TRANSFER_ROLE'),
            voting,
        ])

        // Redemptions Stuff
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
            agent,
            keccak256('TRANSFER_ROLE'),
        ]),
        encodeActCall(grantPermissionSignature, [
            redemptions,
            tokenManager,
            keccak256('BURN_ROLE'),
        ])
    ]);

    const actions = [
        {
            to: dao,
            calldata: calldatum[0],
        },
        {
            to: dao,
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
        {
            to: acl,
            calldata: calldatum[5],
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
            installing agent and redemptions
            `,
        ],
        () => {},
        env,
    );
}

const main = async () => {
    console.log('Generating vote');
    await firstTx();
};

main()
    .then(() => {
        console.log('Script finished.');
        process.exit();
    })
    .catch((e) => {
        console.error(e);
        process.exit();
    });
