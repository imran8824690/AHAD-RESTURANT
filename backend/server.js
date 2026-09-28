import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontendDirectory = path.join(projectDirectory, "frontend");
const dataDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "data");
const reservationsFile = path.join(dataDirectory, "reservations.json");
const port = Number(process.env.PORT || 3000);
const maxRequestBytes = 16 * 1024;
const reservationTimes = new Set([
  "5:00 pm", "5:30 pm", "6:00 pm", "6:30 pm", "7:00 pm",
  "7:30 pm", "8:00 pm", "8:30 pm", "9:00 pm"
]);
const guestOptions = new Set([
  "1 guest", "2 guests", "3 guests", "4 guests", "5 guests", "6 guests", "7+ guests"
]);

let writeQueue = Promise.resolve();

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  if (!request.headers["content-type"]?.includes("application/json")) {
    throw new HttpError(415, "Send reservation details as JSON.");
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > maxRequestBytes) throw new HttpError(413, "The request is too large.");
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "The request body must contain valid JSON.");
  }
}

function validateReservation(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpError(400, "Reservation details are required.");
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const date = typeof input.date === "string" ? input.date.trim() : "";
  const time = typeof input.time === "string" ? input.time.trim() : "";
  const guests = typeof input.guests === "string" ? input.guests.trim() : "";

  if (name.length < 2 || name.length > 100) {
    throw new HttpError(400, "Enter a name between 2 and 100 characters.");
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Enter a valid email address.");
  }

  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  const today = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
    || Number.isNaN(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== date
    || date < today) {
    throw new HttpError(400, "Choose a valid date that is today or later.");
  }
  if (!reservationTimes.has(time)) throw new HttpError(400, "Choose one of the available reservation times.");
  if (!guestOptions.has(guests)) throw new HttpError(400, "Choose a valid party size.");

  return { name, email, date, time, guests };
}

async function persistReservation(reservation) {
  const operation = writeQueue.then(async () => {
    let reservations = [];
    try {
      reservations = JSON.parse(await readFile(reservationsFile, "utf8"));
      if (!Array.isArray(reservations)) throw new Error("Reservation data must be an array.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    reservations.push(reservation);
    const temporaryFile = `${reservationsFile}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryFile, `${JSON.stringify(reservations, null, 2)}\n`, "utf8");
      await rename(temporaryFile, reservationsFile);
    } finally {
      await rm(temporaryFile, { force: true });
    }
  });

  writeQueue = operation.catch(() => {});
  await operation;
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
  }[extension] || "application/octet-stream";
}

async function serveFrontend(request, response, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    sendJson(response, 400, { error: "Invalid URL path." });
    return;
  }

  const requestedFile = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = path.resolve(frontendDirectory, requestedFile);
  if (!filePath.startsWith(`${frontendDirectory}${path.sep}`)) {
    sendJson(response, 403, { error: "Forbidden." });
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypeFor(filePath),
      "X-Content-Type-Options": "nosniff"
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    throw error;
  }
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (url.pathname === "/api/reservations" && request.method === "POST") {
    const details = validateReservation(await readJsonBody(request));
    const reservation = { id: randomUUID(), ...details, createdAt: new Date().toISOString() };
    await persistReservation(reservation);
    sendJson(response, 201, {
      message: "Your request has been received. We'll contact you to confirm.",
      reservation: { id: reservation.id, date: reservation.date, time: reservation.time, guests: reservation.guests }
    });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "API endpoint not found." });
    return;
  }

  await serveFrontend(request, response, url.pathname);
}

await mkdir(dataDirectory, { recursive: true });

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    sendJson(response, error instanceof HttpError ? error.statusCode : 500, {
      error: error instanceof HttpError ? error.message : "The server could not process this request."
    });
    if (!(error instanceof HttpError)) console.error(error);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`AHAD RESTAURANT is running at http://127.0.0.1:${port}`);
});