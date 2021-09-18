import {CeramicClient} from "@ceramicnetwork/http-client";
import {IDX} from "@ceramicstudio/idx";
import {Config as CeramicConfig} from "gasless-conviction-sdk/src/bootstrap";
import {PublicConfig} from "gasless-conviction-sdk/src/config";
import {TileDocument} from "@ceramicnetwork/stream-tile";
import StreamId from "@ceramicnetwork/streamid";
import {Caip10Link} from "@ceramicnetwork/stream-caip10-link";
import {
  ConvictionState,
  Convictions,
  Proposal,
  ProposalConviction,
} from "gasless-conviction-sdk/src/types";
import join from "url-join";

type FullProposal = Proposal & ProposalConviction;

type ApiConfig = {
  ceramic: CeramicClient;
  serviceURI: string;
};

function checkAuth(storage: CeramicStorage): string {
  const did = storage.ceramic.did?.id;
  if (!did) throw new Error("no ceramic authentication");

  return did;
}

export class cvAPI {
  uri: string;
  ceramicStorage: CeramicStorage;
  config: PublicConfig;

  static async from({ceramic, serviceURI}: ApiConfig): Promise<cvAPI> {
    const configResponse = await fetch(serviceURI);
    const config = (await configResponse.json()) as PublicConfig;
    return new cvAPI(ceramic, serviceURI, config);
  }

  constructor(
    ceramic: CeramicClient,
    serviceURI: string,
    config: PublicConfig,
  ) {
    this.uri = serviceURI;
    this.config = config;
    this.ceramicStorage = new CeramicStorage(ceramic, this.config.ceramic);
  }

  /**
   * Create a ceramic Proposal document and then attempts
   * to add it to the State Document. If the address passed is not linked
   * to the authenticated DID, the Proposal Creation will error. If the
   * address is not allow-listed by the service, a 401 error will be returned
   * and the proposal will not be added to the state document.
   */
  async addProposal(proposal: Proposal, address: string): Promise<void> {
    const authenticatedDid = checkAuth(this.ceramicStorage);
    const ceramic = this.ceramicStorage.ceramic as CeramicClient;
    const accountLink = await Caip10Link.fromAccount(
      ceramic,
      `${address}@eip155:${this.config.environment.chainId}`,
    );
    if (!accountLink?.did) {
      throw new Error("address not linked to any ceramic identity");
    } else if (accountLink.did !== authenticatedDid) {
      `address ${address} is linked to a different ceramic identity`;
    }

    // Todo: differentiate between creating a new proposal and updating
    // and existing one
    const doc = await TileDocument.create(ceramic, proposal, {
      schema: this.config.ceramic.schemas.Proposal,
    });

    const convictions = await this.ceramicStorage.getConvictions();
    convictions.proposals.push(doc.id.toUrl());
    this.ceramicStorage.setConvictions(convictions);

    const proposalupdateRequest = join(this.uri, `proposals`, address);
    await fetch(proposalupdateRequest);
  }
}

class CeramicStorage {
  ceramic: CeramicClient;
  config: CeramicConfig;
  idx: IDX;

  constructor(ceramic: CeramicClient, config: CeramicConfig) {
    this.ceramic = ceramic;
    this.config = config;
    this.idx = new IDX({
      ceramic,
      aliases: config.definitions,
    });
  }

  async stateDocument(): Promise<ConvictionState> {
    const state = await this.idx.get<ConvictionState>(
      "convictionstate",
      this.config.did,
    );
    if (!state)
      throw new Error("no state document found; is server config correct?");
    return state;
  }

  async proposals(): Promise<Array<FullProposal>> {
    const state = await this.stateDocument();
    const proposalConvictions = state.proposals;
    const proposalPromises = proposalConvictions.map(({proposal}) =>
      this.fetchProposal(proposal),
    );

    const proposals = await Promise.all(proposalPromises);
    return proposals.map((proposal, idx) => ({
      ...proposal.content,
      ...proposalConvictions[idx],
    }));
  }

  async queryParticipantConviction(
    address: string,
  ): Promise<Convictions | null> {
    const state = await this.stateDocument();
    const participant = state.participants.find(
      (participant) => participant.account === address,
    );
    if (!participant) return null;
    // todo: find did
    const doc = await TileDocument.load<Convictions>(
      this.ceramic,
      participant.convictions,
    );

    return doc?.content;
  }

  async getConvictions(): Promise<Convictions> {
    const state = await this.stateDocument();
    const EMPTY_CONVICTION = {
      context: state.context,
      convictions: [],
      proposals: [],
    };
    const content = await this.idx.get<Convictions>("convictions");
    return content || EMPTY_CONVICTION;
  }

  async setProposal(
    doc: TileDocument<Proposal>,
    nextProposal: Proposal,
  ): Promise<StreamId> {
    await doc.update(nextProposal);
    return doc.id;
  }

  async setConvictions(convictions: Convictions): Promise<StreamId> {
    return this.idx.set("convictions", convictions);
  }

  async fetchProposal(docId: string): Promise<TileDocument<Proposal>> {
    const doc = await TileDocument.load<Proposal>(this.ceramic, docId);
    if (!doc) throw new Error(`No doc matching docId: ${docId}`);

    return doc;
  }
}

/*
 * Things we need to implement
 * get signed-in user's convictions (and proposals if they're allow-listed)
 * submit proposal (if allow-listed)
 */
