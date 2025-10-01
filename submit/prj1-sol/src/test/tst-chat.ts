import * as tst from "node:test"; //use node's builtin test framework

import { assert, expect } from "chai"; //assertion library

import MockDate from "mockdate"; //mocking dates

//mock mongo using an in-memory mongodb server
import { MemDbServer, startMemDbServer } from "./mem-db-server.js";

import { Errors as E } from "cs444-js-utils";

import { Chat, makeChat } from "../lib/chat.js";
import * as T from "../lib/chat-types.js";

//suffix used to change data
const X = "xxx";

tst.suite("Chat", () => {
  //mocha will run beforeEach() before each test to set up these variables
  let memDbServer: MemDbServer;
  let C: Chat;
  let now: string;

  tst.beforeEach(async function () {
    now = new Date().toISOString();
    MockDate.set(now);
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
    MockDate.reset();
  });

  tst.suite("users", () => {
    tst.test("ensure created user returns an id", async () => {
      const result = await C.makeUser(USERS[0]);
      assert(result.isOk);
      const id = result.val;
      expect(typeof id).to.equal("string");
    });

    tst.test("ensure created user can be retrieved", async () => {
      const result1 = await C.makeUser(USERS[0]);
      assert(result1.isOk);
      const id = result1.val;
      expect(typeof id).to.equal("string");
      const result2 = await C.getUser({ id });
      assert(result2.isOk);
      const expected = {
        ...USERS[0],
        id,
        creationTime: now,
        lastUpdateTime: now,
      };
      expect(result2.val).to.deep.equal(expected);
    });

    tst.test("ensure multiple created users can be retrieved", async () => {
      let ids: T.UserIdX[] = [];
      for (const u of USERS) {
        const result1 = await C.makeUser(u);
        assert(result1.isOk);
        const id = result1.val;
        expect(typeof id).to.equal("string");
        ids.push(id);
      }
      let users: T.User[] = [];
      for (const id of ids.toReversed()) {
        const result2 = await C.getUser({ id });
        assert(result2.isOk);
        users.push(result2.val);
      }
      for (const [i, u] of users.toReversed().entries()) {
        const expected = {
          ...USERS[i],
          id: ids[i],
          creationTime: now,
          lastUpdateTime: now,
        };
        expect(u).to.deep.equal(expected);
      }
    });

    tst.test("ensure cannot retrieve user with bad id", async () => {
      const result1 = await C.makeUser(USERS[0]);
      assert(result1.isOk);
      const id = result1.val;
      expect(typeof id).to.equal("string");
      const result2 = await C.getUser({ id: T.brand<T.UserIdX>(id + X) });
      assert(result2.isOk === false);
      expect(result2.err.errors[0].options.code).to.equal("E_NOT_FOUND");
    });

    tst.test("ensure cannot insert user with duplicate email", async () => {
      const result1 = await C.makeUser(USERS[0]);
      assert(result1.isOk);
      const id = result1.val;
      expect(typeof id).to.equal("string");
      const u1 = {
        ...USERS[0],
        chatName: T.brand<T.NameX>(USERS[0].chatName + X),
      };
      const result2 = await C.makeUser(u1);
      assert(result2.isOk === false);
      expect(result2.err.errors[0].options.code).to.equal("E_EXISTS");
    });

    tst.test("ensure cannot insert user with duplicate chatName", async () => {
      const result1 = await C.makeUser(USERS[0]);
      assert(result1.isOk);
      const id = result1.val;
      expect(typeof id).to.equal("string");
      const u1 = { ...USERS[0], email: T.brand<T.EmailX>(USERS[0].email + X) };
      const result2 = await C.makeUser(u1);
      assert(result2.isOk === false);
      expect(result2.err.errors[0].options.code).to.equal("E_EXISTS");
    });
  });

  tst.suite("update users", () => {
    tst.test("ensure can update user email", async () => {
      const result1 = await C.makeUser(USERS[0]);
      assert(result1.isOk);
      const id = result1.val;
      expect(typeof id).to.equal("string");
      const email = T.brand<T.EmailX>(USERS[0].email + X);
      const result2 = await C.updateUser(id, { email });
      assert(result2.isOk);
      const expected = {
        ...USERS[0],
        id,
        email,
        creationTime: now,
        lastUpdateTime: now,
      };
      expect(result2.val).to.deep.equal(expected);
      const result3 = await C.getUser({ id });
      assert(result3.isOk);
      expect(result3.val).to.deep.equal(expected);
    });

    tst.test("ensure can singly update all NameX fields", async () => {
      for (const [i, f] of ["firstName", "lastName", "chatName"].entries()) {
        const result1 = await C.makeUser(USERS[i]);
        assert(result1.isOk);
        const id = result1.val;
        expect(typeof id).to.equal("string");
        const f1 = f as keyof T.User;
        const v1 = T.brand<T.NameX>(X);
        const result2 = await C.updateUser(id, { [f1]: v1 });
        assert(result2.isOk);
        const expected = {
          ...USERS[i],
          id,
          [f1]: v1,
          creationTime: now,
          lastUpdateTime: now,
        };
        expect(result2.val).to.deep.equal(expected);
        const result3 = await C.getUser({ id });
        assert(result3.isOk);
        expect(result3.val).to.deep.equal(expected);
      }
    });

    tst.test("ensure can update all user fields", async () => {
      const result1 = await C.makeUser(USERS[0]);
      assert(result1.isOk);
      const id = result1.val;
      expect(typeof id).to.equal("string");
      const u1 = {
        firstName: T.brand<T.NameX>("karen"),
        lastName: T.brand<T.NameX>("armstrong"),
        email: T.brand<T.EmailX>("karen@zzz.com"),
        chatName: T.brand<T.NameX>("karen"),
      };
      const result2 = await C.updateUser(id, u1);
      assert(result2.isOk);
      const expected = { ...u1, id, creationTime: now, lastUpdateTime: now };
      expect(result2.val).to.deep.equal(expected);
      const result3 = await C.getUser({ id });
      assert(result3.isOk);
      expect(result3.val).to.deep.equal(expected);
    });
  });

  tst.suite("chat rooms", () => {
    tst.test("ensure created room returns an id", async () => {
      const result = await C.makeChatRoom(ROOMS[0]);
      assert(result.isOk);
      const id = result.val;
      expect(typeof id).to.equal("string");
    });

    tst.test("ensure created room can be retrieved", async () => {
      const result1 = await C.makeChatRoom(ROOMS[0]);
      assert(result1.isOk);
      const id = result1.val;
      expect(typeof id).to.equal("string");
      const result2 = await C.getChatRoom({ id });
      assert(result2.isOk);
      const expected = {
        ...ROOMS[0],
        id,
        creationTime: now,
        lastUpdateTime: now,
      };
      expect(result2.val).to.deep.equal(expected);
    });

    tst.test("ensure multiple created rooms can be retrieved", async () => {
      let ids: T.RoomIdX[] = [];
      for (const u of ROOMS) {
        const result1 = await C.makeChatRoom(u);
        assert(result1.isOk);
        const id = result1.val;
        expect(typeof id).to.equal("string");
        ids.push(id);
      }
      let rooms: T.ChatRoom[] = [];
      for (const id of ids.toReversed()) {
        const result2 = await C.getChatRoom({ id });
        assert(result2.isOk);
        rooms.push(result2.val);
      }
      for (const [i, u] of rooms.toReversed().entries()) {
        const expected = {
          ...ROOMS[i],
          id: ids[i],
          creationTime: now,
          lastUpdateTime: now,
        };
        expect(u).to.deep.equal(expected);
      }
    });

    tst.test("ensure cannot retrieve room with bad id", async () => {
      const result1 = await C.makeChatRoom(ROOMS[0]);
      assert(result1.isOk);
      const id = result1.val;
      expect(typeof id).to.equal("string");
      const result2 = await C.getChatRoom({ id: T.brand<T.RoomIdX>(id + X) });
      assert(result2.isOk === false);
      expect(result2.err.errors[0].options.code).to.equal("E_NOT_FOUND");
    });

    tst.test("ensure cannot insert room with duplicate roomName", async () => {
      const result1 = await C.makeChatRoom(ROOMS[0]);
      assert(result1.isOk);
      const id = result1.val;
      expect(typeof id).to.equal("string");
      const r1 = { ...ROOMS[0], descr: ROOMS[0].descr + X };
      const result2 = await C.makeChatRoom(r1);
      assert(result2.isOk === false);
      expect(result2.err.errors[0].options.code).to.equal("E_EXISTS");
    });
  });

  tst.suite("Chat Messages", () => {
    tst.test("can add chat messages for existing users and rooms", async () => {
      await addAll(C, USERS, ROOMS, MSGS);
    });

    tst.test("can search chat messages by id and roomName", async () => {
      const ids = await addAll(C, USERS, ROOMS, MSGS);
      for (const [ui, u] of USERS.entries()) {
        const { chatName } = u;
        for (const [ri, r] of ROOMS.entries()) {
          const { roomName } = r;
          for (const [mi, msg] of MSGS.entries()) {
            const id = ids[idKey(roomName, chatName, mi)];
            const msgResult = await C.findChatMsgs({
              id,
              roomName,
              limit: 999,
            });
            assert(msgResult.isOk);
            const msgs = msgResult.val;
            expect(msgs).to.have.length(1);
            const creationTime = makeDate(mi);
            const expected = { id, roomName, chatName, msg, creationTime };
            expect(msgs[0]).to.deep.equal(expected);
          }
        }
      }
    });

    tst.test("search by bad roomName gets E_NOT_FOUND", async () => {
      const ids = await addAll(C, USERS, ROOMS, MSGS);
      const roomName = T.brand<T.NameX>(ROOMS[0].roomName + X);
      const result = await C.findChatMsgs({ roomName, limit: 999 });
      assert(!result.isOk);
      expect(result.err.errors).to.have.length.greaterThan(0);
      expect(result.err.errors[0].options.code).to.equal("E_NOT_FOUND");
    });

    tst.test("search by bad chatName gets E_NOT_FOUND", async () => {
      const ids = await addAll(C, USERS, ROOMS, MSGS);
      const roomName = ROOMS[0].roomName;
      const chatName = T.brand<T.NameX>(USERS[0].chatName + X);
      const result = await C.findChatMsgs({ roomName, chatName, limit: 999 });
      assert(!result.isOk);
      expect(result.err.errors).to.have.length.greaterThan(0);
      expect(result.err.errors[0].options.code).to.equal("E_NOT_FOUND");
    });

    tst.test("can search chat messages by roomName and chatName", async () => {
      const ids = await addAll(C, USERS, ROOMS, MSGS);
      for (const [ui, u] of USERS.entries()) {
        const { chatName } = u;
        for (const [ri, r] of ROOMS.entries()) {
          const { roomName } = r;
          const msgResult = await C.findChatMsgs({
            chatName,
            roomName,
            limit: 999,
          });
          assert(msgResult.isOk);
          const msgs = msgResult.val.toSorted(msgCmp);
          expect(msgs).to.have.length(MSGS.length);
          for (const [mi, msg] of MSGS.entries()) {
            const id = ids[idKey(roomName, chatName, mi)];
            const creationTime = makeDate(mi);
            const expected = { id, roomName, chatName, msg, creationTime };
            expect(msgs[mi]).to.deep.equal(expected);
          }
        }
      }
    });

    tst.test("can search chat messages by roomName", async () => {
      const ids = await addAll(C, USERS, ROOMS, MSGS);
      for (const [ri, r] of ROOMS.entries()) {
        const { roomName } = r;
        const msgResult = await C.findChatMsgs({ roomName, limit: 999 });
        assert(msgResult.isOk);
        const msgs = msgResult.val.toSorted(msgCmp);
        expect(msgs).to.have.length(USERS.length * MSGS.length);
        for (const [mi1, msg] of msgs.entries()) {
          const ui = mi1 % USERS.length;
          const u = USERS[ui];
          const { chatName } = u;
          const mi = Math.floor(mi1 / USERS.length);
          const id = ids[idKey(roomName, chatName, mi)];
          const creationTime = makeDate(mi);
          const expected = {
            id,
            roomName,
            chatName,
            msg: MSGS[mi],
            creationTime,
          };
          expect(msg).to.deep.equal(expected);
        }
      }
    });

    tst.test("must respect offset and limit search params", async () => {
      //pretty weak test because ordering of results is underspecified
      //(would like to compare on chatName and roomName, but implementation
      //makes that difficult).
      const [offset, limit] = [1, 2];
      const ids = await addAll(C, USERS, ROOMS, MSGS);
      const room = ROOMS[0];
      const user = USERS[0];
      const { roomName } = room;
      const { chatName } = user;
      const msgResult = await C.findChatMsgs({
        roomName,
        chatName,
        offset,
        limit,
      });
      assert(msgResult.isOk);
      const msgs = msgResult.val;
      console.assert(MSGS.length > 2);
      expect(msgs).to.have.length(limit);
      const expectedMsgs = MSGS.toReversed().slice(offset);
      for (const [i, msg] of msgs.entries()) {
        const mi = MSGS.length - 1 - (offset + i);
        const id = ids[idKey(roomName, chatName, mi)];
        const creationTime = makeDate(mi);
        const expected = {
          id,
          roomName,
          chatName,
          msg: expectedMsgs[i],
          creationTime,
        };
        expect(msg).to.deep.equal(expected);
      }
    });

    tst.test("chat messages by roomName are sorted by time", async () => {
      await addAll(C, USERS, ROOMS, MSGS);
      for (const [ri, r] of ROOMS.entries()) {
        const { roomName } = r;
        const msgResult = await C.findChatMsgs({ roomName, limit: 999 });
        assert(msgResult.isOk);
        const msgs = msgResult.val;
        expect(msgs).to.have.length(USERS.length * MSGS.length);
        let last = "";
        for (const msg of msgs) {
          assert(last === "" || last >= msg.creationTime);
          last = msg.creationTime;
        }
      }
    });

    tst.test("search must respect latest", async () => {
      await addAll(C, USERS, ROOMS, MSGS);
      for (const [ri, r] of ROOMS.entries()) {
        const { roomName } = r;
        const years = Array.from({ length: MSGS.length + 1 }).map((_, i) => i);
        for (const y of years) {
          const latest = T.brand<T.Iso8601X>(`202${y}-01-01T00:00:00.000Z`);
          const msgResult = await C.findChatMsgs({
            roomName,
            latest,
            limit: 999,
          });
          assert(msgResult.isOk);
          const msgs = msgResult.val;
          expect(msgs).to.have.length(USERS.length * y);
          for (const msg of msgs) {
            assert(msg.creationTime <= latest);
          }
        }
      }
    });

    tst.test("search must respect earliest", async () => {
      await addAll(C, USERS, ROOMS, MSGS);
      for (const [ri, r] of ROOMS.entries()) {
        const { roomName } = r;
        const nMsgs = MSGS.length;
        const years = Array.from({ length: nMsgs + 1 }).map(
          (_, i) => nMsgs - i
        );
        for (const y of years) {
          const earliest = T.brand<T.Iso8601X>(`202${y}-01-01T00:00:00.000Z`);
          const msgResult = await C.findChatMsgs({
            roomName,
            earliest,
            limit: 999,
          });
          assert(msgResult.isOk);
          const msgs = msgResult.val;
          expect(msgs).to.have.length(USERS.length * (nMsgs - y));
          for (const msg of msgs) {
            assert(msg.creationTime >= earliest);
          }
        }
      }
    });

    tst.test("search must respect earliest and latest", async () => {
      await addAll(C, USERS, ROOMS, MSGS);
      for (const [ri, r] of ROOMS.entries()) {
        const { roomName } = r;
        const nYears = MSGS.length + 1;
        const years = Array.from({ length: nYears }).map((_, i) => i);
        for (const y1 of years) {
          const earliest = T.brand<T.Iso8601X>(`202${y1}-01-01T00:00:00.000Z`);
          for (const i of Array.from({ length: nYears - y1 }).map(
            (_, i) => i
          )) {
            const y2 = y1 + i;
            const latest = T.brand<T.Iso8601X>(`202${y2}-01-01T00:00:00.000Z`);
            const msgResult = await C.findChatMsgs({
              roomName,
              earliest,
              latest,
              limit: 999,
            });
            assert(msgResult.isOk);
            const msgs = msgResult.val;
            expect(msgs).to.have.length(USERS.length * (y2 - y1));
            for (const msg of msgs) {
              assert(
                earliest <= msg.creationTime && msg.creationTime <= latest
              );
            }
          }
        }
      }
    });

    tst.test("must match word in words", async () => {
      const words = "hello";
      const res = words
        .replaceAll(/[^\w\s]+/g, "")
        .split(/\s+/)
        .map((w) => new RegExp(w, "i"));
      const nExpected =
        MSGS.filter((m) => res.some((re) => re.test(m))).length * USERS.length;
      await addAll(C, USERS, ROOMS, MSGS);
      for (const [ri, r] of ROOMS.entries()) {
        const { roomName } = r;
        const msgResult = await C.findChatMsgs({ roomName, words, limit: 999 });
        assert(msgResult.isOk);
        const msgs = msgResult.val;
        expect(msgs).to.have.length(nExpected);
        for (const msg of msgs) {
          assert(res.some((re) => re.test(msg.msg)));
        }
      }
    });

    tst.test(" partial word must not match", async () => {
      const words = "ello";
      const res = words
        .replaceAll(/[^\w\s]+/g, "")
        .split(/\s+/)
        .map((w) => new RegExp(w, "i"));
      await addAll(C, USERS, ROOMS, MSGS);
      for (const [ri, r] of ROOMS.entries()) {
        const { roomName } = r;
        const msgResult = await C.findChatMsgs({ roomName, words, limit: 999 });
        assert(msgResult.isOk);
        const msgs = msgResult.val;
        expect(msgs).to.have.length(0);
      }
    });

    tst.test("non-existent word must not match", async () => {
      const words = "world";
      const res = words
        .replaceAll(/[^\w\s]+/g, "")
        .split(/\s+/)
        .map((w) => new RegExp(w, "i"));
      await addAll(C, USERS, ROOMS, MSGS);
      for (const [ri, r] of ROOMS.entries()) {
        const { roomName } = r;
        const msgResult = await C.findChatMsgs({ roomName, words, limit: 999 });
        assert(msgResult.isOk);
        const msgs = msgResult.val;
        expect(msgs).to.have.length(0);
      }
    });

    tst.test("must find any match in words", async () => {
      const words = "hello day";
      const res = words
        .replaceAll(/[^\w\s]+/g, "")
        .split(/\s+/)
        .map((w) => new RegExp(w, "i"));
      const nExpected =
        MSGS.filter((m) => res.some((re) => re.test(m))).length * USERS.length;
      await addAll(C, USERS, ROOMS, MSGS);
      for (const [ri, r] of ROOMS.entries()) {
        const { roomName } = r;
        const msgResult = await C.findChatMsgs({ roomName, words, limit: 999 });
        assert(msgResult.isOk);
        const msgs = msgResult.val;
        expect(msgs).to.have.length(nExpected);
        for (const msg of msgs) {
          assert(res.some((re) => re.test(msg.msg)));
        }
      }
    });
  });

  tst.suite("user updates must be reflected in chat messages", () => {
    tst.test("chatName update must be reflected in chat msgs", async () => {
      const user = USERS[0];
      const userResult = await C.makeUser(user);
      assert(userResult.isOk);
      const userId = userResult.val;
      expect(typeof userId).to.equal("string");

      const room = ROOMS[0];
      const roomResult = await C.makeChatRoom(room);
      assert(roomResult.isOk);
      const roomId = roomResult.val;
      expect(typeof roomId).to.equal("string");

      const { chatName } = user;
      const { roomName } = room;

      const msgIds = [];
      for (const m of MSGS) {
        const msg = { chatName, roomName, msg: m };
        const msgResult = await C.makeChatMsg(msg);
        assert(msgResult.isOk);
        msgIds.push(msgResult.val);
      }

      const chatNameX = T.brand<T.NameX>(chatName + X);
      const updateResult = await C.updateUser(userId, { chatName: chatNameX });
      assert(updateResult.isOk);
      const updatedUser = updateResult.val;
      const expectedUser = {
        ...user,
        id: userId,
        creationTime: now,
        lastUpdateTime: now,
        chatName: chatNameX,
      };
      expect(updatedUser).to.deep.equal(expectedUser);

      //and now for the money-shot!
      for (const id of msgIds) {
        const findResult = await C.findChatMsgs({ id, roomName });
        assert(findResult.isOk);
        const chatMsgs = findResult.val;
        expect(chatMsgs).to.have.length(1);
        expect(chatMsgs[0].chatName).to.equal(chatNameX);
      }
    });
  });
});

// Utility functions

//ordering of ChatMsg for testing only
function msgCmp(m1: T.ChatMsg, m2: T.ChatMsg) {
  console.assert(m1.roomName === m2.roomName);
  return (
    m1.msg.localeCompare(m2.msg) || //depend of 0 being falsy
    m1.chatName.localeCompare(m2.chatName)
  );
}

//used for indexing ids of all pre-built messages
function idKey(roomName: T.NameX, chatName: T.NameX, msgIndex: number) {
  return `${roomName}-${chatName}-${msgIndex}`;
}

// add users, rooms and users x rooms x msgs messages to chat.
async function addAll(
  chat: Chat,
  users: T.RawUser[],
  rooms: T.RawChatRoom[],
  msgs: string[]
) {
  for (const u of users) {
    const userResult = await chat.makeUser(u);
    assert(userResult.isOk, `cannot create user ${dump(u)}`);
  }
  for (const r of rooms) {
    const roomResult = await chat.makeChatRoom(r);
    assert(roomResult.isOk, `cannot create room ${dump(r)}`);
  }
  const ids: Record<string, T.MsgIdX> = {};
  for (const u of users) {
    const { chatName } = u;
    for (const r of rooms) {
      const { roomName } = r;
      for (const [i, msg] of msgs.entries()) {
        const date = makeDate(i);
        MockDate.set(date);
        const rawChatMsg = { chatName, roomName, msg };
        const msgResult = await chat.makeChatMsg(rawChatMsg);
        assert(msgResult.isOk, `cannot create msg ${dump(rawChatMsg)}`);
        const id = msgResult.val;
        expect(typeof id).to.equal("string");
        ids[idKey(roomName, chatName, i)] = id;
      }
    }
  }
  const nIds = Object.keys(ids).length;
  expect(nIds).to.equal(users.length * rooms.length * msgs.length);
  return ids;
}

//set year as per i
function makeDate(i: number) {
  return `202${i}-04-15T13:50:32.108Z`;
}

//debugging
function dump(obj: Record<any, any>) {
  return (
    "{ " +
    Object.entries(obj)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ") +
    " }"
  );
}

//Data

const USERS: T.RawUser[] = [
  {
    firstName: T.brand<T.NameX>("joe"),
    lastName: T.brand<T.NameX>("doe"),
    email: T.brand<T.EmailX>("joe@zzz.com"),
    chatName: T.brand<T.NameX>("joe"),
  },
  {
    firstName: T.brand<T.NameX>("sue"),
    lastName: T.brand<T.NameX>("fox"),
    email: T.brand<T.EmailX>("sue@zzz.com"),
    chatName: T.brand<T.NameX>("sue"),
  },
  {
    firstName: T.brand<T.NameX>("fay"),
    lastName: T.brand<T.NameX>("coe"),
    email: T.brand<T.EmailX>("fay@zzz.com"),
    chatName: T.brand<T.NameX>("fay"),
  },
].toSorted((u1, u2) => u1.chatName.localeCompare(u2.chatName));

const ROOMS: T.RawChatRoom[] = [
  { roomName: T.brand<T.NameX>("typescript"), descr: "All things typescript" },
  { roomName: T.brand<T.NameX>("javascript"), descr: "Discuss javascript" },
  { roomName: T.brand<T.NameX>("html"), descr: "HTML Intricacies" },
].toSorted((r1, r2) => r1.roomName.localeCompare(r2.roomName));

const MSGS: string[] = [
  "Hello there! this is Tim",
  "It's a great day here; high of 70 and sunny",
  "You must grab the day",
  "Hello, have a great day",
].toSorted((str1, str2) => str1.localeCompare(str2));
