import { Client } from "../../src/types/Client";
import { hexToPublicKey, verifySignature } from "../../src/types/crypto/signatures";
import { AddClientRequest, AddClientResponse } from "../../src/types/GuiRequest";
import { JSONStringifyDeterministic, nodeIdToPublicKeyHex } from "../../src/types/keypair";
import { invalidateAllClients } from "../common/getDatabaseItems";
import { getAdminBucket } from "../gatewayRequestHandlers/initiateFileUploadHandler";
import { objectExists, parseBucketUri, putObject } from "../gatewayRequestHandlers/s3Helpers";

// const MAX_NUM_CLIENTS_PER_USER = 25

const addClientHandler = async (request: AddClientRequest, verifiedUserId?: string): Promise<AddClientResponse> => {
    const { clientId, ownerId, label, privateKeyHex } = request

    if (ownerId !== verifiedUserId) {
        throw Error('Mismatch between ownerId and verifiedUserId')
    }

    // we need to verify that the user owns the client
    // const elapsed = Date.now() - request.verificationDocument.timestamp
    // if ((elapsed < -3000) || (elapsed > 60 * 1000)) {
    //     throw Error('Invalid timestamp when verifying control of client')
    // }
    if (!verifySignature(request.verificationDocument, hexToPublicKey(nodeIdToPublicKeyHex(request.clientId)), request.verificationSignature)) {
        throw Error('Invalid verification signature')
    }

    const adminBucket = getAdminBucket()
    const {bucketName: adminBucketName} = parseBucketUri(adminBucket.uri)
    const kk = `clients/${clientId}`
    
    const alreadyExists = await objectExists(adminBucket, kk)
    if (alreadyExists) {
        throw Error('Client with clientId already exists.')
    }

    // const db = firestoreDatabase()
    // const clientsCollection = db.collection('kachery-gateway.clients')
    // const clientSnapshot = await clientsCollection.doc(clientId.toString()).get()
    // if (clientSnapshot.exists) {
    //     throw Error('Client clientId already exists.')
    // }

    // const result = await clientsCollection.where('ownerId', '==', ownerId).get()
    // if (result.docs.length + 1 > MAX_NUM_CLIENTS_PER_USER) {
    //     throw Error(`User cannot own more than ${MAX_NUM_CLIENTS_PER_USER} clients`)
    // }

    const client: Client = {
        clientId,
        ownerId,
        timestampCreated: Date.now(),
        label
    }
    if (privateKeyHex) client.privateKeyHex = privateKeyHex
    
    await putObject(adminBucket, {
        Key: kk,
        Body: JSONStringifyDeterministic(client),
        Bucket: adminBucketName
    })

    // await clientsCollection.doc(clientId.toString()).set(client)

    invalidateAllClients()
    
    
    return {
        type: 'addClient'
    }
}

export default addClientHandler