// 앱스 스크립트 본체(gas/*.js)를 가짜 구글 서비스(시트·드라이브 등) 위에서 돌리는 도우미.
// 파일 이름이 .test.js가 아니라서 npm test가 직접 실행하지 않는다.
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import vm from "node:vm";

export const CLIENT_ID = "123-abc.apps.googleusercontent.com";

class FakeRange {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) row.push(this.sheet.data[this.r - 1 + i]?.[this.c - 1 + j] ?? "");
      out.push(row);
    }
    return out;
  }
  setValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.sheet.set(this.r + i, this.c + j, x))); return this; }
  setValue(x) { this.sheet.set(this.r, this.c, x); return this; }
  setFontWeight() { return this; }
  setBackground() { return this; }
}
class FakeSheet {
  constructor(name) { this.name = name; this.data = []; this.hidden = false; }
  getName() { return this.name; }
  set(r, c, x) { while (this.data.length < r) this.data.push([]); this.data[r - 1][c - 1] = x; }
  getLastRow() { return this.data.length; }
  getRange(r, c, nr = 1, nc = 1) { return new FakeRange(this, r, c, nr, nc); }
  getDataRange() {
    const nc = Math.max(1, ...this.data.map((row) => row.length));
    return new FakeRange(this, 1, 1, Math.max(1, this.data.length), nc);
  }
  appendRow(row) { this.data.push([...row]); }
  deleteRow(r) { this.data.splice(r - 1, 1); }
  setFrozenRows() {}
  autoResizeColumns() {}
  hideSheet() { this.hidden = true; }
}
class FakeSpreadsheet {
  constructor() { this.sheets = [new FakeSheet("시트1")]; }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) ?? null; }
  insertSheet(n) { const s = new FakeSheet(n); this.sheets.push(s); return s; }
  getSheets() { return [...this.sheets]; }
  deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
  setActiveSheet() {}
}

/** 가짜 서비스를 만들고 gas 파일을 불러온다. 돌려주는 도우미로 요청을 보내고 시트를 들여다본다. */
export function createGas() {
  const ss = new FakeSpreadsheet();
  const tokens = {};
  const props = {};
  const drive = { folders: {}, files: {}, nextId: 1 };
  const blob = (bytes, type, name) => ({ bytes, type, name, getBytes: () => bytes, getContentType: () => type });

  const ctx = {
    console: { error() {}, log() {} },
    Logger: { log() {} },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => { throw new Error("화면 없음"); } },
    UrlFetchApp: {
      fetch(url) {
        const t = decodeURIComponent(url.split("id_token=")[1] || "");
        const claims = tokens[t];
        return { getResponseCode: () => (claims ? 200 : 400), getContentText: () => JSON.stringify(claims ?? { error: "invalid" }) };
      },
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); } }),
    },
    DriveApp: {
      createFolder(name) {
        const id = `folder-${drive.nextId++}`;
        const folder = {
          name,
          getId: () => id,
          createFile(b) {
            const fid = `file-${drive.nextId++}`;
            drive.files[fid] = { ...b, folder: id };
            return { getId: () => fid };
          },
        };
        drive.folders[id] = folder;
        return folder;
      },
      getFolderById(id) {
        if (!drive.folders[id]) throw new Error("폴더 없음");
        return drive.folders[id];
      },
      getFileById(id) {
        const f = drive.files[id];
        if (!f) throw new Error("파일 없음");
        return { getBlob: () => blob(f.bytes, f.type, f.name) };
      },
    },
    Utilities: {
      getUuid: () => randomUUID(),
      DigestAlgorithm: { SHA_256: "sha256" },
      Charset: { UTF_8: "utf8" },
      computeDigest: (alg, text) => [...createHash("sha256").update(text, "utf8").digest()].map((b) => (b > 127 ? b - 256 : b)),
      formatDate: () => "11.13 21:00",
      base64Decode: (s) => [...Buffer.from(s, "base64")],
      base64Encode: (bytes) => Buffer.from(bytes.map((b) => (b + 256) % 256)).toString("base64"),
      newBlob: (bytes, type, name) => blob(bytes, type, name),
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (s) => ({ content: s, setMimeType() { return this; } }),
    },
  };
  vm.createContext(ctx);
  for (const f of ["../../gas/Auth.js", "../../gas/Game.js", "../../gas/Code.js"]) {
    vm.runInContext(readFileSync(new URL(f, import.meta.url), "utf8"), ctx);
  }

  const sheet = (n) => ss.getSheetByName(n);
  const g = {
    ss, ctx, drive, props, sheet,
    call: (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).content),
    setSetting(key, value) {
      const s = sheet("설정");
      const i = s.data.findIndex((r) => r[0] === key);
      s.data[i][1] = value;
    },
    googleToken(email) {
      const t = `token-${email}-${Math.random()}`;
      tokens[t] = { aud: CLIENT_ID, iss: "https://accounts.google.com", email, email_verified: "true", exp: String(Math.floor(Date.now() / 1000) + 600) };
      return t;
    },
    /** 명단에 넣고 로그인까지 해서 세션 토큰을 돌려준다. */
    login(email, name) {
      sheet("학생명단").appendRow([email, name, "2026-11-13", ""]);
      return g.call({ action: "login", idToken: g.googleToken(email) }).session;
    },
  };
  ctx.setupSheets();
  g.setSetting("로그인 클라이언트 ID", CLIENT_ID);
  return g;
}
