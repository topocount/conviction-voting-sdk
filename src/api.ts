import {CeramicClient} from "@ceramicnetwork/http-client";
import {IDX} from "@ceramicstudio/idx";
import {Config as CeramicConfig} from "gasless-conviction-sdk/src/bootstrap";
import {PublicConfig} from "gasless-conviction-sdk/src/config";
import {TileDocument} from "@ceramicnetwork/stream-tile";
import {
  ConvictionState,
  Convictions,
  Proposal,
  ProposalConviction,
} from "gasless-conviction-sdk/src/types";

type FullProposal = Proposal & ProposalConviction;

type ApiConfig = {
  ceramic: CeramicClient;
  serviceURI: string;
  convictionStateDocId: string;
};

export class cvAPI {
  uri: string | undefined;
  convictionStateDocId: string | undefined;
  ceramicStorage: CeramicStorage | undefined;
  config: PublicConfig | undefined;

  async init({
    ceramic,
    serviceURI,
    convictionStateDocId,
  }: ApiConfig): Promise<void> {
    this.uri = serviceURI;
    const configResponse = await fetch(serviceURI);
    this.config = (await configResponse.json()) as PublicConfig;
    this.convictionStateDocId = convictionStateDocId;
    this.ceramicStorage = new CeramicStorage(ceramic, this.config.ceramic);
  }

  checkInit(): void {
    if (!this.uri) throw new Error("not initted: run `await api.init()`");
  }

  async submitProposal(proposal: Proposal): Promise<void> {
    throw new Error("Not Implememnted");
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
      ...proposal,
      ...proposalConvictions[idx],
    }));
  }

  async participantConviction(address: string): Promise<Convictions | null> {
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

  async fetchProposal(docId: string): Promise<Proposal> {
    const doc = await TileDocument.load<Proposal>(this.ceramic, docId);
    if (!doc) throw new Error(`No doc matching docId: ${docId}`);

    return doc.content;
  }
}

/*
 * Things we need to implement
 * get signed-in user's convictions (and proposals if they're allow-listed)
 * submit proposal (if allow-listed)
 */
