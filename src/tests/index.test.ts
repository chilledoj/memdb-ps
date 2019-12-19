import { MemDBTable } from "../index";
const singleRow = { id: "1", name: "t1" };

describe("MemDbTable", () => {
  test("select::OneRow", () => {
    const db = new MemDBTable("test", "id");
    db.set([singleRow]);
    expect(db.selectAll().length).toEqual(1);
    expect(db.selectByPk(singleRow.id).name).toEqual(singleRow.name);
  });

  test("insert", () => {
    const db = new MemDBTable("test", "id");
    expect(() => {
      db.insert(singleRow);
    }).not.toThrow("primary");
    expect(() => {
      db.insert(singleRow);
    }).toThrow("primary key");
  });

  test("update", () => {
    const db = new MemDBTable("test", "id");
    db.insert(singleRow);
    expect(() => {
      db.update(singleRow.id, singleRow);
    }).not.toThrow("no change");
    expect(() => {
      db.update(singleRow.id, {
        ...singleRow,
        newField: "testing"
      });
    }).not.toThrow("not exists");
    expect(() => {
      db.update("NOT EXIST", {
        id: "NOT EXIST",
        newField: "testing"
      });
    }).not.toThrow("not exists");
  });

  test("delete", () => {
    const db = new MemDBTable("test", "id");
    db.insert(singleRow);
    expect(() => {
      db.delete(singleRow.id);
    }).not.toThrow("no change");
    expect(() => {
      db.delete(singleRow.id);
    }).not.toThrow("exist");
  });
  describe("set", () => {
    // TODO
  });
  describe("pubsub", () => {
    // TODO
  });
  describe("indexes", () => {
    let db: MemDBTable;
    beforeEach(() => {
      db = new MemDBTable("test", "id");
    });
    test("createIndex", () => {
      expect(() => {
        db.createIndex({
          name: "grp",
          paths: ["id"]
        });
      }).not.toThrow("error");
      const state = db.debug();
      expect(state.pks).toHaveProperty("grp");
    });
    test("addData", () => {
      const grp = "grp",
        group = "101";
      const newRow = {
        id: "2",
        name: "t2",
        [grp]: group
      };

      expect(() => {
        db.createIndex({
          name: grp,
          paths: [grp]
        });
        db.insert(singleRow);
      }).not.toThrow("error");
      let state = db.debug();
      expect(state.pks).toHaveProperty("grp");
      expect(state.pks[grp].has(group)).toBeFalsy();
      expect(() => {
        db.insert(newRow);
      }).not.toThrow("primary");
      state = db.debug();
      expect(state.pks[grp].has(group)).toBeTruthy();
      expect(state.pks[grp].get(group)).toContain(newRow.id);
      expect(state.pks[grp].get(group)).not.toContain(singleRow.id);
    });
  });
});
