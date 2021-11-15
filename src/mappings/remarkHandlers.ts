import {SubstrateExtrinsic,SubstrateEvent,SubstrateBlock} from "@subql/types";
import {Balance} from "@polkadot/types/interfaces";
import { Call as TCall } from "@polkadot/types/interfaces";
// import { RemarkEntity } from '../types/models/RemarkEntity';
import {RemarkEntity} from "../types";
import { getRemarksFrom } from './utils/extract'


// export async function handleBlock(block: SubstrateBlock): Promise<void> {
//     //Create a new RemarkEntity with ID using block hash
//     let record = new RemarkEntity(block.block.header.hash.toString());
//     //Record block number
//     record.field1 = block.block.header.number.toNumber();
//     await record.save();
// }

// export async function handleEvent(event: SubstrateEvent): Promise<void> {
//     const {event: {data: [account, balance]}} = event;
//     //Retrieve the record by its ID
//     const record = await RemarkEntity.get(event.extrinsic.block.block.header.hash.toString());
//     record.field2 = account.toString();
//     //Big integer type Balance of a transfer event
//     record.field3 = (balance as Balance).toBigInt();
//     await record.save();
// }

// export async function handleCall(extrinsic: SubstrateExtrinsic): Promise<void> {
//     const record = await RemarkEntity.get(extrinsic.block.block.header.hash.toString());
//     //Date type timestamp
//     record.field4 = extrinsic.block.timestamp;
//     //Boolean tyep
//     record.field5 = true;
//     await record.save();
// }

export async function handleRemark(extrinsic: SubstrateExtrinsic): Promise<void> {
    const records = getRemarksFrom(extrinsic)
    .map((r, i) => ({...r, id: `${r.blockNumber}-${i}` }))
    .map(RemarkEntity.create);

    for (const record of records) {
        try {
            await record.save()
            logger.info(`[Saved RMRK] ${record.id}`)
        } catch (e) {
            logger.warn(`[ERR] Can't save RMRK at block ${record.blockNumber} because \n${e}`)
        }
        
    
    }
}


