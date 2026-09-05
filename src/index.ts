import pino from "pino";
import { Elysia } from "elysia";

const log = pino();

const BANNED_SET = new Set(["dependabot[bot]"]);

const app = new Elysia();

app.onError(({ code, error }) => log.error({ code, error }, error.toString()));

app.get("/", () => "ok");

app.post("/api/webhooks/*", async ({ request, path }) => {
	const payload = await request.json();

	if (BANNED_SET.has(payload?.pull_request?.user?.login) || BANNED_SET.has(payload?.head_commit?.author?.name)) {
		log.info("Blocked request");
		return "";
	}

	const method = request.method;

	// incoming proxy headers (especially CF-Connecting-IP) cause Cloudflare to reject the second hop to Discord with
	// HTTP 403 / error 1000.
	const headers = new Headers({ "content-type": "application/json" });
	for (const name of ["x-github-event", "x-github-delivery", "user-agent"]) {
		const value = request.headers.get(name);
		if (value !== null) {
			headers.set(name, value);
		}
	}

	const body = JSON.stringify(payload);

	const response = await fetch(`https://discord.com${path}`, { method, headers, body });

	if (!response.ok) {
		const responseBody = await response.text();
		const delivery = request.headers.get("x-github-delivery");
		log.error({ status: response.status, body: responseBody, path, delivery }, "Discord rejected webhook");
	} else {
		log.info({ status: response.status }, "Forwarded request");
	}

	return new Response(null, { status: response.status });
});

app.listen(Bun.env.PORT || 8080);

log.debug(`Server is running on port ${app.server?.port}`);
