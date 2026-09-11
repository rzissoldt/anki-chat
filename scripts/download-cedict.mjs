import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";

const directory = path.join(process.cwd(), "data");

await mkdir(directory, { recursive: true });

await downloadCedict();
await downloadHandedict();

async function downloadCedict() {
  const url = "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz";
  const destination = path.join(directory, "cedict_ts.u8");
  const temporary = `${destination}.tmp`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`CC-CEDICT download failed with HTTP ${response.status}`);
    const compressed = Buffer.from(await response.arrayBuffer());
    await writeFile(temporary, gunzipSync(compressed));
    await rename(temporary, destination);
    console.log(`CC-CEDICT downloaded to ${destination}`);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function downloadHandedict() {
  const url = "https://raw.githubusercontent.com/gugray/HanDeDict/master/handedict.u8";
  const destination = path.join(directory, "handedict.u8");
  const temporary = `${destination}.tmp`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HanDeDict download failed with HTTP ${response.status}`);
    const raw = await response.text();
    // Keep entry lines only; history comments inflate the file ~5x.
    const entries = raw
      .split(/\r?\n/)
      .map((line) => line.replace(/^\uFEFF/, ""))
      .filter((line) => line && !line.startsWith("#"))
      .join("\n");
    await writeFile(temporary, `${entries}\n`);
    await rename(temporary, destination);
    console.log(`HanDeDict downloaded to ${destination}`);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
