import { CollectionEntity, Emote, FailedEntity, NFTEntity, RemarkEntity } from "../types";
import { SubstrateExtrinsic } from "@subql/types";
import { getRemarksFrom, RemarkResult } from './utils';
import { Collection, eventFrom, getNftId, NFT, RmrkEvent, RmrkInteraction } from './utils/types';
import NFTUtils, { hexToString } from './utils/NftUtils';
import { canOrElseError, exists, hasMeta, isBurned, isBuyLegalOrElseError, isOwnerOrElseError, isPositiveOrElseError, isTransferable, validateInteraction } from './utils/consolidator'
import { randomBytes } from 'crypto'
import { emoteId, ensureInteraction } from './utils/helper';

async function mint(remark: RemarkResult) {
  let collection = null
  try {
    collection = NFTUtils.unwrap(remark.value) as Collection
    canOrElseError<string>(exists, collection.id, true)
    const entity = await CollectionEntity.get(collection.id)
    canOrElseError<CollectionEntity>(exists, entity)
    const final = CollectionEntity.create(collection)

    final.name = collection.name.trim()
    final.max = Number(collection.max)
    final.issuer = remark.caller
    final.currentOwner = remark.caller
    final.symbol = collection.symbol.trim()
    final.blockNumber = BigInt(remark.blockNumber)
    final.metadata = collection.metadata
    final.events = [eventFrom(RmrkEvent.MINT, remark, '')]

    logger.info(`SAVED [COLLECTION] ${final.id}`)
    await final.save()
  } catch (e) {
    logger.error(`[COLLECTION] ${e.message}, ${JSON.stringify(collection)}`)
    await logFail(JSON.stringify(collection), e.message, RmrkEvent.MINT)
  }

}

async function mintNFT(remark: RemarkResult) {
  let nft = null
  try {
    nft = NFTUtils.unwrap(remark.value) as NFT
    canOrElseError<string>(exists, nft.collection, true)
    const collection = await CollectionEntity.get(nft.collection)
    canOrElseError<CollectionEntity>(exists, collection, true)
    isOwnerOrElseError(collection, remark.caller)
    nft.id = getNftId(nft, remark.blockNumber);
    const final = new NFTEntity(getNftId(nft, remark.blockNumber));

    final.id = getNftId(nft, remark.blockNumber)
    final.issuer = remark.caller
    final.currentOwner = remark.caller
    final.blockNumber = BigInt(remark.blockNumber)
    final.name = nft.name
    final.instance = nft.instance
    final.transferable = nft.transferable
    final.collectionId = nft.collection
    final.sn = nft.sn
    final.metadata = nft.metadata
    final.price = BigInt(0)
    final.burned = false
    final.events = [eventFrom(RmrkEvent.MINTNFT, remark, '')]

    logger.info(`SAVED [MINT] ${final.id}`)
    await final.save()
  } catch (e) {
    logger.error(`[MINT] ${e.message} ${JSON.stringify(nft)}`)
    await logFail(JSON.stringify(nft), e.message, RmrkEvent.MINTNFT)
  }
}

async function send(remark: RemarkResult) {
  let interaction = null

  try {
    interaction = ensureInteraction(NFTUtils.unwrap(remark.value) as RmrkInteraction)
    const nft = await NFTEntity.get(interaction.id)
    validateInteraction(nft, interaction)
    isOwnerOrElseError(nft, remark.caller)
    // isAccountValidOrElseError(interaction.metadata)

    nft.currentOwner = interaction.metadata
    nft.price = BigInt(0)
    nft.events.push(eventFrom(RmrkEvent.SEND, remark, interaction.metadata))
    await nft.save()

  } catch (e) {
    logger.warn(`[SEND] ${e.message} ${JSON.stringify(interaction)}`)
    await logFail(JSON.stringify(interaction), e.message, RmrkEvent.SEND)
  }
}

async function buy(remark: RemarkResult) {
  let interaction = null

  try {
    interaction = ensureInteraction(NFTUtils.unwrap(remark.value) as RmrkInteraction)
    const nft = await NFTEntity.get(interaction.id)
    canOrElseError<NFTEntity>(exists, nft, true)
    canOrElseError<NFTEntity>(isBurned, nft)
    canOrElseError<NFTEntity>(isTransferable, nft, true)
    isPositiveOrElseError(nft.price, true)
    isBuyLegalOrElseError(nft, remark.extra || [])
    nft.currentOwner = remark.caller
    nft.price = BigInt(0)
    nft.events.push(eventFrom(RmrkEvent.BUY, remark, remark.caller))
    await nft.save();

  } catch (e) {
    logger.warn(`[BUY] ${e.message} ${JSON.stringify(interaction)}`)
    await logFail(JSON.stringify(interaction), e.message, RmrkEvent.BUY)
  }
  // exists
  // not burned
  // transferable
  // has meta
  // enough money ?
}

async function consume(remark: RemarkResult) {
  let interaction = null

  try {
    interaction = ensureInteraction(NFTUtils.unwrap(remark.value) as RmrkInteraction)
    const nft = await NFTEntity.get(interaction.id)
    canOrElseError<NFTEntity>(exists, nft, true)
    canOrElseError<NFTEntity>(isBurned, nft)
    isOwnerOrElseError(nft, remark.caller)
    nft.price = BigInt(0)
    nft.burned = true;
    nft.events.push(eventFrom(RmrkEvent.CONSUME, remark, ''))
    await nft.save();

  } catch (e) {
    logger.warn(`[CONSUME] ${e.message} ${JSON.stringify(interaction)}`)
    await logFail(JSON.stringify(interaction), e.message, RmrkEvent.CONSUME)
  }
}

async function list(remark: RemarkResult) {
  let interaction = null

  try {
    interaction = ensureInteraction(NFTUtils.unwrap(remark.value) as RmrkInteraction)
    const nft = await NFTEntity.get(interaction.id)
    validateInteraction(nft, interaction)
    isOwnerOrElseError(nft, remark.caller)
    const price = BigInt(interaction.metadata)
    isPositiveOrElseError(price)
    nft.price = price
    nft.events.push(eventFrom(RmrkEvent.LIST, remark, interaction.metadata))
    await nft.save();

  } catch (e) {

    logger.warn(`[LIST] ${e.message} ${JSON.stringify(interaction)}`)
    await logFail(JSON.stringify(interaction), e.message, RmrkEvent.LIST)
  }
  // exists
  // not burned
  // transferable
  // has meta
  // is owner
}

async function changeIssuer(remark: RemarkResult) {
  let interaction = null

  try {
    interaction = ensureInteraction(NFTUtils.unwrap(remark.value) as RmrkInteraction)
    canOrElseError<RmrkInteraction>(hasMeta, interaction, true)
    const collection = await CollectionEntity.get(interaction.id)
    canOrElseError<CollectionEntity>(exists, collection, true)
    isOwnerOrElseError(collection, remark.caller)
    collection.currentOwner = interaction.metadata
    collection.events.push(eventFrom(RmrkEvent.CHANGEISSUER, remark, interaction.metadata))
    await collection.save();
  } catch (e) {
    logger.warn(`[CHANGEISSUER] ${e.message} ${JSON.stringify(interaction)}`)
    await logFail(JSON.stringify(interaction), e.message, RmrkEvent.CHANGEISSUER)
  }


}

async function emote(remark: RemarkResult) {
  let interaction = null

  try {
    interaction = ensureInteraction(NFTUtils.unwrap(remark.value) as RmrkInteraction)
    canOrElseError<RmrkInteraction>(hasMeta, interaction, true)
    const nft = await NFTEntity.get(interaction.id)
    canOrElseError<NFTEntity>(exists, nft, true)
    canOrElseError<NFTEntity>(isBurned, nft)
    const id = emoteId(interaction, remark.caller)
    let emote = await Emote.get(id)

    if (exists(emote)) {
      await Emote.remove(emote.id)
      return;
    }

    emote = Emote.create({
      id,
      nftId: interaction.id,
      caller: remark.caller,
      value: interaction.metadata
    })

    await emote.save();

  } catch (e) {
    logger.warn(`[EMOTE] ${e.message}`)
    await logFail(JSON.stringify(interaction), e.message, RmrkEvent.EMOTE)
  }

  // exists
  // not burned
  // transferable
  // has meta
}

async function logFail(message: string, reason: string, interaction: RmrkEvent) {
  try {
    const fail = {
      id: randomBytes(20).toString('hex'),
      value: message,
      reason,
      interaction
    }

    const entity = FailedEntity.create(fail)
    await entity.save()

  } catch (e) {
    logger.warn(`[FAIL IN FAIL] ${interaction}::${message}`)
  }
}


export async function handleCall(extrinsic: SubstrateExtrinsic): Promise<void> {
  const records = getRemarksFrom(extrinsic)
    .map((r, i) => {
      try {
        return { ...r, id: `${r.blockNumber}-${i}`, interaction: NFTUtils.getAction(hexToString(r.value)) }
      } catch (e) {
        return { ...r, id: `${r.blockNumber}-${i}`, interaction: hexToString(r.value) }
      }
    })
    .map(RemarkEntity.create);

  for (const record of records) {
    try {
      await record.save()
    } catch (e) {
      logger.warn(`[ERR] Can't save RMRK at block ${record.blockNumber} because \n${e}`)
    }

  }
}



export async function handleRemark(extrinsic: SubstrateExtrinsic): Promise<void> {
  const records = getRemarksFrom(extrinsic)

  for (const remark of records) {
    try {
      const decoded = hexToString(remark.value)
      const event: RmrkEvent = NFTUtils.getAction(decoded)

      switch (event) {
        case RmrkEvent.MINT:
          await mint(remark)
          break;
        case RmrkEvent.MINTNFT:
          await mintNFT(remark)
          break;
        case RmrkEvent.SEND:
          await send(remark)
          break;
        case RmrkEvent.BUY:
          await buy(remark)
          break;
        case RmrkEvent.CONSUME:
          await consume(remark)
          break;
        case RmrkEvent.LIST:
          await list(remark)
          break;
        case RmrkEvent.CHANGEISSUER:
          await changeIssuer(remark)
          break;
        case RmrkEvent.EMOTE:
          await emote(remark)
          break;
        default:
          logger.warn(`[SKIP] ${event}::${remark.value}::${remark.blockNumber}`)
        // throw new EvalError(`Unable to evaluate following string, ${event}::${remark.value}`)
      }
    } catch (e) {
      logger.error(`[MALFORMED] ${remark.blockNumber}::${hexToString(remark.value)}`)
    }

  }
}
