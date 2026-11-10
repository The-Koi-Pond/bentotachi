// A hidden Edge or Chrome driven over its debugging connection (the Chrome
// DevTools Protocol), so a script can open the app's screens without adding
// a browser package. Used by the style check.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BROWSERS = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"];

// The live-updates connection never finishes; it mustn't count as loading.
const NEVER_ENDS = "/api/realtime";

function start(profileFolder) {
  const exe = [process.env.BENTO_BROWSER, ...BROWSERS].find((path) => path && existsSync(path));
  if (!exe) throw new Error("No Edge or Chrome found. Set BENTO_BROWSER to a Chromium browser's .exe.");
  // BackForwardCache off: a page kept in it keeps its live-updates connection,
  // and after six of those the browser loads nothing more from the server.
  const flags = ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profileFolder}`, "--no-first-run", "--disable-extensions", "--disable-features=BackForwardCache", "about:blank"];
  return spawn(exe, flags, { stdio: ["ignore", "ignore", "pipe"] });
}

function debuggingAddress(child) {
  return new Promise((resolve, reject) => {
    let seen = "";
    child.stderr.on("data", (chunk) => {
      seen += chunk;
      const found = seen.match(/DevTools listening on (ws:\/\/\S+)/);
      if (found) resolve(found[1]);
    });
    child.once("exit", () => reject(new Error("The browser closed before it was ready.")));
    setTimeout(() => reject(new Error("The browser didn't start.")), 20_000);
  });
}

// Opens the browser with its profile in `profileFolder` and one blank page.
// Returns: send(method, params) for a page command, evaluate(expression),
// open(url, ready) for a full fresh load, errors (what the app itself
// threw), and close(), which never throws.
export async function openBrowser(profileFolder) {
  const child = start(profileFolder);
  let exited = false;
  child.once("exit", () => (exited = true));
  const close = async () => {
    if (exited) return;
    const gone = new Promise((resolve) => child.once("exit", resolve));
    child.kill();
    await Promise.race([gone, wait(5000)]);
  };

  try {
    const socket = new WebSocket(await debuggingAddress(child));
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = () => reject(new Error("Couldn't connect to the browser."));
    });

    let lastId = 0;
    let session = null;
    const waiting = new Map();
    const errors = [];
    const loading = new Set();
    let lastActivity = Date.now();

    // `toBrowser` for the few commands about the browser itself, not the page.
    const send = (method, params = {}, { toBrowser = false } = {}) =>
      new Promise((resolve, reject) => {
        if (socket.readyState !== WebSocket.OPEN) return reject(new Error("The browser's connection closed."));
        const id = ++lastId;
        waiting.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params, ...(!toBrowser && session ? { sessionId: session } : {}) }));
      });
    // A browser that dies mid-run must fail the run, not hang it.
    socket.onclose = () => {
      for (const asker of waiting.values()) asker.reject(new Error("The browser's connection closed."));
      waiting.clear();
    };
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const asker = waiting.get(message.id);
        waiting.delete(message.id);
        if (message.error) asker?.reject(new Error(message.error.message));
        else asker?.resolve(message.result);
        return;
      }
      const params = message.params;
      if (message.method === "Runtime.exceptionThrown") {
        errors.push(params.exceptionDetails.exception?.description?.split("\n").slice(0, 3).join(" ") ?? params.exceptionDetails.text);
      } else if (message.method === "Page.javascriptDialogOpening") {
        send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {
          // "Leave without saving?" answered yes; if the page already moved on, there's nothing to answer.
        });
      } else if (message.method === "Network.requestWillBeSent") {
        lastActivity = Date.now();
        if (!params.request.url.includes(NEVER_ENDS)) loading.add(params.requestId);
      } else if (message.method === "Network.loadingFinished" || message.method === "Network.loadingFailed") {
        lastActivity = Date.now();
        loading.delete(params.requestId);
      }
    };

    const { targetId } = await send("Target.createTarget", { url: "about:blank" }, { toBrowser: true });
    session = (await send("Target.attachToTarget", { targetId, flatten: true }, { toBrowser: true })).sessionId;
    for (const domain of ["Page", "Runtime", "Network"]) await send(`${domain}.enable`);

    const evaluate = async (expression) => {
      const answer = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (answer.exceptionDetails) throw new Error(answer.exceptionDetails.exception?.description ?? answer.exceptionDetails.text);
      return answer.result.value;
    };

    // Nothing loading, and nothing started or finished for `quiet` ms: what
    // the screen fetched is on it. `.tabbar` alone isn't enough; the app's
    // frame shows before a page's own data, over a "Loading…" line.
    const settled = async (quiet = 350, limit = 15_000) => {
      const began = Date.now();
      while (Date.now() - began < limit) {
        if (!loading.size && Date.now() - lastActivity >= quiet) return true;
        await wait(50);
      }
      return false;
    };

    // A full fresh load, so nothing an earlier tap left open carries over.
    const open = async (url, ready) => {
      await send("Page.navigate", { url: "about:blank" });
      loading.clear();
      await send("Page.navigate", { url });
      let shown = false;
      for (let i = 0; i < 100 && !shown; i++) {
        try {
          shown = await evaluate(`location.href !== "about:blank" && !!document.querySelector(${JSON.stringify(ready)})`);
        } catch {
          // The page is still changing over: ask again.
        }
        if (!shown) await wait(100);
      }
      if (shown && (await settled())) return;
      const page = await evaluate(`location.href + ", showing: " + (document.body.innerText.slice(0, 200).replace(/\\s+/g, " ") || "nothing")`).catch((err) => err.message);
      throw new Error(`${url} ${shown ? "never finished loading" : `never showed ${ready}`}. The page is at ${page}${errors.length ? `\nThe app's last error: ${errors.at(-1)}` : ""}`);
    };

    return { send, evaluate, open, settled, errors, close };
  } catch (err) {
    await close();
    throw err;
  }
}
