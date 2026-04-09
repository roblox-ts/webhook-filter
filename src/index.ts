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

	log.info("Forwarded request");

	const method = request.method;

	const headers = new Headers(request.headers);
	headers.delete("host");

	const body = JSON.stringify(payload);

	return fetch(new Request(`https://discord.com${path}`, { method, headers, body }));
});

app.listen(Bun.env.PORT || 8080);

log.debug(`Server is running on port ${app.server?.port}`);
