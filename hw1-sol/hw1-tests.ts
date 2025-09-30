#!/usr/bin/env bun

//using node produces too much noise
//#!/usr/bin/env -S node --experimental-strip-types 

import assert from "node:assert";
import FNS from './hw1-sol.ts';

type TestCase = {
  args: any[],
  result: any,
};

type FnTests = {
  fn: Function,
  tests: TestCase[],
};

// remove comments for fn tests when that fn is implemented
const FN_TESTS = [
  /*
  { fn: FNS.sortStrChars,
    tests: [
      { args: [ 'hello world' ], result: ' dehllloorw' },
      { args: [ '' ],  result: '' },
      { args: [ 'hello\n\tworld' ], result: '\t\ndehllloorw' },
    ]
  },
  { fn: FNS.wordLengths,
    tests: [
      { args: [ 'Twas brillig and the slithy toves' ],
	result: [ 4, 7, 3, 3, 6, 5 ],
      },
      { args: [ ' T a ' ],
	result: [ 1, 1, ],
      },
      { args: [ '    ' ],
	result: [],
      },
      { args: [ '' ],
	result: [],
      },
    ]
  },
  { fn: FNS.selectWords,
    tests: [
      { args: [ 'Twas brillig and the slithy toves' ],
	result: [ 'Twas', 'brillig', 'and', 'the', 'slithy', 'toves' ]
      },
      { args: [ 'Twas brillig and the slithy toves', 2 ],
	result: [ 'Twas', 'slithy' ]
      },
      { args: [ 'Twas brillig and the slithy toves', 5 ],
	result: [ 'toves' ]
      },
      { args: [ 'Twas brillig and the slithy toves', 8 ],
	result: [ ]
      },
      { args: [ '  ', ],
	result: [ ]
      },
    ]
  },
  { fn: FNS.casedWords,
    tests: [
      { args: ['twas brillig and the slithy toves' ],
	result: [ 'twas', 'Brillig', 'And', 'The', 'slithy', 'Toves' ]
      },
      { args: [ 'TWAS BRILLIG AND THE SLITHY TOVES' ],
	result: [ 'twas', 'Brillig', 'And', 'The', 'slithy', 'Toves' ]
      },
      { args: [ '@twas br2ill4ig and the slithy toves' ],
	result: [ '@twas', 'Br2ill4ig', 'And', 'The', 'slithy', 'Toves' ]
      },
      { args: [ '@ x' ],
	result: [ '@', 'X' ]
      },
      { args: ['  '],
	result: []
      },
    ]
  },
  { fn: FNS.alternatingCase,
    tests: [
      { args: [ 'twas brillig and the slithy toves' ],
	result:  [ 'tWaS', 'BrIlLiG', 'AnD', 'ThE', 'sLiThY', 'ToVeS' ]
      },
      { args: [ 'twas\' brillig and the slithy toves' ],
	result:  [ "TwAs'", 'BrIlLiG', 'AnD', 'ThE', 'sLiThY', 'ToVeS' ]
      },
      { args: [ ' 123ab ' ],
	result:  [ '123aB' ]
      },
      { args: [ '  ' ],
	result:  []
      },
    ]
  },
  { fn: FNS.rotAlphabets,
    tests: [
      { args: [ "'Twas brillig and the slithy toves" ],
	result:  "'Gjnf oevyyvt naq gur fyvgul gbirf"
      },
      { args: [ "'Gjnf oevyyvt naq gur fyvgul gbirf" ],
	result:  "'Twas brillig and the slithy toves"
      },
      { args: [ "0 Az @", 3 ],
	result:  '0 Dc @'
      },
      { args: [ "0 @", 3 ],
	result:  '0 @'
      },
      { args: [ "", 3 ],
	result:  ''
      },
    ]
  },
  { fn: FNS.wordLenPoly,
    tests: [
      { args: [ 'a a a a', 2 ],
	result:  15
      },
      { args: [ 'a aa aaa aaaa', 10 ],
	result:  4321
      },
      { args: [ '@ @@ @@@ @', 10 ],
	result:  1321
      },
      { args: [ ' @@ ', 10 ],
	result:  2
      },
      { args: [ ' ', 10 ],
	result:  0
      },
    ]
  },
  { fn: FNS.map2,
    tests: [
      { args: [ (a, b) => a + b, [1, 2, 3], [3, 4, 5] ],
	result:  [ 4, 6, 8 ]
      },
      { args: [ (a, b) => a + b, [1, 2], [3, 4, 5] ],
	result:  [ 4, 6 ]
      },
      { args: [ (a, b) => a + b, [1], [3, 4, 5] ],
	result:  [ 4 ]
      },
      { args: [ (a, b) => a * b.length, [1, 2, 3],
		['twas', 'brillig', 'and', ] ],
	result:  [ 4, 14, 9 ]
      },
      { args: [ (a, b) => a + b, [], [3, 4, 5] ],
	result:  []
      },
      { args: [ (a, b) => a * b, [1, 2], [3, 4, 5] ],
	result:  [ 3, 8 ]
      },
      { args: [ (a, b) => a * b, [1, 2], [] ],
	result:  []
      },
      { args: [ (a, b) => a * b, [1, 2, 3, 4, 5, 6], [3, 4, 5] ],
	result:  [ 3, 8, 15 ]
      },
    ]
  },
  { fn: FNS.rmap2,
    tests: [
      { args: [ ( a, b ) => a*b, [3, 4, 5]  ],
	result:  [ 15, 16, 15 ]
      },
      { args: [ ( a, b ) => a/b, [3, 4, 5]  ],
	result:  [ 0.6, 1, 1.6666666666666667 ]
      },
      { args: [ ( a, b ) => a-b, [3, 4, 5]  ],
	result:  [ -2, 0, 2 ]
      },
      { args: [ ( a, b ) => a-b, [3, 4, 5, 6]  ],
	result:  [ -3, -1, 1, 3 ]
      },
      { args: [ ( a, b ) => a-b, [3]  ],
	result:  [ 0 ]
      },
      { args: [ ( a, b ) => a*b, [3]  ],
	result:  [ 9 ]
      },
      { args: [ ( a, b ) => a*b, []  ],
	result:  []
      },
    ]
  },
  { fn: FNS.partialSums,
    tests: [
      { args: [ [1, 2, 3, 4] ],
	result:  [ 1, 3, 6, 10 ]
      },
      { args: [ [1, 2, 3, 4, 5, 6, 7] ],
	result:  [ 1,  3,  6, 10, 15, 21, 28 ]
      },
      { args: [ [1, -2, 3, -4, 5, -6, 7, -8, 9] ],
	result:  [ 1,  -1,  2, -2, 3, -3, 4, -4, 5  ]
      },
      { args: [ [11, 22] ],
	result:  [ 11, 33 ]
      },
      { args: [ [11] ],
	result:  [ 11 ]
      },
      { args: [ [] ],
	result:  []
      },
    ]
  },
  { fn: FNS.partialFnAppls,
    tests: [
      { args: [ (a, b) => a + b, [1, 2, 3, 4] ],
	result:  [ 1, 3, 6, 10 ]
      },
      { args: [ (a, b) => a + b, [1, 2, 3, 4, 5, 6, 7] ],
	result:  [ 1,  3,  6, 10, 15, 21, 28 ]
      },
      { args: [ (a, b) => a - b, [1, 2, 3, 4, 5, 6, 7] ],
	result:  [ 1,  -1,  -4, -8, -13, -19, -26 ]
      },
      { args: [ (a, b) => a + b, [1, -2, 3, -4, 5, -6, 7, -8, 9] ],
	result:  [ 1,  -1,  2, -2, 3, -3, 4, -4, 5  ]
      },
      { args: [ (a, b) => a * b, [11, 22] ],
	result:  [ 11, 242 ]
      },
      { args: [ (a, b) => a + b, [11] ],
	result:  [ 11 ]
      },
      { args: [ (a, b) => a + b, [] ],
	result:  []
      },
    ]
  },
  */
];

function go(args) {
  let nErrors = 0;
  const isVerbose = args.length > 0;
  const out = isVerbose ? console.log : (...args) => {};
  for (const { fn, tests } of FN_TESTS) {
    out(`BEGIN ${fn.name}()`);
    for (const { args, result: expected } of tests) {
      const actual = fn.apply(null, args);
      const argsStr = args
	.map(a => (typeof a === 'function') ? a.toString() : JSON.stringify(a))
	.join(', ');
      const msg = `${fn.name}(${argsStr})`
      try {
	assert.deepEqual(actual, expected, msg);
	out(`    ok: ${msg}`);
      }
      catch (_) {
	out(`  fail: ${msg}`);
	nErrors++;
      }
    }
  }
  out(`# of errors = ${nErrors}`);
  process.exit(nErrors);
}

go(process.argv.slice(2));
