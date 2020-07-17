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
const agent = '0x970708b722b75c9ffa6a3817f51b27eb033b9d1c';
const tokenManager = '0xc68be21fc6f9cd41ea97e74e8845edea520f39c4';
const voting = '0x395e1eb7285e786a18d63ada9aeef9dfacb3e2cd';
const daoShopToken = '0x20431b540f52237e857e6b0a9e5d07b33c3dea8c';
const ANY_ADDRESS = '0xffffffffffffffffffffffffffffffffffffffff';



// new apps
const redemptionsAppId = '0x743bd419d5c9061290b181b19e114f36e9cc9ddb42b4e54fc811edb22eb85e9d';
const redemptionsBase = '0xe47d2A5D3319E30D1078DB181966707d8a58dE98';

let redemptions;


// signatures
const newAppInstanceSignature = 'newAppInstance(bytes32,address,bytes,bool)';
const createPermissionSignature = 'createPermission(address,address,bytes32,address)';
const grantPermissionSignature = 'grantPermission(address,address,bytes32)';
const redemptionsInitSignature = 'initialize(address,address,address[])';

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

async function firstTx() {
    // counterfactual addresses
    const nonce1 = await buildNonceForAddress(dao, 0, provider);
    const newAddress1 = await calculateNewProxyAddress(dao, nonce1);
    redemptions = newAddress1;


    // app initialisation payloads
    const redemptionsInitPayload = await encodeActCall(redemptionsInitSignature, [
        agent,
        tokenManager,
        [daoShopToken]
    ]);

    // package first transaction
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
            this is something
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
