import type { APIRoute } from "astro";
import { jobsFeed } from "../../jobs/feed";

// Every change on the Jobs page (src/jobs/feed.ts).
export const GET: APIRoute = () => jobsFeed();
