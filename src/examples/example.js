const MemDBTable = require("../../dist/index").MemDBTable;
const util = require("util");
function fullDump(obj) {
  return util.inspect(obj, false, null, true);
}

let tst = new MemDBTable("test", "id");

tst.createIndex({
  name: "grp",
  paths: ["grp"]
});

let token = tst.subscribe((msg, data) => {
  console.log(
    "%s-%s:",
    data.name,
    msg.type,
    fullDump(msg.old),
    fullDump(msg.data)
  );
});
console.log("Subscription token:", token);
console.log("STARTING");
tst.set([
  { id: "0001", name: "test-01", nest: { data: 1 }, grp: "101" },
  { id: "0002", name: "test-02", nest: { data: 2 }, grp: "101" },
  { id: "0003", name: "test-03", nest: { data: 3 }, grp: "102" },
  { id: "0004", name: "test-04", nest: { data: 4 }, grp: "102" }
]);

console.log("UPDATING");

tst.set([
  { id: "0002", name: "test-02a", nest: { data: 2 }, grp: "101" },
  { id: "0003", name: "test-03a", nest: { data: 3 }, grp: "102" },
  { id: "0004", name: "test-04", nest: { data: 4 }, grp: "102" },
  { id: "0005", name: "test-05", nest: { data: 1 }, grp: "102" }
]);

console.log("TESTS: Get By Key");
let arr1 = ["0002", "0005", "x"];
arr1.forEach(element => {
  console.log(tst.selectByPk(element));
});

console.log("TESTS: Get By Index");
let arr2 = ["101", "102", "x"];
arr2.forEach(element => {
  console.log(tst.selectByIndex("grp", [element]));
});

console.log("DEBUG DUMP");
console.log(fullDump(tst.debug()));
