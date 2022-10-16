import {
  Application,
  HttpError,
  Router,
  Status,
  bold,
  cyan,
  green,
  red,
  join,
  Marked,
  createServerTimingMiddleware,
} from "./deps.ts";

import { fetchSomeDataFromAPI } from './api.ts'
import { render } from "./components/app.tsx";

const PORT = parseInt(Deno.env.get("PORT") || "8080");
const __dirname = new URL(".", import.meta.url).pathname;
const publicFolderPath = join(__dirname, "..", "public");
const { start, end, serverTimingMiddleware } = createServerTimingMiddleware()

// Mock Data
const comments = [
  "Hey! This is the first comment.",
  "Hi, from another comment!",
  "Wow",
];

const app = new Application();

app.use(serverTimingMiddleware)

// Error handler middleware
app.use(async (context, next) => {
  try {
    await next();
  } catch (e) {
    if (e instanceof HttpError) {
      // deno-lint-ignore no-explicit-any
      context.response.status = e.status as any;
      if (e.expose) {
        context.response.body = `<!DOCTYPE html>
            <html>
              <body>
                <h1>${e.status} - ${e.message}</h1>
              </body>
            </html>`;
      } else {
        context.response.body = `<!DOCTYPE html>
            <html>
              <body>
                <h1>${e.status} - ${Status[e.status]}</h1>
              </body>
            </html>`;
      }
    } else if (e instanceof Error) {
      context.response.status = 500;
      context.response.body = `<!DOCTYPE html>
            <html>
              <body>
                <h1>500 - Internal Server Error</h1>
              </body>
            </html>`;
      console.log("Unhandled Error:", red(bold(e.message)));
      console.log(e.stack);
    }
  }
});

// Logger
app.use(async (context, next) => {
  await next();
  const rt = context.response.headers.get("X-Response-Time");
  console.log(
    `${green(context.response.status.toString())} ${green(context.request.method)} ${cyan(context.request.url.pathname)} - ${
      bold(
        String(rt),
      )
    }`,
  );
});

// Response Time
app.use(async (context, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  context.response.headers.set("X-Response-Time", `${ms}ms`);
});

// Create an oak Router
const router = new Router();

// Handle live reload websocket connection
router.get('/_r', async ctx => {
  await ctx.upgrade();
});

// Handle main route
router.get("/", async (context) => {
  console.log(">>>", context.request.url.pathname);
  
  start('markdown')
  const markdownContent = await Deno.readTextFile('public/markdown/test.md')
  const markdown = Marked.parse(markdownContent).content
  end('markdown')

  start('fetch')
  const hello = await fetchSomeDataFromAPI();
  end('fetch')

  start('render')
  context.response.body = render({ hello, comments, markdown });
  end('render')
});

app.use(router.routes());
app.use(router.allowedMethods());

// Static content under /public
app.use(async (context) => {
  console.log(`>>> static try /public${context.request.url.pathname}`)
  await context.send({ root: publicFolderPath });
});

// Log hello
app.addEventListener("listen", () => {
  console.log(`Listening on ${cyan(`http://localhost:${PORT}`)}`);
});

// Start server
await app.listen({ port: PORT });
