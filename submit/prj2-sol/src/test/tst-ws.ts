import { App, serve } from '../lib/chat-ws.js';
import * as Envelope from '../lib/response-envelopes.js';

import * as tst from 'node:test';      //use node's builtin test framework

import { assert, expect } from 'chai'; //assertion library

//mock mongo using an in-memory mongodb server
import { MemDbServer, startMemDbServer } from './mem-db-server.js';

import STATUS from 'http-status';

import supertest from 'supertest';


import { Errors as E } from 'cs444-js-utils';

import { Chat, makeChat} from '../lib/chat.js';
import * as T from '../lib/chat-types.js';

const BASE = '/api';


//suffix used to change data
const X = 'xxx';

tst.suite('Web Services', () => {

  //mocha will run beforeEach() before each test to set up these variables
  let memDbServer: MemDbServer;
  let C: Chat;
  let ws: ReturnType<typeof supertest>;
  
  tst.beforeEach(async function () {
    memDbServer = await startMemDbServer();
    const result = await makeChat(memDbServer.uri);    
    assert(result.isOk);
    C = result.val;
    const app: App = serve(C).app;
    ws = supertest(app);
  });

  //mocha runs this after each test; we use this to clean up the DAO.
  tst.afterEach(async function () {
    const result = await C.close();
    assert(result.isOk);
    memDbServer.stop();
  });

  tst.suite('users ws', () => {

    tst.test('must successfully add a user', async () => {
      const url = `${BASE}/users`;
      const res =
	await ws.post(url)
	  .set('Content-Type', 'application/json')
          .send(USER);
      expect(res.status).to.equal(STATUS.CREATED);
      expect(res.body?.kind).to.equal(Envelope.UNLINKED);
      const id = res.body.result;
      expect(id).to.be.a('string');
      expect(res.headers.location).to.equal(`${url}/${id}`);
    });
    
    tst.test('must successfully retrieve a user by id route', async () => {
      const url = `${BASE}/users`;
      const res =
	await ws.post(url)
	  .set('Content-Type', 'application/json')
          .send(USER);
      expect(res.status).to.equal(STATUS.CREATED);
      const url1 = res.headers.location;
      const res1 = await ws.get(url1);
      expect(res1.status).to.equal(STATUS.OK);
      expect(res1.body?.kind).to.equal(Envelope.SELF_LINKED);
      expect(res1.body?.result?._links?.self?.href).to.equal(url1);
      const { _links, id, creationTime, lastUpdateTime, ...user1 } =
	res1.body.result;
      expect(user1).to.deep.equal(USER);
    });
    
    tst.test('must successfully retrieve a user by query params', async () => {
      const url = `${BASE}/users`;
      const res =
	await ws.post(url)
	  .set('Content-Type', 'application/json')
          .send(USER);
      expect(res.status).to.equal(STATUS.CREATED);
      const id = res.body.result as string;
      for (const k of [ 'id', 'chatName', 'email', ]) {
	const v = (k === 'id') ? id : USER[k];
	const url1 = `${url}?${k}=${v}`;
	const res1 = await ws.get(url1);
	expect(res1.status).to.equal(STATUS.OK);
	expect(res1.body?.kind).to.equal(Envelope.SELF_LINKED);
	expect(res1.body?.result?._links?.self?.href).to.equal(`${url}/${id}`);
	const { _links, id: _, creationTime, lastUpdateTime, ...user1 } =
	  res1.body.result;
	expect(user1).to.deep.equal(USER);
      }
    });
    
    tst.test('must successfully update a user', async () => {
      const url = `${BASE}/users`;
      const res =
	await ws.post(url)
	  .set('Content-Type', 'application/json')
          .send(USER);
      expect(res.status).to.equal(STATUS.CREATED);
      const firstName = USER.firstName + X;
      const url1 = res.headers.location;
      const res1 = await ws.patch(url1)
	.set('Content-Type', 'application/json')
	.send({firstName});
      expect(res1.status).to.equal(STATUS.OK);
      expect(res1.body?.kind).to.equal(Envelope.SELF_LINKED);
      expect(res1.body?.result?._links?.self?.href).to.equal(url1);
      const { _links, id, creationTime, lastUpdateTime, ...user1 } =
	res1.body.result;
      expect(user1).to.deep.equal({...USER, firstName});
    });
    
    tst.test('must fail to add a user with missing params', async () => {
      const url = `${BASE}/users`;
      for (const k of Object.keys(USER)) {
	const user = { ...USER };
	delete user[k];
	const res =
	  await ws.post(url)
	    .set('Content-Type', 'application/json')
            .send(user);
	expect(res.status).to.equal(STATUS.BAD_REQUEST);
	expect(res.body?.errors?.[0]?.options?.code).to.equal('E_MISSING');
      }
    });
    
    tst.test('must fail to add a user with forbidden params', async () => {
      const url = `${BASE}/users`;
      for (const k of [ 'id', 'creationTime', 'lastUpdateTime' ]) {
	const user = { ...USER, [k]: X };
	const res =
	  await ws.post(url)
	    .set('Content-Type', 'application/json')
            .send(user);
	expect(res.status).to.equal(STATUS.BAD_REQUEST);
	expect(res.body?.errors?.[0]?.options?.code).to.equal('E_BAD_VAL');
      }
    });
    
    tst.test('must fail retrieve a user by unknown query params', async () => {
      const url = `${BASE}/users`;
      const res =
	await ws.post(url)
	  .set('Content-Type', 'application/json')
          .send(USER);
      expect(res.status).to.equal(STATUS.CREATED);
      const id = res.body.result as string;
      const url1 = `${url}?$x=xxx`;
      const res1 = await ws.get(url1);
      expect(res1.status).to.equal(STATUS.BAD_REQUEST);
      expect(res1.body?.errors?.[0]?.options?.code).to.equal('E_BAD_VAL');
    });
    
    tst.test('must fail retrieve a user by bad query params', async () => {
      const url = `${BASE}/users`;
      const res =
	await ws.post(url)
	  .set('Content-Type', 'application/json')
          .send(USER);
      expect(res.status).to.equal(STATUS.CREATED);
      const id = res.body.result as string;
      for (const k of [ 'id', 'chatName', 'email' ]) {
	const v = ((k === 'id') ? id : USER[k]) + X;
	const url1 = `${url}?${k}=${v}`;
	const res1 = await ws.get(url1);
	expect(res1.status).to.equal(STATUS.NOT_FOUND);
      }
    });
    
    tst.test('must fail to add a user with same email/chatName', async () => {
      const url = `${BASE}/users`;
      const res1 =
	await ws.post(url)
	  .set('Content-Type', 'application/json')
          .send(USER);
      expect(res1.status).to.equal(STATUS.CREATED);
      const res2 =
	await ws.post(url)
	  .set('Content-Type', 'application/json')
          .send(USER);
      expect(res2.status).to.equal(STATUS.CONFLICT);
    });
    
    
    tst.test('must catch bad email in user update', async () => {
      const url = `${BASE}/users`;
      const res =
	await ws.post(url)
	  .set('Content-Type', 'application/json')
          .send(USER);
      expect(res.status).to.equal(STATUS.CREATED);
      const email = USER.email.replace('@', '');
      const url1 = res.headers.location;
      const res1 = await ws.patch(url1)
	.set('Content-Type', 'application/json')
	.send({email});
      expect(res1.status).to.equal(STATUS.BAD_REQUEST);
      expect(res1.body?.errors?.[0]?.options?.code).to.equal('E_BAD_VAL');
    });
    

  });

  tst.suite('chat-rooms ws', () => {

    tst.test('must successfully add a chat-room', async () => {
      const url = `${BASE}/chat-rooms`;
      const res =
	await ws.post(url)
	  .set('Content-Type', 'application/json')
          .send(ROOM);
      expect(res.status).to.equal(STATUS.CREATED);
      expect(res.body?.kind).to.equal(Envelope.UNLINKED);
      const id = res.body.result;
      expect(id).to.be.a('string');
      expect(res.headers.location).to.equal(`${url}/${id}`);
    });
    
    tst.test('must successfully retrieve a chat-room by id route', async () => {
      const url = `${BASE}/chat-rooms`;
      const res =
	await ws.post(url)
	  .set('Content-Type', 'application/json')
          .send(ROOM);
      expect(res.status).to.equal(STATUS.CREATED);
      const url1 = res.headers.location;
      const res1 = await ws.get(url1);
      expect(res1.status).to.equal(STATUS.OK);
      expect(res1.body?.kind).to.equal(Envelope.SELF_LINKED);
      expect(res1.body?.result?._links?.self?.href).to.equal(url1);
      const { _links, id, creationTime, lastUpdateTime, ...room1 } =
	res1.body.result;
      expect(room1).to.deep.equal(ROOM);
    });
    
    tst.test('must retrieve a chat-room by query params', async () => {
      const url = `${BASE}/chat-rooms`;
      const res =
	await ws.post(url)
	  .set('Content-Type', 'application/json')
          .send(ROOM);
      expect(res.status).to.equal(STATUS.CREATED);
      const id = res.body.result as string;
      for (const k of [ 'id', 'roomName', ]) {
	const v = (k === 'id') ? id : ROOM[k];
	const url1 = `${url}?${k}=${v}`;
	const res1 = await ws.get(url1);
	expect(res1.status).to.equal(STATUS.OK);
	expect(res1.body?.kind).to.equal(Envelope.SELF_LINKED);
	expect(res1.body?.result?._links?.self?.href).to.equal(`${url}/${id}`);
	const { _links, id: _, creationTime, lastUpdateTime, ...room1 } =
	  res1.body.result;
	expect(room1).to.deep.equal(ROOM);
      }
    });
    
    tst.test('must fail to add a chat-room with missing params', async () => {
      const url = `${BASE}/chat-rooms`;
      for (const k of Object.keys(ROOM)) {
	const room = { ...ROOM };
	delete room[k];
	const res =
	  await ws.post(url)
	    .set('Content-Type', 'application/json')
            .send(room);
	expect(res.status).to.equal(STATUS.BAD_REQUEST);
	expect(res.body?.errors?.[0]?.options?.code).to.equal('E_MISSING');
      }
    });
    
    tst.test('must fail to add a room with forbidden params', async () => {
      const url = `${BASE}/users`;
      for (const k of [ 'id', 'creationTime', 'lastUpdateTime' ]) {
	const room = { ...ROOM, [k]: X };
	const res =
	  await ws.post(url)
	    .set('Content-Type', 'application/json')
            .send(room);
	expect(res.status).to.equal(STATUS.BAD_REQUEST);
	expect(res.body?.errors?.[0]?.options?.code).to.equal('E_BAD_VAL');
      }
    });
    
    tst.test('fail retrieve a chat-room by unknown query params', async () => {
      const url = `${BASE}/chat-rooms`;
      const res =
	await ws.post(url)
	  .set('Content-Type', 'application/json')
          .send(ROOM);
      expect(res.status).to.equal(STATUS.CREATED);
      const id = res.body.result as string;
      const url1 = `${url}?$x=xxx`;
      const res1 = await ws.get(url1);
      expect(res1.status).to.equal(STATUS.BAD_REQUEST);
      expect(res1.body?.errors?.[0]?.options?.code).to.equal('E_BAD_VAL');
    });
    
    tst.test('must fail retrieve a chat-room by bad query params', async () => {
      const url = `${BASE}/chat-rooms`;
      const res =
	await ws.post(url)
	  .set('Content-Type', 'application/json')
          .send(ROOM);
      expect(res.status).to.equal(STATUS.CREATED);
      const id = res.body.result as string;
      for (const k of [ 'id', 'roomName' ]) {
	const v = ((k === 'id') ? id : ROOM[k]) + X;
	const url1 = `${url}?${k}=${v}`;
	const res1 = await ws.get(url1);
	expect(res1.status).to.equal(STATUS.NOT_FOUND);
	expect(res1.body?.errors?.[0]?.options?.code).to.equal('E_NOT_FOUND');
      }
    });
    
    tst.test('must fail to add a chat-room with same roomName', async () => {
      const url = `${BASE}/chat-rooms`;
      const res1 =
	await ws.post(url)
	  .set('Content-Type', 'application/json')
          .send(ROOM);
      expect(res1.status).to.equal(STATUS.CREATED);
      const res2 =
	await ws.post(url)
	  .set('Content-Type', 'application/json')
          .send(ROOM);
      expect(res2.status).to.equal(STATUS.CONFLICT);
    });
    
  });  
  
  tst.suite('add-chat-msg ws', () => {
    const msg = 'some message';

    tst.test('must successfully add a chat-message', async () => {
      const url1 = `${BASE}/users`;
      const res1 =
	await ws.post(url1)
	  .set('Content-Type', 'application/json')
          .send(USER);
      expect(res1.status).to.equal(STATUS.CREATED);
      const url2 = `${BASE}/chat-rooms`;
      const res2 =
	await ws.post(url2)
	  .set('Content-Type', 'application/json')
          .send(ROOM);
      expect(res2.status).to.equal(STATUS.CREATED);
      const { chatName } = USER;
      const { roomName } = ROOM;
      const message = { chatName, roomName, msg };
      const url3 = `${BASE}/chat-msgs`;
      const res3 =
	await ws.post(url3)
	  .set('Content-Type', 'application/json')
          .send(message);
      expect(res3.status).to.equal(STATUS.CREATED);
      expect(res3.body?.kind).to.equal(Envelope.UNLINKED);
      const id = res3.body.result;
      expect(id).to.be.a('string');
      expect(res3.headers.location).to.equal(`${url3}/${id}`);
    });

    tst.test('must fail to add a chat-message for bad room/user', async () => {
      const url1 = `${BASE}/users`;
      const res1 =
	await ws.post(url1)
	  .set('Content-Type', 'application/json')
          .send(USER);
      expect(res1.status).to.equal(STATUS.CREATED);
      const url2 = `${BASE}/chat-rooms`;
      const res2 =
	await ws.post(url2)
	  .set('Content-Type', 'application/json')
          .send(ROOM);
      expect(res2.status).to.equal(STATUS.CREATED);
      const url3 = `${BASE}/chat-msgs`;
      for (const k of [ 'chatName', 'roomName' ]) {
	const chatName = (k === 'chatName') ? X : USER[k];
	const roomName = (k === 'roomName') ? X : ROOM[k];
	const message = { chatName, roomName, msg };
	const res3 =
	  await ws.post(url3)
	    .set('Content-Type', 'application/json')
            .send(message);
	expect(res3.status).to.equal(STATUS.BAD_REQUEST);
      }
    });
    
  });

  tst.suite('find-chat-msgs ws', () => {

    const msgFn = (i: number) => `message ${i}`;
    const N_MSGS = 12;
    const CHAT_NAMES = [ 'joe', 'bill' ];

    tst.beforeEach(async () => {
      const url1 = `${BASE}/users`;
      for (const chatName of CHAT_NAMES) {
	const user = { firstName: chatName, lastName: `${chatName}-user`,
		       email: `${chatName}@x.com`, chatName };
	const res1 =
	  await ws.post(url1)
	    .set('Content-Type', 'application/json')
            .send(user);
	expect(res1.status).to.equal(STATUS.CREATED);
      }
      const url2 = `${BASE}/chat-rooms`;
      const { roomName } = ROOM;
      const res2 =
	await ws.post(url2)
	  .set('Content-Type', 'application/json')
          .send(ROOM);
      expect(res2.status).to.equal(STATUS.CREATED);
      for (let i = 0; i < N_MSGS; i++) {
	const url3 = `${BASE}/chat-msgs`;
	const chatName  = CHAT_NAMES[i%2];
	const msg = msgFn(i);
	const message = { chatName, roomName, msg };
	const res3 =
	  await ws.post(url3)
	    .set('Content-Type', 'application/json')
            .send(message);
	expect(res3.status).to.equal(STATUS.CREATED);
	expect(res3.body?.kind).to.equal(Envelope.UNLINKED);
	const id = res3.body.result;
	expect(id).to.be.a('string');
	expect(res3.headers.location).to.equal(`${url3}/${id}`);
      }
    });

    tst.test('must scroll back-and-forth thru results', async () => { 
      const { roomName } = ROOM;
      let msgN = N_MSGS;
      let next = `${BASE}/chat-msgs/${roomName}`;
      let last: string = '';
      while (next) {
	const res = await ws.get(next);
	expect(res.status).to.equal(STATUS.OK);
	expect(res.body?.kind).to.equal(Envelope.PAGED);
	next = res.body?._links?.next?.href;
	last = res.body?._links?.self?.href;
	for (const wsMessage of res.body?.result) {
	  msgN--;
	  const { _links, id, creationTime, ...actual } = wsMessage;
	  const chatName = CHAT_NAMES[msgN % 2];
	  const { roomName } = ROOM;
	  const expected = { chatName, roomName, msg: msgFn(msgN) };
	  expect(actual).to.deep.equal(expected);
	}
      }
      expect(msgN).to.equal(0);
      let prev = last;
      while (prev) {
	const res = await ws.get(prev);
	expect(res.status).to.equal(STATUS.OK);
	expect(res.body?.kind).to.equal(Envelope.PAGED);
	next = res.body?._links?.next?.href;
	prev = res.body?._links?.prev?.href;
	for (const wsMessage of res.body?.result.toReversed()) {
	  const { _links, id, creationTime, ...actual } = wsMessage;
	  const chatName = CHAT_NAMES[msgN % 2];
	  const { roomName } = ROOM;
	  const expected = { chatName, roomName, msg: msgFn(msgN) };
	  expect(actual).to.deep.equal(expected);
	  msgN++;
	}
      }
      
    });
		   
  });
    
});


//Test Data

const USER: Record<string, any> = {
  firstName: 'joe',
  lastName: 'doe',
  email: 'joe@zzz.com',
  chatName: 'joe',
};


const ROOM: Record<string, any> = { 
  roomName: 'typescript',
  descr: 'All things typescript',
};

const CHAT_MSG: Record<string, any> = {
  roomName: 'typescript',
  chatName: 'joe',
  msg: 'It\'s a great day here; high of 70 and sunny',
};
				    
const FIND_PARAMS: Record<string, any> = {
  id: '123',
  roomName: 'typescript',
  chatName: 'joe',
  words: 'great',
  earliest: '2025-04-10T12:32:00.000Z',
  latest: '2025-06-10T12:32:00.000Z',
};
