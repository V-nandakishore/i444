import * as tst from 'node:test';      //use node's builtin test framework

import { assert, expect } from 'chai'; //assertion library

//mock mongo using an in-memory mongodb server
import { MemDbServer, startMemDbServer } from './mem-db-server.js';


import { Errors as E } from 'cs444-js-utils';

import { Chat, makeChat} from '../lib/chat.js';
import * as T from '../lib/chat-types.js';


//suffix used to change data
const X = 'xxx';

tst.suite('Validators', () => {

  //mocha will run beforeEach() before each test to set up these variables
  let memDbServer: MemDbServer;
  let C: Chat;
  let now: string;
  
  tst.beforeEach(async function () {
    memDbServer = await startMemDbServer();
    const result = await makeChat(memDbServer.uri);    
    assert(result.isOk);
    C = result.val;
  });

  //mocha runs this after each test; we use this to clean up the DAO.
  tst.afterEach(async function () {
    const result = await C.close();
    assert(result.isOk);
    memDbServer.stop();
  });

  tst.suite('makeUser', () => {

    tst.test('ensure missing field detected', async () => {
      for (const k of Object.keys(USER)) {
	const user = { ... USER };
	delete user[k];
	const result = await C.makeUser(user);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_MISSING');
	expect(result.err.errors[0].options.widget).to.equal(k);
      }
    });

    tst.test('ensure bad type detected', async () => {
      for (const k of Object.keys(USER)) {
	const user = { ... USER };
	user[k] = 123;
	const result = await C.makeUser(user);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
	expect(result.err.errors[0].options.widget).to.equal(k);
      }
    });

    tst.test('ensure bad email detected', async () => {
      const user = { ... USER };
      user.email = user.email.replace('@', '');
      const result = await C.makeUser(user);
      assert(!result.isOk);
      expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
      expect(result.err.errors[0].options.widget).to.equal('email');
    });

    tst.test('ensure forbidden fields detected', async () => {
      for (const k of [ 'id', '_id', 'creationTime', 'lastUpdateTime' ]) {
	const user = { ... USER };
	user[k] = 'xxx';
	const result = await C.makeUser(user);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
	expect(result.err.errors[0].options.widget).to.equal(k);
      }
    });

    tst.test('ensure bad names detected', async () => {
      for (const k of [ 'firstName', 'lastName', 'chatName' ]) {
	const user = { ... USER };
	for (const badName of BAD_NAMES) {
	  user[k] = badName;
	  const result = await C.makeUser(user);
	  assert(!result.isOk);
	  expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
	  expect(result.err.errors[0].options.widget).to.equal(k);
	}
      }
    });

    tst.test('ensure extra fields ok', async () => {
      const user = { ... USER };
      user.x = 'xxx';
      const result = await C.makeUser(user);
      assert(result.isOk);
    });

  });
  
  tst.suite('updateUser', () => {

    tst.test('ensure bad type detected', async () => {
      const userId = T.brand<T.UserIdX>('xxx');
      for (const k of Object.keys(USER)) {
	const update = { [k]: 123 };
	const result = await C.updateUser(userId, update);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
	expect(result.err.errors[0].options.widget).to.equal(k);
      }
    });

    tst.test('ensure bad email detected', async () => {
      const userId = T.brand<T.UserIdX>('xxx');
      const result = await C.updateUser(userId, {email: 'xxx'});
      assert(!result.isOk);
      expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
      expect(result.err.errors[0].options.widget).to.equal('email');
    });

    tst.test('ensure forbidden fields detected', async () => {
      const userId = T.brand<T.UserIdX>('xxx');
      for (const k of [ 'id', '_id', 'creationTime', 'lastUpdateTime' ]) {
	const update = { [k]: 'xxx' };
	const result = await C.updateUser(userId, update);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
	expect(result.err.errors[0].options.widget).to.equal(k);
      }
    });

    tst.test('ensure bad names detected', async () => {
      const userId = T.brand<T.UserIdX>('xxx');
      for (const k of [ 'firstName', 'lastName', 'chatName' ]) {
	for (const badName of BAD_NAMES) {
	  const update = { [k]: badName };
	  const result = await C.updateUser(userId, update);
	  assert(!result.isOk);
	  expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
	  expect(result.err.errors[0].options.widget).to.equal(k);
	}
      }
    });


    tst.test('ensure extra fields ok', async () => {
      const result1 = await C.makeUser(USER);
      assert(result1.isOk);
      const userId = result1.val;
      const result2 = await C.updateUser(userId, {x: 123});
      assert(result2.isOk);
    });

  });

  tst.suite('getUser', () => {

    tst.test('ensure empty userKey detected', async () => {
      const result = await C.getUser({});
      assert(!result.isOk);
      expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
    });

    tst.test('ensure bad userKey detected', async () => {
      const result = await C.getUser({x: 123});
      assert(!result.isOk);
      expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
    });

    tst.test('ensure bad userKey type detected', async () => {
      for (const k of ['id', 'chatName', 'email']) {
	const userKey = { [k]: 123 };
	const result = await C.getUser(userKey);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
      }
    });

    tst.test('ensure extra user key detected', async () => {
      const keys = { id: 'xxx', chatName: 'xxx', email: 'x@xx.com' };
      for (const [k, v] of Object.entries(keys)) {
	const userKey = { [k]: v, x: 'xx' };
	const result = await C.getUser(userKey);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
      }
    });

    
    tst.test('ensure bad email detected', async () => {
      const result = await C.getUser({email: 'xxx'});
      assert(!result.isOk);
      expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
      expect(result.err.errors[0].options.widget).to.equal('email');
    });

  });
  
  
  tst.suite('makeChatRoom', () => {

    tst.test('ensure missing field detected', async () => {
      for (const k of Object.keys(ROOM)) {
	const room = { ... ROOM };
	delete room[k];
	const result = await C.makeChatRoom(room);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_MISSING');
	expect(result.err.errors[0].options.widget).to.equal(k);
      }
    });

    tst.test('ensure bad field type detected', async () => {
      for (const k of Object.keys(ROOM)) {
	const room = { ... ROOM };
	room[k] = 123;
	const result = await C.makeChatRoom(room);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
	expect(result.err.errors[0].options.widget).to.equal(k);
      }
    });

    tst.test('ensure bad room-name detected', async () => {
      const room = { ... ROOM };
      for (const badName of BAD_NAMES) {
	room.roomName = badName;
	const result = await C.makeChatRoom(room);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
	expect(result.err.errors[0].options.widget).to.equal('roomName');
      }
    });

    tst.test('ensure forbidden fields detected', async () => {
      for (const k of [ 'id', '_id', 'creationTime', 'lastUpdateTime' ]) {
	const room = { ... ROOM };
	room[k] = 'xxx';
	const result = await C.makeChatRoom(room);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
	expect(result.err.errors[0].options.widget).to.equal(k);
      }
    });

    tst.test('ensure extra fields ok', async () => {
      const room = { ... ROOM };
      room.x = 'xxx';
      const result = await C.makeChatRoom(room);
      assert(result.isOk);
    });

  });

  tst.suite('getChatRoom', () => {

    tst.test('ensure empty roomKey detected', async () => {
      const result = await C.getChatRoom({});
      assert(!result.isOk);
      expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
    });

    tst.test('ensure bad roomKey detected', async () => {
      const result = await C.getChatRoom({x: 123});
      assert(!result.isOk);
      expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
    });

    tst.test('ensure bad roomKey type detected', async () => {
      for (const k of ['id', 'roomName', ]) {
	const roomKey = { [k]: 123 };
	const result = await C.getChatRoom(roomKey);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
      }
    });

    tst.test('ensure extra roomKey  detected', async () => {
      for (const k of ['id', 'roomName', ]) {
	const roomKey = { [k]: 'xxx', x: 'xx' };
	const result = await C.getChatRoom(roomKey);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
      }
    });

  });
  
  tst.suite('makeChatMsg', () => {

    tst.test('ensure missing field detected', async () => {
      for (const k of Object.keys(CHAT_MSG)) {
	const msg = { ... CHAT_MSG };
	delete msg[k];
	const result = await C.makeChatMsg(msg);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_MISSING');
	expect(result.err.errors[0].options.widget).to.equal(k);
      }
    });

    tst.test('ensure bad field type detected', async () => {
      for (const k of Object.keys(CHAT_MSG)) {
	const msg = { ... CHAT_MSG };
	msg[k] = 123;
	const result = await C.makeChatMsg(msg);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
	expect(result.err.errors[0].options.widget).to.equal(k);
      }
    });

    tst.test('ensure bad names detected', async () => {
      for (const k of [ 'chatName', 'roomName' ]) {
	for (const badName of BAD_NAMES) {
	  const chatMsg = { ... CHAT_MSG };
	  chatMsg[k] = badName;
	  const result = await C.makeChatMsg(chatMsg);
	  assert(!result.isOk);
	  expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
	  expect(result.err.errors[0].options.widget).to.equal(k);
	}
      }
    });

    tst.test('ensure forbidden fields detected', async () => {
      for (const k of [ 'id', '_id', 'creationTime' ]) {
	const chatMsg = { ... CHAT_MSG };
	chatMsg[k] = 'xxx';
	const result = await C.makeChatMsg(chatMsg);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
	expect(result.err.errors[0].options.widget).to.equal(k);
      }
    });

    tst.test('ensure extra fields ok', async () => {
      const result1 = await C.makeUser(USER);
      assert(result1.isOk);
      const result2 = await C.makeChatRoom(ROOM);
      assert(result2.isOk);
      const chatMsg = { ... CHAT_MSG };
      chatMsg.x = 'xxx';
      const result3 = await C.makeChatMsg(chatMsg);
      assert(result3.isOk);
    });

    
  });

  tst.suite('findChatMsgs', () => {

    tst.test('ensure bad string field type detected', async () => {
      const stringFields =
	['id', 'roomName', 'chatName', 'words', 'earliest', 'latest'];
      for (const k of stringFields ) {
	const params = { roomName: 'typescript', [k]: 123 };
	const result = await C.findChatMsgs(params);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
	expect(result.err.errors[0].options.widget).to.equal(k);
      }
    });

    tst.test('ensure bad number field type detected', async () => {
      const numFields = [ 'offset', 'limit' ];
      for (const k of numFields ) {
	const params = { roomName: 'typescript', [k]: 'xxx' };
	const result = await C.findChatMsgs(params);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
	expect(result.err.errors[0].options.widget).to.equal(k);
      }
    });

    tst.test('ensure out-of-range number fields detected', async () => {
      const numFields = { 'offset': -1, 'limit': 0 };
      for (const [k, v] of Object.entries(numFields)) {
	const params = { roomName: 'typescript', [k]: v };
	const result = await C.findChatMsgs(params);
	assert(!result.isOk);
	expect(result.err.errors[0].options.code).to.equal('E_BAD_VAL');
	expect(result.err.errors[0].options.widget).to.equal(k);
      }
    });

    
  });
  
});


//Test Data

const USER: Record<string, any> = {
  firstName: 'mary anne',
  lastName: 'doe',
  email: 'joe@zzz.com',
  chatName: 'mary-anne',
};


const ROOM: Record<string, any> = { 
  roomName: 'type-script',
  descr: 'All things typescript',
};

const CHAT_MSG: Record<string, any> = {
  roomName: 'type-script',
  chatName: 'mary-anne',
  msg: 'It\'s a great day here; high of 70 and sunny',
};
				    

const BAD_NAMES = [ 'xxx$', ' xxx', 'xxx ', 'x  xx', 'x; xx' ];
