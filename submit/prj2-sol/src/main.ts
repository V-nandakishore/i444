import * as T from './lib/chat-types.js';
import { makeChat } from './lib/chat.js';
import { ChatDao, makeChatDao } from './lib/chat-dao.js';

import { Errors as E } from 'cs444-js-utils';

import { serve, App, } from './lib/chat-ws.js';

import assert from 'assert';
import fs from 'fs';
import fs1 from 'fs/promises';

import util from 'util';
import https from 'https';
import Path from 'path';

export default function () { return main(process.argv.slice(2)); }

async function main(args: string[]) {
  if (args.length < 1) usage();
  const config = (await import(cwdPath(args[0]))).default;
  const port: number = config.ws.port;
  if (port < 1024) {
    usageError(`bad port ${port}: must be >= 1024`);
  }
  try {
    const servicesResult = await makeChat(config.service.dbUrl);
    if (!servicesResult.isOk) panic(servicesResult);
    const chat = servicesResult.val;
    if (args.length > 1) {
      const loadResult = await loadData(chat, args.slice(1));
      if (!loadResult.isOk) panic(loadResult);
    }
    const {app, close: closeApp} = serve(chat, config.ws);
    const serverOpts = {
      key: fs.readFileSync(config.https.keyPath),
      cert: fs.readFileSync(config.https.certPath),
    };
    const server = https.createServer(serverOpts, app)
      .listen(config.ws.port, function() {
	console.log(`listening on port ${config.ws.port}`);
      });
    //terminate using SIGINT ^C
    //console.log('enter EOF ^D to terminate server');
    //await readFile(0, 'utf8');
    //closeApp(); server.close(); 
  }
  catch (err) {
    console.error(err);
    process.exit(1);
  }
  finally {
    //if (dao) await dao.close();
  }
}

type Data = {
  users?: T.RawUser[],
  rooms?: T.RawChatRoom[],
  msgs?: T.RawChatMsg[],
};

async function loadData(chat: T.Chat, jsonPaths: string[])
  : Promise<E.Result<void, E.Errs>>
{
  const clearResult = await chat.clear();
  if (!clearResult.isOk) return clearResult;
  for (const jsonPath of jsonPaths) {
    const readResult: E.Result<any, E.Errs> = await readJson(jsonPath);
    if (!readResult.isOk) return readResult;
    const data: Data = readResult.val;
    for (const u of (data.users ?? [])) {
      const makeResult = await chat.makeUser(u);
      if (!makeResult.isOk) return makeResult;
    }
    for (const r of (data.rooms ?? [])) {
      const makeResult = await chat.makeChatRoom(r);
      if (!makeResult.isOk) return makeResult;
    }
    for (const m of (data.msgs ?? [])) {
      const makeResult = await chat.makeChatMsg(m);
      if (!makeResult.isOk) return makeResult;
    }
  }
  return E.okResult(undefined);
}

/** Output usage message to stderr and exit */
function usage() : never  {
  const prog = Path.basename(process.argv[1]);
  console.error(`usage: ${prog} CONFIG_MJS [USERS_JSON_PATH...]`);
  process.exit(1);
}

function usageError(err?: string) {
  if (err) console.error(err);
  usage();
}

function panic<T>(result: E.Result<T, E.Errs>) : never {
  assert(result.isOk === false);
  console.error(result.err.toString());
  process.exit(1);
}


export async function readJson(path: string) : Promise<E.Result<any, E.Errs>> {
  let text : string;
  try {
    text = await fs1.readFile(path, 'utf8');
  }
  catch (e) {
    const msg = `unable to read ${path}: ${(e as Error).message}`;
    return E.errResult(E.errs(msg));
  }
  try {
    if (path.endsWith('.jsonl')) {
      text = '[' + text.trim().replace(/\n/g, ',') + ']';
    }
    return E.okResult(JSON.parse(text));
  }
  catch (e) {
    const msg = `unable to parse JSON from ${path}: ${(e as Error).message}`;
    return E.errResult(E.errs(msg));
  }
}

export function cwdPath(path: string) : string {
  return (path.startsWith(Path.sep)) ? path : Path.join(process.cwd(), path);
}


export function abort(msg: string, ...args: any[]) : never {
  const text = msg + args.map(a => JSON.stringify(a)).join(' ');
  console.error(text);
  process.exit(1);
}
