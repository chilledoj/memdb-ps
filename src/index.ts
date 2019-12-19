import _ from "lodash";
import PubSub from "PubSub";

export const chgIns = "INSERT";
export const chgUpd = "UPDATE";
export const chgDel = "DELETE";

export interface IIndexConfig {
  name: string;
  paths: string[];
}

export interface ILogMessage {
  lvl: string;
  msg: string;
  data?: any;
}

interface IIndexData {
  [key: string]: Record<string, any>;
}

interface IPubSubMessage {
  type: string;
  old?: any;
  data?: any;
}
type subscriberCallback = (msg: any, data: any) => void;

interface IPubSubber {
  publish(topic: string, data: IPubSubMessage): void;
  subscribe(topic: string, callback: subscriberCallback): number;
  unsubscribe(token: number): void;
}

export class MemDBTable {
  private name: string;
  private pkPath: string;
  private data: Record<string, any>;
  private idxConfig: Record<any, any>;
  private idxPk: IIndexData;
  private log: ILogMessage[];
  private ps: IPubSubber;
  constructor(name: string, pkPath: string) {
    this.name = name;
    this.pkPath = pkPath;
    this.data = new Map();
    this.idxConfig = new Map();
    this.idxPk = {};
    this.ps = new PubSub();
    this.log = [];
  }

  public createIndex(config: IIndexConfig) {
    const name = config.name;
    this.idxConfig.set(name, config);
    this.idxPk[name] = new Map();
    this.logDebug({ msg: `created index ${name}` });
    // populate index if creating after data is added
    if (this.data.size === 0){
      return this; // allow chaining
    } 
    this.data.forEach((row: any) => {
      this._populateIndex(name, row);
    });
  }
  public dropIndex(idxName: string) {
    if (!this.idxConfig.has(idxName)) {
      this.logInfo(`index ${idxName} does not exist`);
      throw new Error("index does not exist");
    }
    this.idxConfig.delete(idxName);
    delete this.idxPk[idxName];
  }

  // CRUD
  public insert(data: any) {
    const pk = this._extractPk(data);
    if (this.data.has(pk)) {
      this.logError({ msg: `primary key ${pk} already exists` });
      throw new Error("primary key violation:");
    }
    this.data.set(pk, data);
    this.logDebug({ msg: `inserted DATA for PK ${pk}`, data });
    this.idxConfig.forEach((idx: IIndexConfig) => {
      this._populateIndex(idx.name, data);
    });
    this.ps.publish(this.name, {
      data,
      type: chgIns
    });
  }
  public update(pk: string, data: any) {
    const old = this.data.get(pk);
    if (!old) {
      return; // silent fail
    }
    if (_.eq(old, data)) {
      return; // NO UPDATE
    }
    this.data.set(pk, data);
    this.logDebug({ msg: `updated DATA for PK ${pk}`, data });
    this.idxConfig.forEach((idx: IIndexConfig) => {
      this._populateIndex(idx.name, old, true); // DELETE OLD INDEX REFERENCES
      this._populateIndex(idx.name, data); // ADD NEW INDEX REFERENCES
    });
    this.ps.publish(this.name, {
      data,
      old,
      type: chgUpd
    });
  }
  public delete(pk: string) {
    const old = this.data.get(pk);
    if (!old) {
      return; // silent fail!!
    }
    this.data.delete(pk);
    this.logDebug({ msg: `deleted data for pk ${pk}` });
    this.idxConfig.forEach((idx: IIndexConfig) => {
      this._populateIndex(idx.name, old, true); // DELETE OLD INDEX REFERENCES
    });
    this.ps.publish(this.name, {
      data: pk,
      type: chgDel
    });
  }
  public selectAll(): any[] {
    return Array.from(this.data.values());
  }
  public selectByPk(pk: string): any {
    return this.data.get(pk);
  }
  public selectByIndex(idxName: string, idxValues: string[]): any[] {
    const pks = new Map();
    for (const s of idxValues) {
      const pksi = this.idxPk[idxName].get(s);
      if (!pksi){
        continue;
      } 
      pksi.forEach((pk: string) => {
        pks.set(pk, this.data.get(pk));
      });
    }
    return Array.from(pks.values());
  }
  public subscribe(cb: subscriberCallback): number {
    return this.ps.subscribe(this.name, cb);
  }
  public unsubscribe(token: number) {
    return this.ps.unsubscribe(token);
  }
  public set(data: any[]) {
    const processedKeys: Set<string> = new Set();
    for (const d of data) {
      const pk = this._extractPk(d);
      processedKeys.add(pk);
      if (this.data.has(pk)) {
        this.update(pk, d);
      } else {
        this.insert(d);
      }
    }
    const dbKeys: string[] = Array.from(this.data.keys());
    const processed: string[] = Array.from(processedKeys);
    const toDelete: string[] = _.difference(dbKeys, processed);
    for (const pk of toDelete) {
      this.delete(pk);
    }
  }
  public debug() {
    return {
      data: Array.from(this.data.values()),
      pks: this.idxPk
    };
  }

  // Simple Logging
  private logDebug(data: any) {
    this.log.push({ ...data, lvl: "DEBUG" });
  }
  private logInfo(data: any) {
    this.log.push({ ...data, lvl: "INFO" });
  }
  private logError(data: any) {
    this.log.push({ ...data, lvl: "ERROR" });
  }
  // Data manipulation
  private _extractPk(data: any): string {
    return _.get(data, this.pkPath).toString();
  }
  private _populateIndex(idxName: string, data: any, del?: boolean) {
    const cfg = this.idxConfig.get(idxName);
    const key = _.at(data, cfg.paths)
      .map((item: any) => item.toString())
      .join(".");
    const pk = this._extractPk(data);
    const existing = this.idxPk[idxName].get(key);
    if (del) {
      if (!existing){
        return; // ARGH
      } 
      // DELETE FROM INDEX
      this.idxPk[idxName].set(
        key,
        existing.filter((ipk: string) => ipk !== pk)
      );
    }
    if (!existing) {
      // NEW INDEX INSERT
      this.idxPk[idxName].set(key, [pk]);
    } else if (!existing.includes(pk)) {
      // UPDATE INDEX
      this.idxPk[idxName].set(key, [...existing, pk]);
    } // else it already exists in index
  }
  

  
}

// TODO: CREATE MemDB class which holds multiple tables and can create views across tables
