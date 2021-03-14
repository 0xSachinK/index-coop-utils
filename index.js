const Web3 = require('web3')
const fetch = require('node-fetch')

const tradeModuleABI = require('./abi/tradeModule.json')
const erc20ABI = require('./abi/erc20.json')

// alchemy provides historical data
const alchemyURL = 'PASTE-YOUR-ALCHEMY-PROJECT-HTTP-URL-HERE'
const web3 = new Web3(new Web3.providers.HttpProvider(alchemyURL))

const baseCurrency = 'usd'  // can change to 'eth'/'btc'/'dpi' etc
const totalValuePerMonth = {'10': 0, '11': 0, '12': 0, '01': 0, '02': 0, '03': 0}

const creationBlock = '10973539'
const tradeModule = new web3.eth.Contract(
    tradeModuleABI,
    '0x90F765F63E7DC5aE97d6c576BF693FB6AF41C129'
)

const tokenId = {}
const tokenDecimals = {}

const getTokenDecimals = async (address) => {
    if(!tokenDecimals[address]) {
        const tokenContract = new web3.eth.Contract(erc20ABI.abi, address)
        const decimals = await tokenContract.methods.decimals().call()
        tokenDecimals[address] = decimals
    }
    return tokenDecimals[address]
}

const getTokenId = async (address) => {
    if (!tokenId[address]) {
        const url = `https://api.coingecko.com/api/v3/coins/ethereum/contract/${address}`
        let response = await fetch(url)
        response = await response.json()
        tokenId[address] = response.id
    }
    return tokenId[address];
}

const getHistoricalPrice = async (tokenAddress, dateString) => {
    const id = await getTokenId(tokenAddress)
    const url = `https://api.coingecko.com/api/v3/coins/${id}/history?date=${dateString}&localization=false`
    let response = await fetch(url)
    response = await response.json()
    return response.market_data.current_price[baseCurrency]
}

const getTotalValue = async (address, price, amount) => {
    const decimals = await getTokenDecimals(address)
    const value = (Number(amount) / 10 ** decimals) * price;
    // console.log(address, Number(amount) / 10 ** decimals, price)
    return value;
}


const analyzePast = async (fromBlock) => {
    const events = await tradeModule.getPastEvents('ComponentExchanged', { fromBlock });

    for(_event of events) {
        const sendToken = _event.returnValues._sendToken;
        const totalSendAmount = _event.returnValues._totalSendAmount;
        const block = await web3.eth.getBlock(_event.blockNumber);

        const date = new Date(block.timestamp*1000) // converts seconds to miliseconds
        const [year, month, _date] = date.toISOString().split('T')[0].split('-')
        const dateString = `${_date}-${month}-${year}`
        
        const price = await getHistoricalPrice(sendToken, dateString)
        const value = await getTotalValue(sendToken, price, totalSendAmount);
        
        totalValuePerMonth[month] += value;
        console.log(month, totalValuePerMonth[month])
    }
}

analyzePast(creationBlock)
.then(() => {
    for(month in totalValuePerMonth) {
        totalValuePerMonth[month] = Math.round(totalValuePerMonth[month] * 1000) / 1000 
    }
    console.log(totalValuePerMonth) 
})