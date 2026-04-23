import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import fs from "fs";
import { s3 } from "./archive.js";

const app = express();
const upload = multer({ dest: "/tmp" });

app.use(express.json());

/* -------------------------------------------------
   Upload Queue (local + URL)
------------------------------------------------- */

let queue = [];
let running = false;
let sseClients = [];

function broadcast(msg) {
  sseClients.forEach(c =>
    c.write(`data: ${JSON.stringify(msg)}\n\n`)
  );
}

async function processQueue() {
  if (running || queue.length === 0) return;
  running = true;

  const job = queue.shift();
  broadcast({ name: job.name, status: "started" });

  try {
    if (job.type === "file") {
      await s3.putObject({
        Bucket: job.identifier,
        Key: job.name,
        Body: fs.createReadStream(job.path)
      }).promise();
    } else {
      const r = await fetch(job.url);
      await s3.putObject({
        Bucket: job.identifier,
        Key: job.name,
        Body: r.body,
        ContentType: r.headers.get("content-type")
      }).promise();
    }

    broadcast({ name: job.name, status: "completed" });
  } catch {
    broadcast({ name: job.name, status: "failed" });
  }

  running = false;
  processQueue();
}

/* -------------------------------------------------
   SSE Endpoint
------------------------------------------------- */

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  sseClients.push(res);
  req.on("close", () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

/* -------------------------------------------------
   Local Upload
------------------------------------------------- */

app.post("/api/upload", upload.single("file"), (req, res) => {
  const identifier = process.env.ARCHIVE_IDENTIFIER_PREFIX + Date.now();

  queue.push({
    type: "file",
    identifier,
    name: req.file.originalname,
    path: req.file.path
  });

  processQueue();
  res.json({ queued: true, identifier });
});

/* -------------------------------------------------
   URL Upload
------------------------------------------------- */

app.post("/api/upload-url", (req, res) => {
  const { url } = req.body;
  if (!url || !url.startsWith("https://")) {
    return res.status(400).json({ error: "HTTPS URL required" });
  }

  const identifier = process.env.ARCHIVE_IDENTIFIER_PREFIX + Date.now();

  queue.push({
    type: "url",
    identifier,
    url,
    name: url.split("/").pop()
  });

  processQueue();
  res.json({ queued: true, identifier });
});

/* -------------------------------------------------
   Folder Tree (File Manager)
------------------------------------------------- */

function buildTree(files) {
  const tree = {};
  for (const f of files || []) {
    if (!f.name) continue;

    let node = tree;
    f.name.split("/").forEach((p, i, arr) => {
      node[p] ??= i === arr.length - 1 ? { __file: f } : {};
      node = node[p];
    });
  }
  return tree;
}

app.get("/api/tree/:id", async (req, res) => {
  const r = await fetch(
    `https://archive.org/metadata/${req.params.id}`
  );
  const data = await r.json();
  res.json(buildTree(data.files));
});

/* -------------------------------------------------
   WebDAV with Basic Auth
------------------------------------------------- */

function webdavAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    res.setHeader("WWW-Authenticate", "Basic");
    return res.status(401).end();
  }

  const [u, p] = Buffer.from(auth.split(" ")[1], "base64")
    .toString()
    .split(":");

  if (
    u === process.env.WEBDAV_USER &&
    p === process.env.WEBDAV_PASS
  ) return next();

  res.status(403).end();
}

app.use("/webdav", webdavAuth, async (req, res) => {
  if (req.method === "PUT") {
    const identifier =
      process.env.ARCHIVE_IDENTIFIER_PREFIX + Date.now();

    await s3.putObject({
      Bucket: identifier,
      Key: decodeURIComponent(req.path.slice(1)),
      Body: req
    }).promise();

    return res.status(201).end();
  }

  if (req.method === "GET") {
    const r = await fetch(
      `https://archive.org/download${req.path}`
    );
    return r.body.pipe(res);
  }

  if (req.method === "PROPFIND")
    return res.status(207).end();

  res.status(405).end();
});

app.listen(3001);
