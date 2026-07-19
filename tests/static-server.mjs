import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const host = "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp"
};

const server = createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname);
        let filePath = resolve(root, "." + pathname);
        if (filePath !== root && !filePath.startsWith(root + sep)) {
            response.writeHead(403).end("Forbidden");
            return;
        }
        if ((await stat(filePath)).isDirectory()) filePath = resolve(filePath, "index.html");
        const body = await readFile(filePath);
        response.writeHead(200, {
            "Cache-Control": "no-store",
            "Content-Type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream"
        });
        response.end(body);
    } catch (error) {
        response.writeHead(error?.code === "ENOENT" ? 404 : 500).end("Not found");
    }
});

server.listen(port, host, () => {
    console.log(`Finale test server: http://${host}:${port}`);
});
