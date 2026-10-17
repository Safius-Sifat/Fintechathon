const feature = process.argv[2] ?? "requested feature";
console.error(
  `${feature}: acceptance/implementation is not available in the bootstrap. Follow the assigned handoff in docs/plans/.`,
);
process.exitCode = 1;
