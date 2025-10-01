import { MongoMemoryServer } from 'mongodb-memory-server';

import { assert } from 'chai';

export async function startMemDbServer() : Promise<MemDbServer> {
  const server = await MongoMemoryServer.create();
  assert(server.instanceInfo, `mongo memory server startup failed`);
  return new MemDbServer(server);
}

export class MemDbServer  {

  private readonly server: MongoMemoryServer;
  
  constructor(server: MongoMemoryServer) {
    this.server = server;
  }

  get uri() { return this.server.getUri(); }

  async stop() {
    await this.server.stop();
    assert.equal(this.server.instanceInfo, undefined,
		 `mongo memory server stop failed`);
  }

}
