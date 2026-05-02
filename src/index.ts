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

	const headers = new Headers(request.headers);
	headers.delete("host");

	const body = JSON.stringify(payload);

	const response = await fetch(`https://discord.com${path}`, { method, headers, body });

	if (!response.ok) {
		const responseBody = await response.text();
		log.error({ status: response.status, body: responseBody, path }, "Discord rejected webhook");
	} else {
		log.info({ status: response.status }, "Forwarded request");
	}

	return new Response(null, { status: response.status });
});

app.listen(Bun.env.PORT || 8080);

log.debug(`Server is running on port ${app.server?.port}`);
