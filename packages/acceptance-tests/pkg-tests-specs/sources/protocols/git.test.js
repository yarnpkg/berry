// TODO: Fix tests

// describe(`Protocols`, () => {
//   describe(`git:`, () => {
//     test(
//       `it should resolve a dependency with git tag`,
//       makeTemporaryEnv(
//         {
//           dependencies: {[`left-pad`]: `git://github.com/left-pad/left-pad.git#v1.1.1`},
//         },
//         async ({path, run, source}) => {
//           await run(`install`);

//           await expect(source(`require('left-pad')`)).resolves.toMatchObject({
//             name: `left-pad`,
//             version: `1.1.0`,
//           });
//         },
//       ),
//     );
//   });
// });
