import { makeChat } from './lib/chat.js';
import * as T from './lib/chat-types.js';

import {Errors as E} from 'cs444-js-utils';
import { readJson, scriptName, cwdPath } from 'cs444-node-utils';


/************************* Top level routine ***************************/

export default async function main(args: string[]) {
  const cliArgs = new CliArgs(CMD_INFOS);
  if (args.length < 2) cliArgs.usage();
  const [ dbUrl, cmd, ...rest ] = args;
  let chat: T.Chat|null = null;
  try {
    const chatResult = await makeChat(dbUrl);
    if (!chatResult.isOk) outErrs(chatResult.err);
    chat = chatResult.val;
    const cmdArgsResult = cliArgs.getCmdArgs(cmd, rest);
    if (!cmdArgsResult.isOk) outErrs(cmdArgsResult.err);
    const cmdArgs = cmdArgsResult.val;
    const result = await dispatch(chat, cmd, cmdArgs, cliArgs);
    if (result.isOk) {
      const val = result.val;
      if (val !== undefined && val !== null) {
	console.log(JSON.stringify(val, null, 2));
      }
    }
    else {
      outErrs(result.err);
    }
  }
  catch (err) {
    return E.errResult(E.errs(err as Error));
  }
  finally {
    if (chat) chat.close();
  }
}


async function dispatch(chat: T.Chat, cmd: string,
			cmdArgs: Record<string, any>,
			cliArgs: CliArgs) 
{
  switch (cmd) {
    case 'make-user':
      return await chat.makeUser(cmdArgs as T.RawUser);
      break;
    case 'get-user':
      return await chat.getUser(cmdArgs.userKey as T.UserKey);
      break;
    case 'update-user':
      return await chat.updateUser(cmdArgs.id as T.UserIdX,
				   cmdArgs as Partial<T.RawUser>);
      break;
    case 'make-room':
      return await chat.makeChatRoom(cmdArgs as T.RawChatRoom);
      break;
    case 'get-room':
      return await chat.getChatRoom(cmdArgs.roomKey as T.RoomKey);
      break;
    case 'make-chat-msg':
      return await chat.makeChatMsg(cmdArgs as T.RawChatMsg);
      break;
    case 'find-chat-msgs':
      return await chat.findChatMsgs(cmdArgs as unknown as T.FindParams);
      break;
    case 'load-data':
      return await loadJsonData(chat, (cmdArgs as { path: string }).path);
      break;
    case 'clear':
      return await chat.clear();
      break;
    default:
      return cliArgs.help();
      break;
      
  }
}

class CliArgs {

  constructor(private readonly cmdInfos: Record<string, CmdInfo>) {}

  getCmdArgs(cmd: string, args: string[]) {
    const cmdInfo = this.cmdInfos[cmd];
    if (cmdInfo === undefined) {
      return E.errResult(E.errs(`unknown command ${cmd}`));
    }
    const { reqArgs = [], optArgs = [] } = cmdInfo;
    const cmdArgs: Record<string, any> = {};
    for (const arg of args) {
      const m = arg.match(/^([\w\-]+)=(.+)$/);
      if (!m) return E.errResult(E.errs(`bad arg ${arg} for command ${cmd}`));
      const [, k, v] = m;
      if (reqArgs.indexOf(k) < 0 && optArgs.indexOf(k) < 0) {
	return E.errResult(E.errs(`unknown arg ${k} for command ${cmd}`));
      }
      const argName = this.camelCaseArg(k);
      let value: any = v;
      if (argName === 'offset' || argName === 'limit') {
	value = Number(v);
      }
      else if (argName === 'userKey' || argName === 'roomKey') {
	value = JSON.parse(v);
      }
      cmdArgs[argName] = value;
    }
    const missing = reqArgs.filter(a => !cmdArgs[this.camelCaseArg(a)]);
    if (missing.length > 0) {
      return E.errResult(E.errs(`missing args ${missing.join(', ')}`));
    }
    return E.okResult(cmdArgs);
  }

  help(cmd?: string) {
    const W1 = 14, W2 = 16, W3 = 16, LEN=66;
    const cmds = cmd ? [ cmd ] : Object.keys(this.cmdInfos);
    let text = '';
    for (const cmd of cmds) {
      const {reqArgs=[], optArgs=[], help} = this.cmdInfos[cmd];
      let line = `${cmd.padStart(W1)} `;
      for (const arg of reqArgs) {
	line += `${arg}=${this.upCaseArg(arg)} `;
      }
      if (optArgs.length > 0) line += '[KEY=VAL] for KEY in';
      text += this.splitToLines(line, W2, LEN);
      line = ' '.padStart(W2);
      if (optArgs.length > 0) line += optArgs.join(', ');
      text += this.splitToLines(line, W2, LEN);
      text += this.splitToLines(' '.padStart(W3) + help, W2, LEN);
    }
    console.error(text);
    return E.okResult(undefined);
  }

  upCaseArg(a: string) { return a.replaceAll("-", "_").toUpperCase(); }

  camelCaseArg(a: string) {
    return  a.replaceAll(/\-(\w)/g, (_, x) => x.toUpperCase());
  }

  splitToLines(text0: string, indent: number, len: number) : string {
    text0 = text0.replaceAll(/\s/g, ' ');
    let initSpaceLen = text0.match(/^\s*/)![0].length;
    let text = '';
    let line = ' '.repeat(initSpaceLen);
    for (const w of text0.trim().split(/\s+/)) {
      line += w + ' ';
      if (line.length > len) {
	text += line + '\n';
	line = ' '.repeat(indent);
      }
    }
    if (line.trim().length > 0) text += line + '\n';
    return text;
  }

  usage() : never {
    console.error(`${scriptName()} DB_URL CMD ...`);
    console.error('for CMD in');
    this.help();		  
    process.exit(1);
  }

  
}

type CmdInfo = {
  reqArgs?: string[],
  optArgs?: string[],
  help: string,
};

const CMD_INFOS: Record<string, CmdInfo> = {
  'make-user': {
    reqArgs: [ 'chat-name', 'email', 'first-name', 'last-name' ],
    help: 'Make a new user and print its newly created ID.',
  },
  'get-user': {
    reqArgs: [ 'user-key' ],
    help: 'Output all info for chat-user specified by USER_KEY, ' +
    'which must be legal JSON for a key-value pair for id, chatName ' +
    'or email keys',
  },
  'update-user': {
    reqArgs: ['id'],
    optArgs: [ 'chat-name', 'email', 'first-name', 'last-name' ],
    help: 'Update user specified by ID with KEY=VAL params',
  },
  'make-room': {
    reqArgs: [ 'descr', 'room-name', ],
    help: 'Make a new char-room and print its newly created ID.',
  },
  'get-room': {
    reqArgs: [ 'room-key' ],
    help: 'Output all info for chat-room specified by ROOM_KEY, ' +
    'which must be legal JSON for a key-value pair for id or ' +
    'roomName keys',
  },
  'make-chat-msg': {
    reqArgs: [ 'chat-name', 'msg', 'room-name', ],
    help: 'Add a new chat-message MSG to chat-room ROOM_NAME ' +
          'on behalf of user CHAT_NAME',
  },
  'find-chat-msgs': {
    reqArgs: [ 'room-name' ],
    optArgs: [ 'id', 'chat-name', 'words', 'earliest', 'latest',
	      'offset', 'limit'
	     ],
    help: 'Find all chat messages which satisfy the parameters.',
  },
  'load-data': {
    reqArgs: [ 'path' ],
    help: 'Replace all data with data read from JSON PATH',
  },
  'clear': {
    help: 'Clear out all data.',
  },
  'help': {
    help: 'Print this message',
  },
};


/************************* Load Data from File *************************/

type ChatData = {
  users: T.User[],
  rooms: T.ChatRoom[],
  chatMsgs: T.ChatMsg[],
};

type Counts = {
  userCount: number,
  roomCount: number,
  msgCount: number,
};

async function loadJsonData(chat: T.Chat, jsonPath: string)
  : Promise<E.Result<Counts, E.Errs>>
{
  const jsonResult = await readJson(jsonPath);
  if (!jsonResult.isOk) return E.toErrs(jsonResult.into<Counts>());
  const clearResult = await chat.clear();
  if (!clearResult.isOk) return clearResult.into<Counts>();
  const counts: Counts = { userCount: 0, roomCount: 0, msgCount: 0 };
  const data = jsonResult.val as ChatData;
  for (const user of data.users) {
    const userResult = await chat.makeUser(user);
    if (!userResult.isOk) return userResult.into<Counts>();
    counts.userCount++;
  }
  for (const room of data.rooms) {
    const roomResult = await chat.makeChatRoom(room);
    if (!roomResult.isOk) return roomResult.into<Counts>();
    counts.roomCount++;
  }
  for (const msg of data.chatMsgs) {
    const msgResult = await chat.makeChatMsg(msg);
    if (!msgResult.isOk) return msgResult.into<Counts>();
    counts.msgCount++;
  }
  return E.okResult(counts);
}

/**************************** Output Routines **************************/

function outResult(result: E.Result<void, E.Err>) {
  if (result.isOk) {
    console.log('ok');
  }
  else {
    console.error(result.err.toString());
  }
}


/*
const MAX_DEC = 1;


function roundValues(table: Table) {
  const rounded = [];
  for (const row of table) {
    const roundedRow : {[colId: string]: number|string} = {};
    for (const [colId, val] of Object.entries(row)) {
      const rounded: number|string =
	Number(val) && /\./.test(val.toString())
	? Number((val as number).toFixed(MAX_DEC))
        : val;
      roundedRow[colId] = rounded;
    }
    rounded.push(roundedRow);
  }
  return rounded;
}
*/

/*
function outData(data: T.SectionData, outFmt: string) {
  switch (outFmt) {
    case 'text':
      outTextTable(data);
      break;
    case 'js':
      console.log(data);
      break;
    case 'json':
      console.log(JSON.stringify(data));
      break;
    case 'json2':
      console.log(JSON.stringify(data, null, 2));
      break;
  }
}

function outTextTable(table: T.SectionData) {
  const out = (...args: any[]) => console.log(...args);
  const widths = colWidths(table);
  out(Object.keys(widths).map(k => k.padStart(widths[k])).join(' '));
  for (const row of Object.values(table)) {
    const items = [];
    for (const [k, w] of Object.entries(widths)) {
      const val = (row[k as T.ColId] ?? '').toString();
      items.push(NUM_RE.test(val) ? val.padStart(w) : val.padEnd(w));
    }
    out(items.join(' '));
  }
}
  
function colWidths(table: T.SectionData) : { [colId: string]: number } {
  const widths : { [colId: string]: number } = {};
  for (const row of Object.values(table)) {
    for (const [k, v] of (Object.entries(row))) {
      widths[k] ??= k.length;
      const vLen = (v ?? '').toString().length;
      if (widths[k] < vLen) widths[k] = vLen;
    }
  }
  return widths;
}
*/

/******************************* Utilities *****************************/


function outErrs(err: E.Errs) : never {
  console.error(err.toString());
  process.exit(1);
}

function error(...args: any[]): never {
  console.error(...args);
  process.exit(1);
}
  
